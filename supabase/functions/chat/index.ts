import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { requireProfileSession } from '../_shared/auth.ts'
import { decryptSecret } from '../_shared/crypto.ts'
import { adminClient } from '../_shared/db.ts'
import { z } from '../_shared/deps.ts'
import {
  jsonError,
  optionsResponse,
  readJson,
  rejectDisallowedOrigin,
  streamResponse,
} from '../_shared/http.ts'
import {
  createProviderChatStream,
  ProviderError,
  type ChatMessage,
  type Provider,
} from '../_shared/providers.ts'
import { consumeRateLimit, finalizeRateLimit } from '../_shared/rate-limit.ts'

const requestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  provider: z.enum(['openrouter', 'mistral']),
  modelId: z.string().trim().min(1).max(240),
  message: z.string().max(100_000).default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(128).max(32_768).default(4096),
  mode: z.enum(['send', 'regenerate', 'replace']).default('send'),
  messageId: z.string().uuid().optional(),
  reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
})

function titleFromMessage(message: string): string {
  const title = message.replace(/\s+/g, ' ').trim().slice(0, 80)
  return title || 'New conversation'
}

function contentToken(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .map((chunk) => {
      if (typeof chunk === 'string') return chunk
      if (!chunk || typeof chunk !== 'object') return ''
      const record = chunk as Record<string, unknown>
      if (record.type === 'text' && typeof record.text === 'string') return record.text
      return ''
    })
    .join('')
}

function encodeSse(data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
  )
}

