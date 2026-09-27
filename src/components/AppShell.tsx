import { Bot, Boxes, LogOut, MessageSquare, Settings, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useProfile } from '../lib/profile-context'

const navItems = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/models', label: 'Models', icon: Boxes },
  { to: '/settings/providers', label: 'Settings', icon: Settings },
  { to: '/settings/security', label: 'Security', icon: ShieldCheck },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOutLocal } = useProfile()

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-sylc-line bg-white/90 px-3 py-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-[7px] bg-sylc-sky text-slate-900">
            <Bot size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Sylc</div>
            <div className="text-[11px] text-sylc-muted">multi-provider AI</div>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-[7px] px-2.5 py-2 text-sm transition ${
                  isActive
                    ? 'bg-sylc-sky/55 font-medium text-slate-950'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-sylc-line pt-3">
          <div className="px-2 py-2">
            <div className="truncate text-xs font-medium text-slate-800">
              {profile?.displayName}
            </div>
            <div className="text-[11px] text-sylc-muted">Secure profile</div>
          </div>
          <button
            type="button"
            onClick={signOutLocal}
            className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={14} />
            Leave this device
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-sylc-line bg-white/95 px-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 font-semibold">
            <Bot size={17} /> Sylc
          </div>
          <div className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                aria-label={label}
                className={({ isActive }) =>
                  `grid h-8 w-8 place-items-center rounded-[7px] ${isActive ? 'bg-sylc-sky/60' : 'text-slate-500'}`
                }
              >
                <Icon size={16} />
              </NavLink>
            ))}
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
