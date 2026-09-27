import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { requireProfileSession } from '../_shared/auth.ts'
import {
  accessCodeLookupHash,
  constantTimeEqualHex,
  deriveAccessCodeVerifier,
  encryptSecret,
  generateAccessCode,
  randomBase64,
  randomToken,
} from '../_shared/crypto.ts'
import { adminClient, getPublicProfile } from '../_shared/db.ts'
import { z } from '../_shared/deps.ts'
import {
  json,
  jsonError,
  optionsResponse,
  readJson,
  rejectDisallowedOrigin,
} from '../_shared/http.ts'
import { createProfileSession } from '../_shared/auth.ts'
import { consumeRateLimit, finalizeRateLimit, requestIp } from '../_shared/rate-limit.ts'
import { validateProviderKey, type Provider, ProviderError } from '../_shared/providers.ts'

const createSchema = z.object({
  action: z.literal('create'),
  name: z.string().trim().min(2).max(80),
  openrouterKey: z.string().trim().min(8).max(600).optional(),
  mistralKey: z.string().trim().min(8).max(600).optional(),
  deviceLabel: z.string().trim().min(1).max(120),
})
const restoreSchema = z.object({
  action: z.literal('restore'),
  code: z.string().regex(/^\d{12}$/),
  deviceLabel: z.string().trim().min(1).max(120),
})
const renameSchema = z.object({
  action: z.literal('rename'),
  name: z.string().trim().min(2).max(80),
})
const preferencesSchema = z.object({
  action: z.literal('preferences'),
  selectedProvider: z.enum(['openrouter', 'mistral']).optional(),
  selectedModel: z.string().trim().min(1).max(240).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(128).max(32768).optional(),
})
const revokeSessionSchema = z.object({
  action: z.literal('revoke-session'),
  sessionId: z.string().uuid(),
})

function providerError(req: Request, error: ProviderError): Response {
  return jsonError(req, error.status, { code: error.code, message: error.message })
}

