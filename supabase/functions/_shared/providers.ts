export type Provider = 'openrouter' | 'mistral'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface NormalizedModel {
  id: string
  name: string
  description: string | null
  contextLength: number | null
  pricing: { prompt?: string | null; completion?: string | null; request?: string | null } | null
  capabilities: string[]
  created: number | null
}

export class ProviderError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function headers(provider: Provider, key: string): HeadersInit {
  const common: Record<string, string> = {
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  }
  if (provider === 'openrouter') {
    common['x-openrouter-title'] = 'Sylc'
    const site = Deno.env.get('PUBLIC_APP_URL')
    if (site) common['http-referer'] = site
  }
  return common
}

function providerUrl(provider: Provider, path: string): string {
  const base =
    provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.mistral.ai/v1'
  return `${base}${path}`
}

async function toProviderError(provider: Provider, response: Response): Promise<ProviderError> {
  const label = provider === 'openrouter' ? 'OpenRouter' : 'Mistral'
  if (response.status === 401 || response.status === 403)
    return new ProviderError(
      response.status,
      'INVALID_PROVIDER_KEY',
      `${label} rejected the API key.`,
    )
  if (response.status === 402)
    return new ProviderError(402, 'INSUFFICIENT_CREDIT', `${label} reports insufficient credit.`)
  if (response.status === 400)
    return new ProviderError(
      400,
      'UNSUPPORTED_REQUEST',
      'The selected model does not support one or more requested settings.',
    )
  if (response.status === 404)
    return new ProviderError(404, 'MODEL_UNAVAILABLE', 'The selected model is not available.')
  if (response.status === 429)
    return new ProviderError(429, 'PROVIDER_RATE_LIMIT', `${label} rate-limited the request.`)
  if (response.status >= 500)
    return new ProviderError(502, 'PROVIDER_UNAVAILABLE', `${label} is temporarily unavailable.`)
  return new ProviderError(502, 'PROVIDER_ERROR', `${label} could not complete the request.`)
}

