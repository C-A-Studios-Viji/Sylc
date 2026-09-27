import { useQuery } from '@tanstack/react-query'
import { Braces, Gauge, Gem, Search, Sparkles, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '../components/Notice'
import { ProviderMark } from '../components/ProviderMark'
import { Spinner } from '../components/Spinner'
import { getModels, updatePreferences } from '../lib/api'
import { useProfile } from '../lib/profile-context'
import type { Provider, ProviderModel } from '../types/api'

const featureLabels: Record<string, { label: string; icon: typeof Sparkles }> = {
  best_overall: { label: 'Best overall', icon: Sparkles },
  best_reasoning: { label: 'Best reasoning', icon: Gem },
  best_coding: { label: 'Best coding', icon: Braces },
  fastest: { label: 'Fastest', icon: TimerReset },
  best_value: { label: 'Best value', icon: Gauge },
  long_context: { label: 'Long context', icon: Search },
}

function ModelRow({ model, onUse }: { model: ProviderModel; onUse: () => void }) {
  return (
    <div className="grid gap-2 border-b border-sylc-line px-3 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{model.name || model.id}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-sylc-muted">{model.id}</div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
          {model.contextLength ? <span>{model.contextLength.toLocaleString()} ctx</span> : null}
          {model.capabilities.slice(0, 4).map((capability) => (
            <span
              key={capability}
              className="rounded border border-sylc-line bg-slate-50 px-1.5 py-0.5"
            >
              {capability}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onUse}
        className="rounded-[7px] bg-sylc-sky/70 px-3 py-1.5 text-xs font-medium hover:bg-sylc-sky"
      >
        Use in chat
      </button>
    </div>
  )
}

export function ModelsPage() {
  const { profile, replaceProfile } = useProfile()
  const [provider, setProvider] = useState<Provider>(
    profile?.preferences.selectedProvider ?? 'openrouter',
  )
  const [query, setQuery] = useState('')
  const [manualModelId, setManualModelId] = useState('')
  const connected =
    profile?.providers.find((item) => item.provider === provider)?.connected ?? false
  const catalogue = useQuery({
    queryKey: ['models', provider],
    queryFn: () => getModels(provider),
    enabled: connected,
    staleTime: 5 * 60_000,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalogue.data?.models ?? []
    return (catalogue.data?.models ?? []).filter((model) =>
      `${model.name} ${model.id} ${model.description ?? ''}`.toLowerCase().includes(q),
    )
  }, [catalogue.data, query])

  async function selectModel(modelId: string) {
    const { profile: next } = await updatePreferences({
      selectedProvider: provider,
      selectedModel: modelId,
    })
    replaceProfile(next)
    window.location.assign('/chat')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">
            Live catalogue
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Model browser</h1>
          <p className="mt-1 text-sm text-sylc-muted">
            Only models returned by your connected provider are shown.
          </p>
        </div>
        <div className="flex rounded-[7px] bg-slate-100 p-1 text-xs">
          {(['openrouter', 'mistral'] as Provider[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setProvider(item)}
              className={`rounded-[6px] px-3 py-1.5 ${provider === item ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
            >
              {item === 'openrouter' ? 'OpenRouter' : 'Mistral'}
            </button>
          ))}
        </div>
      </div>

      {!connected ? (
        <div className="mt-5">
          <Notice tone="warning">
            Connect {provider === 'openrouter' ? 'OpenRouter' : 'Mistral'} in{' '}
            <Link to="/settings/providers" className="font-medium underline">
              Provider settings
            </Link>{' '}
            to load its live model catalogue.
          </Notice>
        </div>
      ) : catalogue.isLoading ? (
        <div className="mt-8">
          <Spinner label="Loading provider models" />
        </div>
      ) : catalogue.error ? (
        <div className="mt-5">
          <Notice tone="error">{catalogue.error.message}</Notice>
        </div>
      ) : (
        <>
          <section className="mt-5 grid gap-2 md:grid-cols-3">
            {Object.entries(featureLabels).map(([key, meta]) => {
              const ids = catalogue.data?.featured[key] ?? []
              const model = catalogue.data?.models.find((item) => item.id === ids[0])
              if (!model) return null
              const Icon = meta.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void selectModel(model.id)}
                  className="rounded-[8px] border border-sylc-line bg-white p-3 text-left transition hover:border-sylc-sky-strong hover:shadow-sm"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.09em] text-sylc-muted">
                    <Icon size={13} /> {meta.label}
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold">
                    {model.name || model.id}
                  </div>
                  <div className="mt-1">
                    <ProviderMark provider={provider} />
                  </div>
                </button>
              )
            })}
          </section>

          <section className="mt-5 rounded-[8px] border border-sylc-line bg-white p-3">
            <div className="text-xs font-semibold text-slate-800">New model ID</div>
            <p className="mt-0.5 text-[11px] text-sylc-muted">
              For a newly released model that your provider accepts before it appears in the
              catalogue.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={manualModelId}
                onChange={(event) => setManualModelId(event.target.value)}
                placeholder={provider === 'openrouter' ? 'provider/model-id' : 'model-id'}
                className="h-9 min-w-0 flex-1 rounded-[7px] border border-sylc-line px-3 font-mono text-xs outline-none focus:border-sylc-sky-strong"
              />
              <button
                type="button"
                disabled={!manualModelId.trim()}
                onClick={() => void selectModel(manualModelId.trim())}
                className="rounded-[7px] border border-sylc-line px-3 text-xs font-medium disabled:opacity-40"
              >
                Use ID
              </button>
            </div>
          </section>

          <section className="mt-3 overflow-hidden rounded-[8px] border border-sylc-line bg-white">
            <div className="border-b border-sylc-line p-3">
              <label className="relative block">
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or model ID"
                  className="h-9 w-full rounded-[7px] border border-sylc-line bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-sylc-sky-strong"
                />
              </label>
            </div>
            <div className="max-h-[60vh] overflow-y-auto sylc-scrollbar">
              {filtered.map((model) => (
                <ModelRow key={model.id} model={model} onUse={() => void selectModel(model.id)} />
              ))}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-sylc-muted">No matching models.</div>
              )}
            </div>
          </section>
          <p className="mt-3 text-[11px] leading-5 text-sylc-muted">
            Featured groups are computed from the provider catalogue Sylc receives at request time
            using capabilities, context, pricing, recency, and model-family signals. Manual model
            IDs remain available above for newly released models that have not appeared in the
            catalogue yet.
          </p>
        </>
      )}
    </main>
  )
}
