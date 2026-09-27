import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, ShieldCheck, Smartphone, XCircle } from 'lucide-react'
import { Notice } from '../components/Notice'
import { SettingsTabs } from '../components/SettingsTabs'
import { listSessions, revokeSession } from '../lib/api'

export function SessionsSettingsPage() {
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: listSessions })

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">Settings</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Session management</h1>
      <p className="mt-1 text-sm text-sylc-muted">
        Review devices with active profile sessions and revoke them individually.
      </p>
      <div className="mt-4 rounded-[8px] border border-sylc-line bg-white">
        <SettingsTabs />
      </div>
      {sessions.error && (
        <div className="mt-4">
          <Notice tone="error">{sessions.error.message}</Notice>
        </div>
      )}
      <section className="mt-4 overflow-hidden rounded-[8px] border border-sylc-line bg-white">
        {(sessions.data?.sessions ?? []).map((session) => (
          <div
            key={session.id}
            className="flex items-center gap-3 border-b border-sylc-line p-4 last:border-b-0"
          >
            <div className="grid h-9 w-9 place-items-center rounded-[7px] bg-slate-100 text-slate-600">
              {session.deviceLabel.toLowerCase().includes('iphone') ? (
                <Smartphone size={17} />
              ) : (
                <Laptop size={17} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {session.deviceLabel}
                {session.current && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                    <ShieldCheck size={11} /> This session
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-sylc-muted">
                Last seen {new Date(session.lastSeenAt).toLocaleString()} · expires{' '}
                {new Date(session.expiresAt).toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              disabled={session.current}
              onClick={() =>
                void revokeSession(session.id).then(() =>
                  queryClient.invalidateQueries({ queryKey: ['sessions'] }),
                )
              }
              className="flex items-center gap-1 rounded-[7px] border border-sylc-line px-2 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <XCircle size={13} /> Revoke
            </button>
          </div>
        ))}
        {sessions.data?.sessions.length === 0 && (
          <div className="p-8 text-center text-sm text-sylc-muted">No active sessions.</div>
        )}
      </section>
    </main>
  )
}
