import type { ReactNode } from 'react'

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'error' | 'success' | 'warning'
}) {
  const classes = {
    info: 'border-sylc-sky bg-sylc-sky/20 text-slate-700',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone]
  return <div className={`rounded-[7px] border px-3 py-2 text-sm ${classes}`}>{children}</div>
}
