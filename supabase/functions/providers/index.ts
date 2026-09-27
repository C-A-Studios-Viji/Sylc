import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { requireProfileSession } from '../_shared/auth.ts'
import { decryptSecret, encryptSecret } from '../_shared/crypto.ts'
import { adminClient, getPublicProfile } from '../_shared/db.ts'
import { z } from '../_shared/deps.ts'
import {
  json,
  jsonError,
  optionsResponse,
  readJson,
  rejectDisallowedOrigin,
} from '../_shared/http.ts'
import { consumeRateLimit, finalizeRateLimit } from '../_shared/rate-limit.ts'
import {
  featureModels,
  listProviderModels,
  ProviderError,
  validateProviderKey,
} from '../_shared/providers.ts'

const providerSchema = z.enum(['openrouter', 'mistral'])
const actionSchema = z.object({
  action: z.enum(['test', 'save', 'remove', 'models']),
  provider: providerSchema,
})
const keySchema = actionSchema.extend({ key: z.string().trim().min(8).max(600) })

function providerError(req: Request, error: ProviderError): Response {
  return jsonError(req, error.status, { code: error.code, message: error.message })
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

  const client = adminClient()
  const session = await requireProfileSession(req, client)
  if (!session)
    return jsonError(req, 401, {
      code: 'SESSION_INVALID',
      message: 'This profile session is invalid or expired.',
    })

  const limit = await consumeRateLimit(client, {
    scope: 'provider_ops',
    identifier: session.tokenHash,
    max: 30,
    windowSeconds: 60,
  })
  if (!limit.allowed)
    return jsonError(req, 429, {
      code: 'RATE_LIMITED',
      message: 'Too many provider operations. Try again shortly.',
      retryAfter: 60,
    })

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success)
    return jsonError(req, 400, { code: 'VALIDATION_ERROR', message: 'Invalid provider operation.' })
  const { action, provider } = parsed.data

  try {
    if (action === 'test' || action === 'save') {
      const keyParsed = keySchema.safeParse(body)
      if (!keyParsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Enter a valid provider key.',
        })
      await validateProviderKey(provider, keyParsed.data.key)

      if (action === 'test') {
        await finalizeRateLimit(client, limit.eventId, true)
        return json(req, { ok: true })
      }

      const encrypted = await encryptSecret(keyParsed.data.key)
      const { error } = await client.from('provider_credentials').upsert(
        {
          profile_id: session.profileId,
          provider,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          status: 'valid',
          last_validated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,provider' },
      )
      if (error) throw new Error('CREDENTIAL_SAVE_FAILED')
      await finalizeRateLimit(client, limit.eventId, true)
      return json(req, { profile: await getPublicProfile(client, session.profileId) })
    }

    if (action === 'remove') {
      const { error } = await client
        .from('provider_credentials')
        .delete()
        .eq('profile_id', session.profileId)
        .eq('provider', provider)
      if (error) throw new Error('CREDENTIAL_DELETE_FAILED')
      await finalizeRateLimit(client, limit.eventId, true)
      return json(req, { profile: await getPublicProfile(client, session.profileId) })
    }

    const { data: credential, error: credentialError } = await client
      .from('provider_credentials')
      .select('ciphertext,iv')
      .eq('profile_id', session.profileId)
      .eq('provider', provider)
      .maybeSingle()
    if (credentialError) throw new Error('CREDENTIAL_READ_FAILED')
    if (!credential)
      return jsonError(req, 409, {
        code: 'PROVIDER_NOT_CONNECTED',
        message: 'Connect this provider before loading models.',
      })

    const key = await decryptSecret(credential.ciphertext, credential.iv)
    const models = await listProviderModels(provider, key)
    await finalizeRateLimit(client, limit.eventId, true)
    return json(req, { provider, models, featured: featureModels(models) })
  } catch (error) {
    await finalizeRateLimit(client, limit.eventId, false).catch(() => undefined)
    if (error instanceof ProviderError) return providerError(req, error)
    return jsonError(req, 500, {
      code: 'INTERNAL_ERROR',
      message: 'Sylc could not complete this provider operation.',
    })
  }
})