async function saveEncryptedCredential(
  client: ReturnType<typeof adminClient>,
  profileId: string,
  provider: Provider,
  key: string,
) {
  const encrypted = await encryptSecret(key)
  const { error } = await client.from('provider_credentials').upsert(
    {
      profile_id: profileId,
      provider,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      status: 'valid',
      last_validated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,provider' },
  )
  if (error) throw new Error('CREDENTIAL_SAVE_FAILED')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req)
  if (req.method !== 'POST')
    return jsonError(req, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' })
  const originError = rejectDisallowedOrigin(req)
  if (originError) return originError

  let body: unknown
  try {
    body = await readJson(req)
  } catch {
    return jsonError(req, 400, { code: 'INVALID_REQUEST', message: 'Send a valid JSON request.' })
  }
  const action = (body as { action?: unknown })?.action
  const client = adminClient()

  try {
    if (action === 'create') {
      const parsed = createSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Check the profile details.',
        })
      const input = parsed.data

      try {
        if (input.openrouterKey) await validateProviderKey('openrouter', input.openrouterKey)
        if (input.mistralKey) await validateProviderKey('mistral', input.mistralKey)
      } catch (error) {
        if (error instanceof ProviderError) return providerError(req, error)
        return jsonError(req, 502, {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'A provider could not be reached for validation.',
        })
      }

      const accessCode = generateAccessCode()
      const salt = randomBase64(16)
      const [lookupHash, verifierHash] = await Promise.all([
        accessCodeLookupHash(accessCode),
        deriveAccessCodeVerifier(accessCode, salt),
      ])
      const sessionToken = randomToken(32)

      const { data: profileRow, error: profileError } = await client
        .from('profiles')
        .insert({ display_name: input.name })
        .select('id')
        .single()
      if (profileError || !profileRow) throw new Error('PROFILE_CREATE_FAILED')
      const profileId = profileRow.id

      try {
        const { error: preferenceError } = await client
          .from('profile_preferences')
          .insert({ profile_id: profileId })
        if (preferenceError) throw new Error('PREFERENCE_CREATE_FAILED')
        const { error: codeError } = await client.from('profile_access_codes').insert({
          profile_id: profileId,
          lookup_hash: lookupHash,
          verifier_hash: verifierHash,
          salt,
        })
        if (codeError) throw new Error('ACCESS_CODE_CREATE_FAILED')
        if (input.openrouterKey)
          await saveEncryptedCredential(client, profileId, 'openrouter', input.openrouterKey)
        if (input.mistralKey)
          await saveEncryptedCredential(client, profileId, 'mistral', input.mistralKey)
        await createProfileSession(client, profileId, input.deviceLabel, sessionToken)
      } catch (error) {
        await client.from('profiles').delete().eq('id', profileId)
        throw error
      }

      const profile = await getPublicProfile(client, profileId)
      return json(req, { profile, accessCode, sessionToken }, 201)
    }

    if (action === 'restore') {
      const parsed = restoreSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'ACCESS_CODE_INVALID',
          message: 'Enter a valid 12-digit access code.',
        })
      const input = parsed.data
      const ip = requestIp(req)
      const [ipLimit, codeLimit] = await Promise.all([
        consumeRateLimit(client, {
          scope: 'restore_ip',
          identifier: ip,
          max: 5,
          windowSeconds: 15 * 60,
        }),
        consumeRateLimit(client, {
          scope: 'restore_code',
          identifier: input.code,
          max: 5,
          windowSeconds: 15 * 60,
        }),
      ])
      if (!ipLimit.allowed || !codeLimit.allowed) {
        return jsonError(req, 429, {
          code: 'ACCESS_CODE_LOCKED',
          message: 'Too many attempts. Try again later.',
          retryAfter: 15 * 60,
        })
      }

      const lookupHash = await accessCodeLookupHash(input.code)
      const { data: codeRow, error: codeReadError } = await client
        .from('profile_access_codes')
        .select('profile_id,verifier_hash,salt,revoked_at')
        .eq('lookup_hash', lookupHash)
        .maybeSingle()
      if (codeReadError) throw new Error('ACCESS_CODE_READ_FAILED')

      const candidate = await deriveAccessCodeVerifier(
        input.code,
        codeRow?.salt ?? randomBase64(16),
      )
      const valid = Boolean(
        codeRow && !codeRow.revoked_at && constantTimeEqualHex(candidate, codeRow.verifier_hash),
      )
      await Promise.all([
        finalizeRateLimit(client, ipLimit.eventId, valid),
        finalizeRateLimit(client, codeLimit.eventId, valid),
      ])
      if (!valid || !codeRow)
        return jsonError(req, 401, {
          code: 'ACCESS_CODE_INVALID',
          message: 'That access code is not valid.',
        })

      const { data: targetProfile } = await client
        .from('profiles')
        .select('id,deleted_at')
        .eq('id', codeRow.profile_id)
        .maybeSingle()
      if (!targetProfile || targetProfile.deleted_at)
        return jsonError(req, 410, {
          code: 'PROFILE_UNAVAILABLE',
          message: 'This profile is no longer available.',
        })

      const sessionToken = randomToken(32)
      await createProfileSession(client, codeRow.profile_id, input.deviceLabel, sessionToken)
      const profile = await getPublicProfile(client, codeRow.profile_id)
      return json(req, { profile, sessionToken })
    }

    const session = await requireProfileSession(req, client)
    if (!session)
      return jsonError(req, 401, {
        code: 'SESSION_INVALID',
        message: 'This profile session is invalid or expired.',
      })

    if (action === 'get') {
      return json(req, { profile: await getPublicProfile(client, session.profileId) })
    }

    if (action === 'rename') {
      const parsed = renameSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Use a profile name between 2 and 80 characters.',
        })
      const { error } = await client
        .from('profiles')
        .update({ display_name: parsed.data.name })
        .eq('id', session.profileId)
      if (error) throw new Error('PROFILE_RENAME_FAILED')
      return json(req, { profile: await getPublicProfile(client, session.profileId) })
    }

    if (action === 'preferences') {
      const parsed = preferencesSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preference values.',
        })
      const update: Record<string, unknown> = {}
      if (parsed.data.selectedProvider) update.selected_provider = parsed.data.selectedProvider
      if (parsed.data.selectedModel) {
        const provider =
          parsed.data.selectedProvider ??
          (await getPublicProfile(client, session.profileId)).preferences.selectedProvider
        update[provider === 'openrouter' ? 'selected_model_openrouter' : 'selected_model_mistral'] =
          parsed.data.selectedModel
      }
      if (parsed.data.temperature != null) update.temperature = parsed.data.temperature
      if (parsed.data.maxTokens != null) update.max_tokens = parsed.data.maxTokens
      if (Object.keys(update).length) {
        const { error } = await client
          .from('profile_preferences')
          .update(update)
          .eq('profile_id', session.profileId)
        if (error) throw new Error('PREFERENCES_UPDATE_FAILED')
      }
      return json(req, { profile: await getPublicProfile(client, session.profileId) })
    }

    if (action === 'regenerate-code') {
      const accessCode = generateAccessCode()
      const salt = randomBase64(16)
      const [lookupHash, verifierHash] = await Promise.all([
        accessCodeLookupHash(accessCode),
        deriveAccessCodeVerifier(accessCode, salt),
      ])
      const { error } = await client
        .from('profile_access_codes')
        .update({
          lookup_hash: lookupHash,
          verifier_hash: verifierHash,
          salt,
          rotated_at: new Date().toISOString(),
          revoked_at: null,
        })
        .eq('profile_id', session.profileId)
      if (error) throw new Error('ACCESS_CODE_ROTATE_FAILED')
      return json(req, { accessCode })
    }

    if (action === 'sessions') {
      const { data, error } = await client
        .from('profile_sessions')
        .select('id,device_label,created_at,expires_at,last_seen_at,revoked_at')
        .eq('profile_id', session.profileId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('last_seen_at', { ascending: false })
      if (error) throw new Error('SESSIONS_READ_FAILED')
      return json(req, {
        sessions: (data ?? []).map((row) => ({
          id: row.id,
          deviceLabel: row.device_label,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          lastSeenAt: row.last_seen_at,
          current: row.id === session.sessionId,
        })),
      })
    }

    if (action === 'revoke-session') {
      const parsed = revokeSessionSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid session identifier.',
        })
      const { error } = await client
        .from('profile_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', parsed.data.sessionId)
        .eq('profile_id', session.profileId)
      if (error) throw new Error('SESSION_REVOKE_FAILED')
      return json(req, { ok: true })
    }

    if (action === 'delete-profile') {
      const { error } = await client.from('profiles').delete().eq('id', session.profileId)
      if (error) throw new Error('PROFILE_DELETE_FAILED')
      return json(req, { ok: true })
    }

    return jsonError(req, 400, { code: 'UNKNOWN_ACTION', message: 'Unknown profile operation.' })
  } catch (error) {
    if (error instanceof ProviderError) return providerError(req, error)
    return jsonError(req, 500, {
      code: 'INTERNAL_ERROR',
      message: 'Sylc could not complete this profile operation.',
    })
  }
})
