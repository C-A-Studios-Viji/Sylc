import { z } from 'zod'
import type {
  ApiErrorShape,
  Conversation,
  Message,
  ModelCatalogue,
  ProfileSession,
  Provider,
  SylcProfile,
} from '../types/api'
import { loadSession } from './session'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

const envResult = envSchema.safeParse(import.meta.env)

export const appConfig = envResult.success
  ? envResult.data
  : {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: '',
    }

export const isConfigured = envResult.success

export class ApiError extends Error {
  code: string
  status: number
  retryAfter?: number

  constructor(message: string, code = 'UNKNOWN', status = 500, retryAfter?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

function edgeUrl(name: string): string {
  if (!isConfigured) throw new ApiError('Sylc is not configured yet.', 'NOT_CONFIGURED', 503)
  return `${appConfig.VITE_SUPABASE_URL}/functions/v1/${name}`
}

function commonHeaders(session = true): HeadersInit {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    apikey: appConfig.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
  if (session) {
    const stored = loadSession()
    if (stored?.token) headers['x-sylc-session'] = stored.token
  }
  return headers
}

async function parseError(response: Response): Promise<never> {
  let body: ApiErrorShape | null = null
  try {
    body = (await response.json()) as ApiErrorShape
  } catch {
    // Provider or gateway returned a non-JSON error. Keep the client message generic.
  }
  const retry = Number(response.headers.get('retry-after')) || body?.error?.retryAfter
  throw new ApiError(
    body?.error?.message ?? 'The request could not be completed.',
    body?.error?.code ?? 'REQUEST_FAILED',
    response.status,
    retry,
  )
}

async function postJson<T>(functionName: string, body: unknown, session = true): Promise<T> {
  const response = await fetch(edgeUrl(functionName), {
    method: 'POST',
    headers: commonHeaders(session),
    body: JSON.stringify(body),
  })
  if (!response.ok) return parseError(response)
  return (await response.json()) as T
}

export async function createProfile(input: {
  name: string
  openrouterKey?: string
  mistralKey?: string
  deviceLabel: string
}): Promise<{ profile: SylcProfile; accessCode: string; sessionToken: string }> {
  return postJson('profile', { action: 'create', ...input }, false)
}

export async function restoreProfile(
  code: string,
  deviceLabel: string,
): Promise<{ profile: SylcProfile; sessionToken: string }> {
  return postJson('profile', { action: 'restore', code, deviceLabel }, false)
}

export async function getProfile(): Promise<{ profile: SylcProfile }> {
  return postJson('profile', { action: 'get' })
}

export async function renameProfile(name: string): Promise<{ profile: SylcProfile }> {
  return postJson('profile', { action: 'rename', name })
}

export async function updatePreferences(input: {
  selectedProvider?: Provider
  selectedModel?: string
  temperature?: number
  maxTokens?: number
}): Promise<{ profile: SylcProfile }> {
  const payload = { ...input }
  if (payload.selectedModel !== undefined && !payload.selectedModel.trim())
    delete payload.selectedModel
  return postJson('profile', { action: 'preferences', ...payload })
}

export async function regenerateAccessCode(): Promise<{ accessCode: string }> {
  return postJson('profile', { action: 'regenerate-code' })
}

export async function listSessions(): Promise<{ sessions: ProfileSession[] }> {
  return postJson('profile', { action: 'sessions' })
}

export async function revokeSession(sessionId: string): Promise<{ ok: true }> {
  return postJson('profile', { action: 'revoke-session', sessionId })
}

export async function deleteProfile(): Promise<{ ok: true }> {
  return postJson('profile', { action: 'delete-profile' })
}

export async function testProviderKey(provider: Provider, key: string): Promise<{ ok: true }> {
  return postJson('providers', { action: 'test', provider, key })
}

export async function saveProviderKey(
  provider: Provider,
  key: string,
): Promise<{ profile: SylcProfile }> {
  return postJson('providers', { action: 'save', provider, key })
}

export async function removeProviderKey(provider: Provider): Promise<{ profile: SylcProfile }> {
  return postJson('providers', { action: 'remove', provider })
}

export async function getModels(provider: Provider): Promise<ModelCatalogue> {
  return postJson('providers', { action: 'models', provider })
}

export async function listConversations(): Promise<{ conversations: Conversation[] }> {
  return postJson('conversations', { action: 'list' })
}

export async function getConversation(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  return postJson('conversations', { action: 'get', conversationId })
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<{ ok: true }> {
  return postJson('conversations', { action: 'rename', conversationId, title })
}

export async function deleteConversation(conversationId: string): Promise<{ ok: true }> {
  return postJson('conversations', { action: 'delete', conversationId })
}

export async function streamChat(input: {
  conversationId?: string
  provider: Provider
  modelId: string
  message: string
  temperature: number
  maxTokens: number
  mode?: 'send' | 'regenerate' | 'replace'
  messageId?: string
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  signal?: AbortSignal
  onConversationId?: (conversationId: string) => void
  onToken: (token: string) => void
}): Promise<void> {
  const response = await fetch(edgeUrl('chat'), {
    method: 'POST',
    headers: commonHeaders(true),
    body: JSON.stringify({
      conversationId: input.conversationId,
      provider: input.provider,
      modelId: input.modelId,
      message: input.message,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      mode: input.mode ?? 'send',
      messageId: input.messageId,
      reasoningEffort: input.reasoningEffort,
    }),
    signal: input.signal,
  })
  if (!response.ok) return parseError(response)

  const conversationId = response.headers.get('x-sylc-conversation-id')
  if (conversationId) input.onConversationId?.(conversationId)
  if (!response.body)
    throw new ApiError('The provider returned an empty stream.', 'EMPTY_STREAM', 502)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>
          error?: { code?: string; message?: string }
        }
        if (parsed.error)
          throw new ApiError(
            parsed.error.message ?? 'The provider stream was interrupted.',
            parsed.error.code ?? 'STREAM_INTERRUPTED',
            502,
          )
        const token = parsed.choices?.[0]?.delta?.content
        if (token) input.onToken(token)
      } catch (error) {
        if (error instanceof ApiError) throw error
        // A malformed provider event is ignored; the server still owns provider error handling.
      }
    }
  }
}
