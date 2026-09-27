import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getProfile } from './api'
import { clearSession, loadSession, saveSession } from './session'
import type { SylcProfile } from '../types/api'

interface ProfileContextValue {
  profile: SylcProfile | null
  pendingAccessCode: string | null
  loading: boolean
  setAuthenticatedProfile: (profile: SylcProfile, token: string) => void
  setPendingAccessCode: (code: string | null) => void
  replaceProfile: (profile: SylcProfile) => void
  signOutLocal: () => void
  refreshProfile: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<SylcProfile | null>(null)
  const [pendingAccessCode, setPendingAccessCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(loadSession()))

  const signOutLocal = useCallback(() => {
    clearSession()
    setPendingAccessCode(null)
    setProfile(null)
    setLoading(false)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!loadSession()) {
      setProfile(null)
      setLoading(false)
      return
    }
    try {
      const { profile: next } = await getProfile()
      setProfile(next)
    } catch {
      signOutLocal()
    } finally {
      setLoading(false)
    }
  }, [signOutLocal])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      pendingAccessCode,
      loading,
      setPendingAccessCode,
      setAuthenticatedProfile(nextProfile, token) {
        saveSession({ token, profileId: nextProfile.id })
        setProfile(nextProfile)
        setLoading(false)
      },
      replaceProfile: setProfile,
      signOutLocal,
      refreshProfile,
    }),
    [profile, pendingAccessCode, loading, signOutLocal, refreshProfile],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

// This hook belongs to the provider module so consumers share its context instance.
// eslint-disable-next-line react-refresh/only-export-components
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfile must be used inside ProfileProvider')
  return context
}
