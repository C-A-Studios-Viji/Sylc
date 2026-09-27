import { aliasesFor, type ModelAlias } from './model-aliases'
import type { ModelCatalogue, Provider, ProviderModel } from '../types/api'

const roots: Record<Provider, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  mistral: 'https://api.mistral.ai/v1',
}
const labels: Record<Provider, string> = { openrouter: 'Medalion', mistral: 'YiNi' }
const storageKey = 'sylc-tab-keys'

export function readKeys(): Partial<Record<Provider, string>> {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey) || '{}') as Partial<
      Record<Provider, string>
    >
  } catch {
    return {}
  }
}

export function saveKey(provider: Provider, key: string) {
  const keys = readKeys()
  if (key) keys[provider] = key
  else delete keys[provider]
  sessionStorage.setItem(storageKey, JSON.stringify(keys))
}

function errorFor(provider: Provider, status: number): Error {
  if (status === 401 || status === 403) return new Error(`${labels[provider]} rejected this key.`)
  if (status === 402) return new Error(`${labels[provider]} has insufficient credit.`)
  if (status === 429) return new Error(`${labels[provider]} is busy. Try again shortly.`)
  if (status === 404) return new Error('This model is no longer available. Refresh Models.')
  return new Error(`${labels[provider]} could not complete the request (${status}).`)
}

function rank(model: ProviderModel, coding: boolean): number {
  const name = `${model.id} ${model.name}`.toLowerCase()
  let score = Math.log2(Math.max(model.contextLength ?? 8192, 8192))
  if (/pro|opus|ultra|large|medium|sonnet|frontier|flagship/.test(name)) score += 5
  if (/mini|nano|tiny|small|lite/.test(name)) score -= 3
  if (coding && /code|coder|devstral|codestral|software|developer|agent/.test(name)) score += 12
  if (model.created) score += Math.min(3, Math.max(0, (model.created - 1_735_689_600) / 31_536_000))
  return score
}

function freeMedalionModel(row: Record<string, unknown>): boolean {
  if (typeof row.id !== 'string') return false
  if (row.id === 'openrouter/free') return true
  const pricing = (row.pricing ?? {}) as Record<string, unknown>
  const zeroPriced =
    pricing.prompt != null &&
    pricing.completion != null &&
    Number(pricing.prompt) === 0 &&
    Number(pricing.completion) === 0 &&
    (pricing.request == null || Number(pricing.request) === 0)
  return row.id.endsWith(':free') || zeroPriced
}

export async function loadAliases(provider: Provider, key: string): Promise<ModelAlias[]> {
  let response: Response
  try {
    if (provider === 'openrouter') {
      const validation = await fetch(`${roots[provider]}/key`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20_000),
      })
      if (!validation.ok) throw errorFor(provider, validation.status)
    }
    response = await fetch(`${roots[provider]}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (caught) {
    if (caught instanceof Error && caught.name !== 'TypeError' && caught.name !== 'TimeoutError')
      throw caught
    throw new Error(`${labels[provider]} could not be reached from this browser.`)
  }
  if (!response.ok) throw errorFor(provider, response.status)
  const payload = (await response.json()) as { data?: Array<Record<string, unknown>> }
  const models: ProviderModel[] = (payload.data ?? []).flatMap((row) => {
    if (typeof row.id !== 'string' || row.archived === true) return []
    if (provider === 'openrouter' && !freeMedalionModel(row)) return []
    const capabilities = (row.capabilities ?? {}) as Record<string, unknown>
    if (capabilities.completion_chat === false) return []
    const architecture = (row.architecture ?? {}) as Record<string, unknown>
    if (
      Array.isArray(architecture.output_modalities) &&
      !architecture.output_modalities.includes('text')
    )
      return []
    return [
      {
        id: row.id,
        name: typeof row.name === 'string' ? row.name : row.id,
        contextLength: Number(row.context_length ?? row.max_context_length) || null,
        capabilities: Object.keys(capabilities).filter((name) => capabilities[name] === true),
        created: Number(row.created) || null,
      },
    ]
  })
  const byRank = [...models].sort(
    (a, b) => rank(b, provider === 'mistral') - rank(a, provider === 'mistral'),
  )
  if (provider === 'openrouter') {
    const routerIndex = byRank.findIndex((model) => model.id === 'openrouter/free')
    if (routerIndex >= 0) byRank.push(...byRank.splice(routerIndex, 1))
    else {
      const router = { id: 'openrouter/free', name: 'Free routing', capabilities: [] }
      byRank.push(router)
      models.push(router)
    }
  }
  const catalogue: ModelCatalogue = {
    provider,
    models,
    featured: {
      best_overall: byRank.map((model) => model.id),
      best_coding: byRank.map((model) => model.id),
    },
  }
  return aliasesFor(provider, catalogue)
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export function needsCurrentInfo(text: string): boolean {
  return /\b(latest|today|yesterday|tomorrow|currently|current|right now|this week|last week|recent|news|weather|forecast|price|stock|score|election|schedule|release date|newest|up to date|knowledge cutoff|ceo|president|202[5-9])\b/i.test(
    text,
  )
}

async function searchWithYiNi(
  key: string,
  modelId: string,
  messages: ChatTurn[],
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(`${roots.mistral}/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, inputs: messages, tools: [{ type: 'web_search' }] }),
    signal,
  })
  if (!response.ok) throw errorFor('mistral', response.status)
  const payload = (await response.json()) as {
    outputs?: Array<{
      type?: string
      content?: string | Array<{ type?: string; text?: string; title?: string; url?: string }>
    }>
  }
  const text: string[] = []
  const sources = new Map<string, string>()
  for (const output of payload.outputs ?? []) {
    if (output.type !== 'message.output') continue
    if (typeof output.content === 'string') text.push(output.content)
    else
      for (const chunk of output.content ?? []) {
        if (chunk.type === 'text' && chunk.text) text.push(chunk.text)
        if (chunk.type === 'tool_reference' && chunk.url?.startsWith('https://'))
          sources.set(chunk.url, chunk.title ?? chunk.url)
      }
  }
  const answer = text.join('')
  if (!answer) throw new Error('Search returned no answer.')
  return sources.size
    ? `${answer}\n\nSources: ${[...sources].map(([url, title]) => `[${title}](${url})`).join(' · ')}`
    : answer
}

