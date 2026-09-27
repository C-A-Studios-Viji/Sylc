import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(
  join(root, 'supabase/migrations/20260927143000_initial_sylc.sql'),
  'utf8',
)

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

describe('security invariants', () => {
  it('never defines a plaintext access-code column', () => {
    const accessTable =
      migration.match(/create table public\.profile_access_codes \(([\s\S]*?)\n\);/)?.[1] ?? ''
    expect(accessTable).toContain('lookup_hash')
    expect(accessTable).toContain('verifier_hash')
    expect(accessTable).not.toMatch(/\baccess_code\b|\bplaintext\b|\bcode\s+text\b/i)
  })

  it('stores provider credentials as ciphertext and IV only', () => {
    const credentialTable =
      migration.match(/create table public\.provider_credentials \(([\s\S]*?)\n\);/)?.[1] ?? ''
    expect(credentialTable).toContain('ciphertext')
    expect(credentialTable).toContain('iv')
    expect(credentialTable).not.toMatch(/\bapi_key\b|\bsecret_key\b|\bplaintext\b/i)
  })

  it('enables RLS and denies direct browser-role table access', () => {
    for (const table of [
      'profiles',
      'profile_access_codes',
      'provider_credentials',
      'profile_preferences',
      'profile_sessions',
      'conversations',
      'messages',
      'rate_limit_events',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`)
      expect(migration).toContain(`revoke all on table public.${table} from anon, authenticated;`)
    }
  })

  it('uses an atomic database rate-limit consumer', () => {
    expect(migration).toContain('create or replace function public.consume_sylc_rate_limit')
    expect(migration).toContain('pg_advisory_xact_lock')
  })

  it('does not log inside Edge Function source files', () => {
    const sources = filesUnder(join(root, 'supabase/functions')).filter((path) =>
      path.endsWith('.ts'),
    )
    for (const path of sources)
      expect(readFileSync(path, 'utf8'), path).not.toMatch(
        /console\.(log|info|debug|warn|error)\s*\(/,
      )
  })

  it('does not put server secrets in VITE variables', () => {
    const env = readFileSync(join(root, '.env.example'), 'utf8')
    expect(env).not.toMatch(/^VITE_.*(?:VAULT|PEPPER|OPENROUTER|MISTRAL|SERVICE_ROLE|SECRET)/m)
  })
})
