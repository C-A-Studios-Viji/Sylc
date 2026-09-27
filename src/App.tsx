import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Spinner } from './components/Spinner'
import { isConfigured } from './lib/api'
import { useProfile } from './lib/profile-context'
import { ChatPage } from './pages/ChatPage'
import { ModelsPage } from './pages/ModelsPage'
import { ProvidersSettingsPage } from './pages/ProvidersSettingsPage'
import { SecuritySettingsPage } from './pages/SecuritySettingsPage'
import { SessionsSettingsPage } from './pages/SessionsSettingsPage'
import { WelcomePage } from './pages/WelcomePage'

function ConfigurationMissing() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-lg rounded-[8px] border border-sylc-line bg-white p-5 sylc-shadow">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-sylc-gold">
          Configuration required
        </div>
        <h1 className="mt-2 text-xl font-semibold">Connect Sylc to Supabase</h1>
        <p className="mt-2 text-sm leading-6 text-sylc-muted">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from the
          included <code>.env.example</code>. Provider keys and vault secrets must never be placed
          in browser variables.
        </p>
      </div>
    </main>
  )
}

function ProtectedLayout() {
  const { profile, loading } = useProfile()
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Spinner label="Opening secure profile" />
      </main>
    )
  }
  if (!profile) return <Navigate to="/welcome" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function WelcomeRoute() {
  const { profile, loading } = useProfile()
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <Spinner label="Checking this device" />
      </main>
    )
  if (profile) return <Navigate to="/chat" replace />
  return <WelcomePage />
}

export default function App() {
  if (!isConfigured) return <ConfigurationMissing />

  return (
    <Routes>
      <Route path="/welcome" element={<WelcomeRoute />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/settings/providers" element={<ProvidersSettingsPage />} />
        <Route path="/settings/security" element={<SecuritySettingsPage />} />
        <Route path="/settings/sessions" element={<SessionsSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
