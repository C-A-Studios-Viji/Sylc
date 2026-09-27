import { getAllowedOrigins } from './env.ts'

export interface ErrorPayload {
  code: string
  message: string
  retryAfter?: number
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin')
  const allowed = getAllowedOrigins()
  const selected = origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'access-control-allow-origin': selected ?? 'null',
    'access-control-allow-headers':
      'authorization, apikey, content-type, x-sylc-session, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-expose-headers': 'x-sylc-conversation-id, retry-after',
    vary: 'Origin',
  }
}

export function rejectDisallowedOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin')
  if (!origin) return null
  if (getAllowedOrigins().includes(origin)) return null
  return jsonError(req, 403, { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.' })
}

export function optionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export function json(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

export function jsonError(
  req: Request,
  status: number,
  error: ErrorPayload,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = { ...extraHeaders } as Record<string, string>
  if (error.retryAfter) headers['retry-after'] = String(error.retryAfter)
  return json(req, { error }, status, headers)
}

export function streamResponse(
  req: Request,
  body: ReadableStream<Uint8Array>,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store',
      connection: 'keep-alive',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  })
}

export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) throw new Error('INVALID_CONTENT_TYPE')
  return await req.json()
}
