import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { requireProfileSession } from '../_shared/auth.ts'
import { adminClient } from '../_shared/db.ts'
import { z } from '../_shared/deps.ts'
import {
  json,
  jsonError,
  optionsResponse,
  readJson,
  rejectDisallowedOrigin,
} from '../_shared/http.ts'

const listSchema = z.object({ action: z.literal('list') })
const idSchema = z.object({ action: z.enum(['get', 'delete']), conversationId: z.string().uuid() })
const renameSchema = z.object({
  action: z.literal('rename'),
  conversationId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
})

function mapConversation(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    modelId: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessage(row: Record<string, unknown>) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    modelId: row.model_id,
    createdAt: row.created_at,
  }
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

  const action = (body as { action?: unknown })?.action

  try {
    if (action === 'list') {
      if (!listSchema.safeParse(body).success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid conversation request.',
        })
      const { data, error } = await client
        .from('conversations')
        .select('id,title,provider,model_id,created_at,updated_at')
        .eq('profile_id', session.profileId)
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) throw new Error('CONVERSATIONS_READ_FAILED')
      return json(req, { conversations: (data ?? []).map((row) => mapConversation(row)) })
    }

    if (action === 'get') {
      const parsed = idSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid conversation request.',
        })
      const { data: conversation, error: conversationError } = await client
        .from('conversations')
        .select('id,title,provider,model_id,created_at,updated_at')
        .eq('id', parsed.data.conversationId)
        .eq('profile_id', session.profileId)
        .maybeSingle()
      if (conversationError) throw new Error('CONVERSATION_READ_FAILED')
      if (!conversation)
        return jsonError(req, 404, {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'That conversation does not exist.',
        })

      const { data: messages, error: messageError } = await client
        .from('messages')
        .select('id,conversation_id,role,content,provider,model_id,created_at')
        .eq('conversation_id', parsed.data.conversationId)
        .order('created_at', { ascending: true })
        .limit(500)
      if (messageError) throw new Error('MESSAGES_READ_FAILED')
      return json(req, {
        conversation: mapConversation(conversation),
        messages: (messages ?? []).map((row) => mapMessage(row)),
      })
    }

    if (action === 'rename') {
      const parsed = renameSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Use a title between 1 and 160 characters.',
        })
      const { data, error } = await client
        .from('conversations')
        .update({ title: parsed.data.title })
        .eq('id', parsed.data.conversationId)
        .eq('profile_id', session.profileId)
        .select('id')
        .maybeSingle()
      if (error) throw new Error('CONVERSATION_RENAME_FAILED')
      if (!data)
        return jsonError(req, 404, {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'That conversation does not exist.',
        })
      return json(req, { ok: true })
    }

    if (action === 'delete') {
      const parsed = idSchema.safeParse(body)
      if (!parsed.success)
        return jsonError(req, 400, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid conversation request.',
        })
      const { data, error } = await client
        .from('conversations')
        .delete()
        .eq('id', parsed.data.conversationId)
        .eq('profile_id', session.profileId)
        .select('id')
        .maybeSingle()
      if (error) throw new Error('CONVERSATION_DELETE_FAILED')
      if (!data)
        return jsonError(req, 404, {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'That conversation does not exist.',
        })
      return json(req, { ok: true })
    }

    return jsonError(req, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Unknown conversation operation.',
    })
  } catch {
    return jsonError(req, 500, {
      code: 'INTERNAL_ERROR',
      message: 'Sylc could not complete this conversation operation.',
    })
  }
})