async function ownedConversation(
  client: ReturnType<typeof adminClient>,
  profileId: string,
  conversationId: string,
) {
  const { data, error } = await client
    .from('conversations')
    .select('id,title,provider,model_id')
    .eq('id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (error) throw new Error('CONVERSATION_READ_FAILED')
  return data
}

async function loadMessages(
  client: ReturnType<typeof adminClient>,
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await client
    .from('messages')
    .select('role,content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw new Error('MESSAGES_READ_FAILED')
  return (data ?? []).map((row) => ({
    role: row.role as ChatMessage['role'],
    content: row.content,
  }))
}

async function prepareConversation(
  client: ReturnType<typeof adminClient>,
  profileId: string,
  input: z.infer<typeof requestSchema>,
): Promise<string> {
  let conversationId = input.conversationId

  if (!conversationId) {
    if (input.mode !== 'send' || !input.message.trim()) throw new Error('INVALID_CHAT_STATE')
    const { data, error } = await client
      .from('conversations')
      .insert({
        profile_id: profileId,
        title: titleFromMessage(input.message),
        provider: input.provider,
        model_id: input.modelId,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error('CONVERSATION_CREATE_FAILED')
    conversationId = data.id
  } else {
    const conversation = await ownedConversation(client, profileId, conversationId)
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  }

  if (input.mode === 'send') {
    if (!input.message.trim()) throw new Error('EMPTY_MESSAGE')
    const { error } = await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: input.message.trim(),
      provider: input.provider,
      model_id: input.modelId,
    })
    if (error) throw new Error('MESSAGE_CREATE_FAILED')
  } else {
    if (!input.messageId) throw new Error('MESSAGE_ID_REQUIRED')
    const { data: target, error } = await client
      .from('messages')
      .select('id,conversation_id,role,created_at')
      .eq('id', input.messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle()
    if (error) throw new Error('MESSAGE_READ_FAILED')
    if (!target) throw new Error('MESSAGE_NOT_FOUND')

    if (input.mode === 'replace') {
      if (target.role !== 'user') throw new Error('INVALID_MESSAGE_ROLE')
      if (!input.message.trim()) throw new Error('EMPTY_MESSAGE')
      const { error: deleteError } = await client
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .gte('created_at', target.created_at)
      if (deleteError) throw new Error('MESSAGE_REPLACE_FAILED')
      const { error: insertError } = await client.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: input.message.trim(),
        provider: input.provider,
        model_id: input.modelId,
      })
      if (insertError) throw new Error('MESSAGE_REPLACE_FAILED')
    } else {
      if (target.role !== 'assistant') throw new Error('INVALID_MESSAGE_ROLE')
      const { error: deleteError } = await client
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .gte('created_at', target.created_at)
      if (deleteError) throw new Error('MESSAGE_REGENERATE_FAILED')
    }
  }

  const { error: updateError } = await client
    .from('conversations')
    .update({ provider: input.provider, model_id: input.modelId })
    .eq('id', conversationId)
    .eq('profile_id', profileId)
  if (updateError) throw new Error('CONVERSATION_UPDATE_FAILED')
  return conversationId
}

function userFacingStateError(req: Request, error: unknown): Response | null {
  const code = error instanceof Error ? error.message : ''
  if (code === 'CONVERSATION_NOT_FOUND')
    return jsonError(req, 404, { code, message: 'That conversation does not exist.' })
  if (code === 'MESSAGE_NOT_FOUND')
    return jsonError(req, 404, { code, message: 'That message does not exist.' })
  if (
    ['INVALID_CHAT_STATE', 'EMPTY_MESSAGE', 'MESSAGE_ID_REQUIRED', 'INVALID_MESSAGE_ROLE'].includes(
      code,
    )
  ) {
    return jsonError(req, 400, {
      code: 'INVALID_CHAT_REQUEST',
      message: 'The chat action is not valid for this message.',
    })
  }
  return null
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
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success)
    return jsonError(req, 400, { code: 'VALIDATION_ERROR', message: 'Check the chat request.' })

  const client = adminClient()
  const session = await requireProfileSession(req, client)
  if (!session)
    return jsonError(req, 401, {
      code: 'SESSION_INVALID',
      message: 'This profile session is invalid or expired.',
    })

  const limit = await consumeRateLimit(client, {
    scope: 'chat',
    identifier: session.tokenHash,
    max: 40,
    windowSeconds: 60,
  })
  if (!limit.allowed)
    return jsonError(req, 429, {
      code: 'RATE_LIMITED',
      message: 'Too many chat requests. Try again shortly.',
      retryAfter: 60,
    })

  try {
    const input = parsed.data
    const { data: credential, error: credentialError } = await client
      .from('provider_credentials')
      .select('ciphertext,iv')
      .eq('profile_id', session.profileId)
      .eq('provider', input.provider)
      .maybeSingle()
    if (credentialError) throw new Error('CREDENTIAL_READ_FAILED')
    if (!credential) {
      await finalizeRateLimit(client, limit.eventId, false)
      return jsonError(req, 409, {
        code: 'PROVIDER_NOT_CONNECTED',
        message: 'Connect this provider before chatting.',
      })
    }

    const conversationId = await prepareConversation(client, session.profileId, input)
    const messages = await loadMessages(client, conversationId)
    if (!messages.some((message) => message.role === 'user')) {
      await finalizeRateLimit(client, limit.eventId, false)
      return jsonError(req, 400, {
        code: 'EMPTY_CONVERSATION',
        message: 'Add a user message before generating a response.',
      })
    }

    const key = await decryptSecret(credential.ciphertext, credential.iv)
    const providerResponse = await createProviderChatStream({
      provider: input.provider as Provider,
      key,
      modelId: input.modelId,
      messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      reasoningEffort: input.reasoningEffort,
      signal: req.signal,
    })
    if (!providerResponse.body)
      throw new ProviderError(
        502,
        'EMPTY_STREAM',
        'The provider returned an empty response stream.',
      )

    const providerReader = providerResponse.body.getReader()
    const providerDecoder = new TextDecoder()
    let buffer = ''
    let assistantText = ''
    let completed = false

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          while (true) {
            const { value, done } = await providerReader.read()
            if (done) break
            buffer += providerDecoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const rawLine of lines) {
              const line = rawLine.trim()
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (!payload || payload === '[DONE]') continue
              try {
                const event = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: unknown } }>
                }
                const token = contentToken(event.choices?.[0]?.delta?.content)
                if (!token) continue
                assistantText += token
                controller.enqueue(encodeSse({ choices: [{ delta: { content: token } }] }))
              } catch {
                // Ignore non-chat or malformed provider events; do not expose provider bodies.
              }
            }
          }
          completed = true
          if (assistantText) {
            const { error: saveError } = await client.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantText,
              provider: input.provider,
              model_id: input.modelId,
            })
            if (saveError) throw new Error('ASSISTANT_SAVE_FAILED')
          }
          await finalizeRateLimit(client, limit.eventId, true)
          controller.enqueue(encodeSse('[DONE]'))
          controller.close()
        } catch {
          await finalizeRateLimit(client, limit.eventId, false).catch(() => undefined)
          controller.enqueue(
            encodeSse({
              error: {
                code: 'STREAM_INTERRUPTED',
                message: 'The provider stream was interrupted.',
              },
            }),
          )
          controller.close()
        } finally {
          if (!completed) await providerReader.cancel().catch(() => undefined)
        }
      },
      async cancel() {
        await providerReader.cancel().catch(() => undefined)
      },
    })

    return streamResponse(req, stream, { 'x-sylc-conversation-id': conversationId })
  } catch (error) {
    await finalizeRateLimit(client, limit.eventId, false).catch(() => undefined)
    if (error instanceof ProviderError)
      return jsonError(req, error.status, { code: error.code, message: error.message })
    const stateError = userFacingStateError(req, error)
    if (stateError) return stateError
    return jsonError(req, 500, {
      code: 'INTERNAL_ERROR',
      message: 'Sylc could not complete this chat request.',
    })
  }
})
