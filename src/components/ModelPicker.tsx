import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProviderModel } from '../types/api'

export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: ProviderModel[]
  value: string
  onChange: (modelId: string) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return models.slice(0, 80)
    return models
      .filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(q))
      .slice(0, 80)
  }, [models, query])

  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search className="absolute left-2.5 top-2.5 text-slate-400" size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search available models"
          disabled={disabled}
          className="h-9 w-full rounded-[7px] border border-sylc-line bg-white pl-8 pr-3 text-sm outline-none focus:border-sylc-sky-strong"
        />
      </label>
      <select
        value={models.some((model) => model.id === value) ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 w-full rounded-[7px] border border-sylc-line bg-white px-2 text-sm"
      >
        <option value="">Select a model</option>
        {filtered.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name || model.id}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="Or enter a new model ID"
          disabled={disabled}
          className="h-9 min-w-0 flex-1 rounded-[7px] border border-sylc-line bg-white px-3 text-sm outline-none focus:border-sylc-sky-strong"
        />
        <button
          type="button"
          disabled={disabled || !manual.trim()}
          onClick={() => {
            onChange(manual.trim())
            setManual('')
          }}
          className="rounded-[7px] border border-sylc-line bg-white px-3 text-xs font-medium disabled:opacity-50"
        >
          Use ID
        </button>
      </div>
    </div>
  )
}
