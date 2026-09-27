import type { SupabaseClient } from './deps.ts'
import { sha256 } from './crypto.ts'

export interface SessionContext {
  sessionId: string
  profileId: string
  tokenHash: string
}

export async function requireProfileSession(
  req: Request,
  client: SupabaseClient,
): Promise<SessionContext | null> {
  const token = req.headers.get('x-sylc-session')?.trim()
  if (!token || token.length < 32) return null
  const tokenHash = await sha256(token)
  const { data, error } = await client
    .from('profile_sessions')
    .select('id,profile_id,expires_at,revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null

  await client
    .from('profile_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
  return { sessionId: data.id, profileId: data.profile_id, tokenHash }
}

export async function createProfileSession(
  client: SupabaseClient,
  profileId: string,
  deviceLabel: string,
  token: string,
) {
  const tokenHash = await sha256(token)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('profile_sessions')
    .insert({
      profile_id: profileId,
      token_hash: tokenHash,
      device_label: deviceLabel,
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (error) throw new Error('SESSION_CREATE_FAILED')
  return { id: data.id, expiresAt, tokenHash }
}
