import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Spinner } from './components/Spinner'
import { isConfigured } from './lib/api'
import { useProfile } from './lib/profile-context'
import { ChatPage } from './pages/ChatPage'
import { ModelsPage } from './pages/ModelsPage'
import { PreviewPage } from './pages/PreviewPage'
import { ProvidersSettingsPage } from './pages/ProvidersSettingsPage'
import { SecuritySettingsPage } from './pages/SecuritySettingsPage'
import { SessionsSettingsPage } from './pages/SessionsSettingsPage'
import { WelcomePage } from './pages/WelcomePage'

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
  if (!isConfigured) return <PreviewPage />

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