export async function sendDirectChat(
  provider: Provider,
  key: string,
  modelId: string,
  messages: ChatTurn[],
  onText: (text: string) => void,
  signal: AbortSignal,
  fallbackModelIds: string[] = [],
): Promise<string> {
  let response: Response
  const endpoint = `${roots[provider]}/chat/completions`
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const currentQuestion = needsCurrentInfo(messages.at(-1)?.content ?? '')
  let searchUnavailable = false
  if (provider === 'mistral' && currentQuestion) {
    try {
      const answer = await searchWithYiNi(key, modelId, messages, signal)
      onText(answer)
      return answer
    } catch (caught) {
      if (signal.aborted) throw caught
      searchUnavailable = true
    }
  }
  const request = (model: string, search: boolean) =>
    fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        ...(provider === 'openrouter' && model !== 'openrouter/free'
          ? {
              models: [...new Set([...fallbackModelIds, 'openrouter/free'])].filter(
                (id) => id !== model,
              ),
            }
          : {}),
        ...(search
          ? {
              tools: [
                { type: 'openrouter:web_search', parameters: { max_uses: 1, max_results: 3 } },
              ],
              max_tool_calls: 1,
            }
          : {}),
        messages,
        stream: true,
      }),
      signal,
    })
  try {
    response = await request(modelId, provider === 'openrouter' && currentQuestion)
    if (provider === 'openrouter' && currentQuestion && !response.ok && response.status !== 401) {
      searchUnavailable = true
      response = await request(modelId, false)
    }
    if (
      provider === 'openrouter' &&
      modelId !== 'openrouter/free' &&
      [404, 429, 502, 503].includes(response.status)
    ) {
      response = await request('openrouter/free', false)
    }
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error(`${labels[provider]} could not be reached from this browser.`)
  }
  if (!response.ok) throw errorFor(provider, response.status)
  if (!response.body) throw new Error('The response stream is unavailable.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let output = searchUnavailable
    ? 'I could not check live sources, so this answer may be out of date.\n\n'
    : ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split(/\r?\n\r?\n/)
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') return output
        try {
          const event = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>
            error?: { message?: string }
          }
          if (event.error) throw new Error(event.error.message ?? 'Generation failed.')
          const content = event.choices?.[0]?.delta?.content
          const text =
            typeof content === 'string'
              ? content
              : Array.isArray(content)
                ? content.map((item) => item.text ?? '').join('')
                : ''
          if (text) {
            output += text
            onText(output)
          }
        } catch (error) {
          if (error instanceof SyntaxError) continue
          throw error
        }
      }
    }
  }
  return output
}
