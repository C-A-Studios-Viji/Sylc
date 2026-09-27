import { KeyRound, LogOut, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AccessCodePanel } from '../components/AccessCodePanel'
import { Notice } from '../components/Notice'
import { SettingsTabs } from '../components/SettingsTabs'
import { deleteProfile, regenerateAccessCode, renameProfile } from '../lib/api'
import { useProfile } from '../lib/profile-context'

export function SecuritySettingsPage() {
  const { profile, replaceProfile, signOutLocal } = useProfile()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [newCode, setNewCode] = useState<string | null>(null)
  const [deleteText, setDeleteText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function rename() {
    if (!name.trim() || name.trim() === profile?.displayName) return
    setBusy(true)
    setError('')
    try {
      const result = await renameProfile(name.trim())
      replaceProfile(result.profile)
      setMessage('Profile renamed.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rename failed.')
    } finally {
      setBusy(false)
    }
  }

  async function regenerate() {
    if (!window.confirm('Regenerate the access code? The old code will stop working immediately.'))
      return
    setBusy(true)
    setError('')
    try {
      const result = await regenerateAccessCode()
      setNewCode(result.accessCode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not regenerate the code.')
    } finally {
      setBusy(false)
    }
  }

  async function destroy() {
    if (deleteText !== 'DELETE') return
    setBusy(true)
    setError('')
    try {
      await deleteProfile()
      signOutLocal()
      window.location.assign('/welcome')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Profile deletion failed.')
      setBusy(false)
    }
  }

  if (newCode) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-[8px] border border-sylc-line bg-white p-5 sylc-shadow">
          <div className="mb-4 text-sm font-semibold">New access code</div>
          <AccessCodePanel accessCode={newCode} onContinue={() => setNewCode(null)} />
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">Settings</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile security</h1>
      <p className="mt-1 text-sm text-sylc-muted">
        Manage identity, recovery, local data, and permanent deletion.
      </p>
      <div className="mt-4 rounded-[8px] border border-sylc-line bg-white">
        <SettingsTabs />
      </div>
      {(message || error) && (
        <div className="mt-4">
          <Notice tone={error ? 'error' : 'success'}>{error || message}</Notice>
        </div>
      )}

      <section className="mt-4 rounded-[8px] border border-sylc-line bg-white p-4">
        <h2 className="text-sm font-semibold">Profile name</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-[7px] border border-sylc-line px-3 text-sm outline-none focus:border-sylc-sky-strong"
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void rename()}
            className="rounded-[7px] bg-sylc-sky/70 px-3 text-xs font-medium disabled:opacity-50"
          >
            Rename
          </button>
        </div>
      </section>

      <section className="mt-3 rounded-[8px] border border-sylc-line bg-white p-4">
        <div className="flex items-start gap-3">
          <KeyRound size={17} className="mt-0.5 text-sylc-gold" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Access code</h2>
            <p className="mt-1 text-xs leading-5 text-sylc-muted">
              Generate a fresh 12-digit code. The previous code is revoked atomically and is never
              recoverable from Sylc.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void regenerate()}
              className="mt-3 rounded-[7px] border border-sylc-line px-3 py-1.5 text-xs font-medium"
            >
              Regenerate code
            </button>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-[8px] border border-sylc-line bg-white p-4">
        <div className="flex items-start gap-3">
          <LogOut size={17} className="mt-0.5 text-slate-500" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Reset local data</h2>
            <p className="mt-1 text-xs leading-5 text-sylc-muted">
              Remove this device's Sylc session and local UI state. Your encrypted profile remains
              in the backend.
            </p>
            <button
              type="button"
              onClick={() => {
                signOutLocal()
                window.location.assign('/welcome')
              }}
              className="mt-3 rounded-[7px] border border-sylc-line px-3 py-1.5 text-xs font-medium"
            >
              Clear this device
            </button>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-[8px] border border-red-200 bg-red-50/50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert size={17} className="mt-0.5 text-red-700" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-red-900">
              Delete profile and encrypted vault
            </h2>
            <p className="mt-1 text-xs leading-5 text-red-800">
              This cascades through provider credentials, sessions, preferences, conversations, and
              messages. It cannot be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={deleteText}
                onChange={(event) => setDeleteText(event.target.value)}
                placeholder="Type DELETE"
                className="h-9 min-w-0 flex-1 rounded-[7px] border border-red-200 bg-white px-3 text-sm outline-none"
              />
              <button
                type="button"
                disabled={busy || deleteText !== 'DELETE'}
                onClick={() => void destroy()}
                className="flex items-center gap-1.5 rounded-[7px] bg-red-700 px-3 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
