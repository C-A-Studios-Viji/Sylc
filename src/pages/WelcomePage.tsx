import { Eye, EyeOff, KeyRound, LockKeyhole, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AccessCodePanel } from '../components/AccessCodePanel'
import { Notice } from '../components/Notice'
import { createProfile, restoreProfile } from '../lib/api'
import { getDeviceLabel } from '../lib/device'
import { useProfile } from '../lib/profile-context'
import type { SylcProfile } from '../types/api'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(80),
  openrouterKey: z.string().trim().optional(),
  mistralKey: z.string().trim().optional(),
})

function SecretInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-[7px] border border-sylc-line bg-white px-3 pr-10 text-sm outline-none focus:border-sylc-sky-strong"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide API key' : 'Show API key'}
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center text-slate-400 hover:text-slate-700"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  )
}

export function WelcomePage() {
  const navigate = useNavigate()
  const { setAuthenticatedProfile } = useProfile()
  const [mode, setMode] = useState<'create' | 'restore'>('create')
  const [name, setName] = useState('')
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [mistralKey, setMistralKey] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{
    profile: SylcProfile
    accessCode: string
    sessionToken: string
  } | null>(null)

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const parsed = createSchema.safeParse({ name, openrouterKey, mistralKey })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the profile details.')
      return
    }
    setBusy(true)
    try {
      const result = await createProfile({
        name: parsed.data.name,
        openrouterKey: parsed.data.openrouterKey || undefined,
        mistralKey: parsed.data.mistralKey || undefined,
        deviceLabel: getDeviceLabel(),
      })
      setCreated(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Profile creation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const normalized = code.replace(/\D/g, '')
    if (!/^\d{12}$/.test(normalized)) {
      setError('Enter the full 12-digit access code.')
      return
    }
    setBusy(true)
    try {
      const result = await restoreProfile(normalized, getDeviceLabel())
      setAuthenticatedProfile(result.profile, result.sessionToken)
      navigate('/chat', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That profile could not be restored.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <section className="sylc-shadow w-full max-w-md rounded-[8px] border border-sylc-line bg-white p-5">
          <div className="mb-4">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">
              Profile ready
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Save your Sylc access code
            </h1>
          </div>
          <AccessCodePanel
            accessCode={created.accessCode}
            onContinue={() => {
              setAuthenticatedProfile(created.profile, created.sessionToken)
              navigate('/chat', { replace: true })
            }}
          />
        </section>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="sylc-shadow w-full max-w-lg overflow-hidden rounded-[8px] border border-sylc-line bg-white">
        <div className="border-b border-sylc-line bg-[linear-gradient(110deg,rgba(191,231,255,.7),rgba(202,208,226,.26),rgba(255,255,255,.8))] px-5 py-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-white/80">
              <Sparkles size={17} />
            </span>
            Sylc
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Your AI connections, one secure profile.
          </h1>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">
            Connect OpenRouter or Mistral, then move between devices with a private 12-digit access
            code.
          </p>
        </div>

        <div className="p-5">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-[7px] bg-slate-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('create')
                setError('')
              }}
              className={`rounded-[6px] px-3 py-2 ${mode === 'create' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
            >
              Create profile
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('restore')
                setError('')
              }}
              className={`rounded-[6px] px-3 py-2 ${mode === 'restore' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
            >
              Enter access code
            </button>
          </div>

          {error && (
            <div className="mb-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}

          {mode === 'create' ? (
            <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Profile name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. My Sylc"
                  autoFocus
                  className="h-10 w-full rounded-[7px] border border-sylc-line bg-white px-3 text-sm outline-none focus:border-sylc-sky-strong"
                />
              </label>
              <div className="rounded-[7px] border border-sylc-line bg-slate-50 p-3">
                <div className="mb-3 flex items-start gap-2">
                  <KeyRound size={16} className="mt-0.5 text-sylc-gold" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Provider connections</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-sylc-muted">
                      Optional now. Valid keys are encrypted server-side and never returned to this
                      browser.
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <SecretInput
                    label="OpenRouter API key"
                    value={openrouterKey}
                    onChange={setOpenrouterKey}
                    placeholder="sk-or-…"
                  />
                  <SecretInput
                    label="Mistral API key"
                    value={mistralKey}
                    onChange={setMistralKey}
                    placeholder="Mistral key"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-[7px] bg-sylc-sky-strong px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busy ? 'Creating secure profile…' : 'Create secure profile'}
              </button>
            </form>
          ) : (
            <form onSubmit={(event) => void handleRestore(event)} className="space-y-4">
              <div className="rounded-[7px] border border-sylc-line bg-slate-50 p-3 text-sm text-slate-600">
                <LockKeyhole className="mb-2 text-sylc-twilight-deep" size={19} />
                Restoring a profile gives this device a new short-lived session. Saved API keys
                remain encrypted in the backend vault.
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">12-digit access code</span>
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="0000 0000 0000"
                  autoComplete="one-time-code"
                  className="h-11 w-full rounded-[7px] border border-sylc-line bg-white px-3 font-mono text-lg tracking-[0.12em] outline-none focus:border-sylc-sky-strong"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-[7px] bg-sylc-sky-strong px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busy ? 'Restoring…' : 'Restore profile'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
