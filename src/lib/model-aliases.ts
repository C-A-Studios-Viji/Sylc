import type { ModelCatalogue, Provider } from '../types/api'

export type ModelAlias = {
  name: 'Zen' | 'Strato' | 'Kami' | 'Zex'
  subtitle: string
  tier: 'Medalion' | 'YiNi'
  provider: Provider
  modelId: string
}

export const tierName: Record<Provider, 'Medalion' | 'YiNi'> = {
  openrouter: 'Medalion',
  mistral: 'YiNi',
}

export function aliasesFor(provider: Provider, catalogue?: ModelCatalogue): ModelAlias[] {
  if (!catalogue) return []
  const names =
    provider === 'openrouter' ? (['Zen', 'Strato'] as const) : (['Kami', 'Zex'] as const)
  const subtitles =
    provider === 'openrouter'
      ? ['Best free choice', 'Second free choice']
      : ['Best for coding', 'Second coding choice']
  const preferred = provider === 'openrouter' ? 'best_overall' : 'best_coding'
  const available = new Set(catalogue.models.map((model) => model.id))
  const ranked = [
    ...(catalogue.featured[preferred] ?? []),
    ...(catalogue.featured.best_overall ?? []),
    ...catalogue.models.map((model) => model.id),
  ].filter((id, index, all) => available.has(id) && all.indexOf(id) === index)

  return names.flatMap((name, index) => {
    const modelId = ranked[index]
    return modelId
      ? [{ name, subtitle: subtitles[index] ?? '', tier: tierName[provider], provider, modelId }]
      : []
  })
}
