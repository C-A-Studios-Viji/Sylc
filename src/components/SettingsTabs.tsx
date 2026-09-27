import { KeyRound, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/settings/providers', label: 'Providers', icon: KeyRound },
  { to: '/settings/security', label: 'Profile security', icon: ShieldCheck },
  { to: '/settings/sessions', label: 'Sessions', icon: MonitorSmartphone },
]

export function SettingsTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-sylc-line px-4 pt-3">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium ${
              isActive
                ? 'border-sylc-sky-strong text-slate-900'
                : 'border-transparent text-sylc-muted hover:text-slate-800'
            }`
          }
        >
          <Icon size={14} /> {label}
        </NavLink>
      ))}
    </nav>
  )
}