export async function validateProviderKey(provider: Provider, key: string): Promise<void> {
  const url =
    provider === 'openrouter' ? providerUrl(provider, '/key') : providerUrl(provider, '/models')
  const response = await fetch(url, {
    method: 'GET',
    headers: headers(provider, key),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw await toProviderError(provider, response)
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeOpenRouter(payload: unknown): NormalizedModel[] {
  const rows = (payload as { data?: unknown[] })?.data
  if (!Array.isArray(rows)) return []
  return rows
    .map((raw) => {
      const row = raw as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) return null
      const architecture = (row.architecture ?? {}) as Record<string, unknown>
      const supported = Array.isArray(row.supported_parameters)
        ? row.supported_parameters.filter((item): item is string => typeof item === 'string')
        : []
      const input = Array.isArray(architecture.input_modalities)
        ? architecture.input_modalities.filter((item): item is string => typeof item === 'string')
        : []
      const output = Array.isArray(architecture.output_modalities)
        ? architecture.output_modalities.filter((item): item is string => typeof item === 'string')
        : []
      const pricingRaw = (row.pricing ?? {}) as Record<string, unknown>
      return {
        id,
        name: typeof row.name === 'string' ? row.name : id,
        description: typeof row.description === 'string' ? row.description : null,
        contextLength: numberOrNull(row.context_length),
        pricing: {
          prompt: typeof pricingRaw.prompt === 'string' ? pricingRaw.prompt : null,
          completion: typeof pricingRaw.completion === 'string' ? pricingRaw.completion : null,
          request: typeof pricingRaw.request === 'string' ? pricingRaw.request : null,
        },
        capabilities: [
          ...new Set([
            ...supported,
            ...input.map((item) => `input:${item}`),
            ...output.map((item) => `output:${item}`),
          ]),
        ],
        created: numberOrNull(row.created),
      } satisfies NormalizedModel
    })
    .filter((item): item is NormalizedModel => Boolean(item))
}

function normalizeMistral(payload: unknown): NormalizedModel[] {
  const rows = (payload as { data?: unknown[] })?.data
  if (!Array.isArray(rows)) return []
  return rows
    .map((raw) => {
      const row = raw as Record<string, unknown>
      if (row.archived === true) return null
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) return null
      const capabilityObject = (row.capabilities ?? {}) as Record<string, unknown>
      if (capabilityObject.completion_chat === false) return null
      const capabilities = Object.entries(capabilityObject)
        .filter(([, enabled]) => enabled === true)
        .map(([name]) => name)
      return {
        id,
        name:
          typeof row.name === 'string' ? row.name : typeof row.root === 'string' ? row.root : id,
        description: null,
        contextLength: numberOrNull(row.max_context_length),
        pricing: null,
        capabilities,
        created: numberOrNull(row.created),
      } satisfies NormalizedModel
    })
    .filter((item): item is NormalizedModel => Boolean(item))
}

export async function listProviderModels(
  provider: Provider,
  key: string,
): Promise<NormalizedModel[]> {
  const response = await fetch(providerUrl(provider, '/models'), {
    method: 'GET',
    headers: headers(provider, key),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw await toProviderError(provider, response)
  const payload = await response.json()
  const models =
    provider === 'openrouter' ? normalizeOpenRouter(payload) : normalizeMistral(payload)
  return models.sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.name.localeCompare(b.name))
}

function unitPrice(model: NormalizedModel): number | null {
  if (!model.pricing) return null
  const prompt = Number(model.pricing.prompt)
  const completion = Number(model.pricing.completion)
  if (!Number.isFinite(prompt) && !Number.isFinite(completion)) return null
  return (Number.isFinite(prompt) ? prompt : 0) + (Number.isFinite(completion) ? completion : 0)
}

function baseQuality(model: NormalizedModel): number {
  const haystack = `${model.id} ${model.name}`.toLowerCase()
  let score = Math.log2(Math.max(model.contextLength ?? 8192, 8192))
  score += Math.min(model.capabilities.length, 10) * 0.35
  if (/pro|opus|ultra|large|medium|sonnet|frontier|flagship|astra/.test(haystack)) score += 5
  if (/mini|nano|tiny|small|lite/.test(haystack)) score -= 1.5
  if (model.created) score += Math.min(3, Math.max(0, (model.created - 1_735_689_600) / 31_536_000))
  return score
}

function topIds(
  models: NormalizedModel[],
  score: (model: NormalizedModel) => number,
  limit = 5,
): string[] {
  return [...models]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
    .map((model) => model.id)
}

export function featureModels(models: NormalizedModel[]): Record<string, string[]> {
  if (models.length === 0) return {}
  const bySignal = (pattern: RegExp) =>
    models.filter((model) => pattern.test(`${model.id} ${model.name}`.toLowerCase()))
  const reasoningCandidates = bySignal(/reason|thinking|r1|pro|opus|large|medium|astra|\bo[1-9]\b/)
  const codingCandidates = bySignal(/code|coder|devstral|codestral|software|developer|agent/)
  const fastCandidates = bySignal(/fast|flash|mini|nano|small|lite|ministral/)

  const longContext = [...models]
    .sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0))
    .slice(0, 5)
    .map((model) => model.id)
  const bestValue = topIds(models, (model) => {
    const price = unitPrice(model)
    const divisor = price == null ? 1 : Math.max(Math.sqrt(price * 1_000_000), 0.35)
    return baseQuality(model) / divisor
  })
  const fastest = topIds(fastCandidates.length ? fastCandidates : models, (model) => {
    const price = unitPrice(model)
    return (model.created ?? 0) / 1_000_000_000 - (price == null ? 0 : price * 1_000_000)
  })

  return {
    best_overall: topIds(models, baseQuality),
    best_reasoning: topIds(reasoningCandidates.length ? reasoningCandidates : models, baseQuality),
    best_coding: topIds(codingCandidates.length ? codingCandidates : models, baseQuality),
    fastest,
    best_value: bestValue,
    long_context: longContext,
  }
}

export async function createProviderChatStream(input: {
  provider: Provider
  key: string
  modelId: string
  messages: ChatMessage[]
  temperature: number
  maxTokens: number
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  signal?: AbortSignal
}): Promise<Response> {
  const body: Record<string, unknown> = {
    model: input.modelId,
    messages: input.messages,
    stream: true,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
  }
  if (input.provider === 'mistral' && input.reasoningEffort && input.reasoningEffort !== 'none') {
    body.reasoning_effort = input.reasoningEffort
    body.prompt_mode = 'reasoning'
  }

  const response = await fetch(providerUrl(input.provider, '/chat/completions'), {
    method: 'POST',
    headers: headers(input.provider, input.key),
    body: JSON.stringify(body),
    signal: input.signal,
  })
  if (!response.ok) throw await toProviderError(input.provider, response)
  return response
}
