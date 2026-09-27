import type { SupabaseClient } from './deps.ts'
import { rateLimitHash } from './crypto.ts'

export interface RateLimitRule {
  scope: string
  identifier: string
  max: number
  windowSeconds: number
}

export interface RateLimitTicket {
  allowed: boolean
  eventId: number | null
  retryAfter: number
}

/**
 * Atomically consumes one rate-limit slot inside Postgres. The SQL function
 * takes an advisory transaction lock per scope/key so parallel requests cannot
 * race through a count-then-insert check.
 */
export async function consumeRateLimit(
  client: SupabaseClient,
  rule: RateLimitRule,
): Promise<RateLimitTicket> {
  const keyHash = await rateLimitHash(rule.identifier)
  const { data, error } = await client.rpc('consume_sylc_rate_limit', {
    p_scope: rule.scope,
    p_key_hash: keyHash,
    p_max: rule.max,
    p_window_seconds: rule.windowSeconds,
  })

  if (error) throw new Error('RATE_LIMIT_CHECK_FAILED')

  const eventId = typeof data === 'number' ? data : data == null ? null : Number(data)
  return {
    allowed: eventId !== null && Number.isFinite(eventId),
    eventId: eventId !== null && Number.isFinite(eventId) ? eventId : null,
    retryAfter: rule.windowSeconds,
  }
}

export async function finalizeRateLimit(
  client: SupabaseClient,
  eventId: number | null,
  succeeded: boolean,
): Promise<void> {
  if (eventId === null) return
  const { error } = await client.from('rate_limit_events').update({ succeeded }).eq('id', eventId)
  if (error) throw new Error('RATE_LIMIT_WRITE_FAILED')
}

export function requestIp(req: Request): string {
  const direct = req.headers.get('cf-connecting-ip')
  if (direct) return direct
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return 'unknown'
}
