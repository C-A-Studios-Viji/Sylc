import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Notice } from '../components/Notice'
import { SettingsTabs } from '../components/SettingsTabs'
import { removeProviderKey, saveProviderKey, testProviderKey } from '../lib/api'
import { useProfile } from '../lib/profile-context'
import type { Provider } from '../types/api'

function ProviderCard({ provider }: { provider: Provider }) {
  const { profile, replaceProfile } = useProfile()
  const connection = profile?.providers.find((item) => item.provider === provider)
  const [key, setKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const label = provider === 'openrouter' ? 'OpenRouter' : 'Mistral'

  async function test() {
    if (!key.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      await testProviderKey(provider, key.trim())
      setMessage({ tone: 'success', text: `${label} accepted this key.` })
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Key validation failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!key.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await saveProviderKey(provider, key.trim())
      replaceProfile(result.profile)
      setKey('')
      setMessage({
        tone: 'success',
        text: `${label} is connected. The stored key remains server-side.`,
      })
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not save the key.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove the saved ${label} key?`)) return
    setBusy(true)
    try {
      const result = await removeProviderKey(provider)
      replaceProfile(result.profile)
      setMessage({ tone: 'success', text: `${label} disconnected.` })
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not remove the key.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[8px] border border-sylc-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound size={15} /> {label}
          </div>
          <p className="mt-1 text-xs leading-5 text-sylc-muted">
            {connection?.connected
              ? 'Connected · key is masked and encrypted in the backend vault.'
              : 'Not connected.'}
          </p>
        </div>
        {connection?.connected && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={14} /> Connected
          </span>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={
              connection?.connected ? 'Enter a replacement key' : `Enter ${label} API key`
            }
            autoComplete="off"
            className="h-9 w-full rounded-[7px] border border-sylc-line px-3 pr-9 text-sm outline-none focus:border-sylc-sky-strong"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute right-2 top-1.5 grid h-6 w-6 place-items-center text-slate-400"
            aria-label="Toggle API key visibility"
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          type="button"
          disabled={busy || !key.trim()}
          onClick={() => void test()}
          className="rounded-[7px] border border-sylc-line px-3 text-xs font-medium disabled:opacity-50"
        >
          Test
        </button>
        <button
          type="button"
          disabled={busy || !key.trim()}
          onClick={() => void save()}
          className="rounded-[7px] bg-sylc-sky-strong px-3 text-xs font-semibold disabled:opacity-50"
        >
          {connection?.connected ? 'Replace' : 'Save'}
        </button>
      </div>
      {connection?.connected && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="mt-3 flex items-center gap-1.5 text-xs text-red-700 hover:underline"
        >
          <Trash2 size={13} /> Remove saved key
        </button>
      )}
      {message && (
        <div className="mt-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </section>
  )
}

export function ProvidersSettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">
          Settings
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Provider connections</h1>
        <p className="mt-1 text-sm text-sylc-muted">
          Test, replace, or remove your private provider keys.
        </p>
      </div>
      <div className="mt-4 rounded-[8px] border border-sylc-line bg-white">
        <SettingsTabs />
      </div>
      <div className="mt-4 space-y-3">
        <ProviderCard provider="openrouter" />
        <ProviderCard provider="mistral" />
      </div>
    </main>
  )
}
