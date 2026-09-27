import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Notice } from '../components/Notice'
import { Spinner } from '../components/Spinner'
import { getModels, updatePreferences } from '../lib/api'
import { aliasesFor, tierName } from '../lib/model-aliases'
import { useProfile } from '../lib/profile-context'
import type { Provider } from '../types/api'

export function ModelsPage() {
  const { profile, replaceProfile } = useProfile()
  const navigate = useNavigate()
  const [provider, setProvider] = useState<Provider>(
    profile?.providers.find((item) => item.provider === profile.preferences.selectedProvider)
      ?.connected
      ? profile.preferences.selectedProvider
      : (profile?.providers.find((item) => item.connected)?.provider ?? 'openrouter'),
  )
  const [error, setError] = useState('')
  const connected =
    profile?.providers.find((item) => item.provider === provider)?.connected ?? false
  const catalogue = useQuery({
    queryKey: ['models', provider],
    queryFn: () => getModels(provider),
    enabled: connected,
    staleTime: 5 * 60_000,
  })
  const aliases = aliasesFor(provider, catalogue.data)

  async function selectModel(modelId: string) {
    try {
      const { profile: next } = await updatePreferences({
        selectedProvider: provider,
        selectedModel: modelId,
      })
      replaceProfile(next)
      navigate('/chat')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not select this model.')
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">Models</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose your model</h1>
      <p className="mt-1 text-sm text-sylc-muted">
        Sylc selects the first available choice automatically.
      </p>
      <div className="mt-5 flex gap-2">
        {(['openrouter', 'mistral'] as Provider[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setProvider(item)}
            className={`rounded-[7px] border px-4 py-2 text-sm ${provider === item ? 'border-sylc-sky-strong bg-sylc-sky/60 font-semibold' : 'border-sylc-line bg-white'}`}
          >
            {tierName[item]}
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {!connected ? (
        <div className="mt-5">
          <Notice tone="warning">
            Connect {tierName[provider]} in{' '}
            <Link to="/settings/providers" className="underline">
              Connections
            </Link>{' '}
            to use these models.
          </Notice>
        </div>
      ) : catalogue.isLoading ? (
        <div className="mt-8">
          <Spinner label="Finding models" />
        </div>
      ) : catalogue.error ? (
        <div className="mt-5">
          <Notice tone="error">{catalogue.error.message}</Notice>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {aliases.map((alias) => (
            <button
              key={alias.name}
              type="button"
              onClick={() => void selectModel(alias.modelId)}
              className="rounded-[9px] border border-sylc-line bg-white p-5 text-left shadow-sm transition hover:border-sylc-sky-strong"
            >
              <Sparkles size={19} className="text-sylc-gold" />
              <div className="mt-3 text-lg font-semibold">{alias.name}</div>
              <div className="mt-1 text-sm text-sylc-muted">
                {alias.subtitle} · {alias.tier}
              </div>
              <div className="mt-4 text-xs font-medium text-slate-700">Use in chat →</div>
            </button>
          ))}
          {!aliases.length && (
            <Notice tone="warning">No models are available for this key yet.</Notice>
          )}
        </div>
      )}
    </main>
  )
}
