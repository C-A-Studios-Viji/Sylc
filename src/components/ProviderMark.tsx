import type { Provider } from '../types/api'
import { tierName } from '../lib/model-aliases'

export function ProviderMark({ provider }: { provider: Provider }) {
  const label = tierName[provider]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span
        className={`h-2 w-2 rounded-full ${provider === 'openrouter' ? 'bg-sylc-sky-strong' : 'bg-sylc-gold'}`}
      />
      {label}
    </span>
  )
}
