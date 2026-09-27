function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required server environment variable: ${name}`)
  return value
}

export function getSupabaseUrl(): string {
  return required('SUPABASE_URL')
}

export function getSupabaseSecretKey(): string {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, string>
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (first) return first
    } catch {
      // Fall through to the legacy injected key.
    }
  }
  return required('SUPABASE_SERVICE_ROLE_KEY')
}

export function getVaultEncryptionKey(): string {
  return required('VAULT_ENCRYPTION_KEY')
}

export function getAccessCodePepper(): string {
  return required('ACCESS_CODE_PEPPER')
}

export function getRateLimitPepper(): string {
  return required('RATE_LIMIT_PEPPER')
}

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173'
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
