const SESSION_KEY = 'sylc.profile.session.v1'

export interface StoredSession {
  token: string
  profileId: string
}

export function loadSession(): StoredSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<StoredSession>
    if (!parsed.token || !parsed.profileId) return null
    return { token: parsed.token, profileId: parsed.profileId }
  } catch {
    return null
  }
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
