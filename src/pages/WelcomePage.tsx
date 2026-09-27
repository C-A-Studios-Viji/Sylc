import { Eye, EyeOff, KeyRound, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Notice } from '../components/Notice'
import { createProfile, restoreProfile } from '../lib/api'
import { getDeviceLabel } from '../lib/device'
import { useProfile } from '../lib/profile-context'

function KeyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
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
          placeholder="Paste your key"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-[7px] border border-sylc-line bg-white px-3 pr-10 text-sm outline-none focus:border-sylc-sky-strong"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-slate-400 hover:text-slate-700"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  )
}

export function WelcomePage() {
  const navigate = useNavigate()
  const restoreMode = useLocation().pathname.endsWith('/restore')
  const { setAuthenticatedProfile, setPendingAccessCode } = useProfile()
  const [medalionKey, setMedalionKey] = useState('')
  const [yiniKey, setYiniKey] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function connect(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!medalionKey.trim() && !yiniKey.trim()) {
      setError('Enter at least one key to continue.')
      return
    }
    setBusy(true)
    try {
      const result = await createProfile({
        name: 'Sylc',
        openrouterKey: medalionKey.trim() || undefined,
        mistralKey: yiniKey.trim() || undefined,
        deviceLabel: getDeviceLabel(),
      })
      setPendingAccessCode(result.accessCode)
      setAuthenticatedProfile(result.profile, result.sessionToken)
      navigate('/chat', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not connect the keys.')
    } finally {
      setBusy(false)
    }
  }

  async function restore(event: React.FormEvent) {
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
      setError(caught instanceof Error ? caught.message : 'Could not restore this profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="sylc-shadow w-full max-w-lg overflow-hidden rounded-[9px] border border-sylc-line bg-white">
        <div className="border-b border-sylc-line bg-[linear-gradient(110deg,rgba(191,231,255,.75),rgba(202,208,226,.28),rgba(255,255,255,.8))] px-6 py-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-white/80">
              <Sparkles size={17} />
            </span>
            Sylc
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {restoreMode ? 'Welcome back.' : 'Connect your keys. Start chatting.'}
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {restoreMode
              ? 'Enter your private recovery code to open your space on this device.'
              : 'Zen is selected automatically when Medalion is connected. YiNi is ready for coding.'}
          </p>
        </div>
        <div className="p-6">
          {error && (
            <div className="mb-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          {restoreMode ? (
            <form onSubmit={(event) => void restore(event)} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">12-digit access code</span>
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="0000 0000 0000"
                  autoComplete="one-time-code"
                  className="h-11 w-full rounded-[7px] border border-sylc-line px-3 font-mono text-lg tracking-[0.12em]"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-[7px] bg-sylc-sky-strong px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? 'Opening…' : 'Open Sylc'}
              </button>
              <Link to="/welcome" className="block text-center text-xs text-sylc-muted underline">
                Use keys instead
              </Link>
            </form>
          ) : (
            <form onSubmit={(event) => void connect(event)} className="space-y-4">
              <KeyField label="Medalion key" value={medalionKey} onChange={setMedalionKey} />
              <KeyField label="YiNi key" value={yiniKey} onChange={setYiniKey} />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-[7px] bg-sylc-sky-strong px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                <KeyRound size={15} /> {busy ? 'Connecting…' : 'Start Sylc'}
              </button>
              <Link to="/restore" className="block text-center text-xs text-sylc-muted underline">
                Already have a recovery code?
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
