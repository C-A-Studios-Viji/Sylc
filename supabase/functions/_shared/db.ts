import { createClient, type SupabaseClient } from './deps.ts'
import { getSupabaseSecretKey, getSupabaseUrl } from './env.ts'

export function adminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getPublicProfile(client: SupabaseClient, profileId: string) {
  const [
    { data: profile, error: profileError },
    { data: preferences, error: preferencesError },
    { data: credentials, error: credentialsError },
  ] = await Promise.all([
    client
      .from('profiles')
      .select('id,display_name,created_at,deleted_at')
      .eq('id', profileId)
      .maybeSingle(),
    client
      .from('profile_preferences')
      .select(
        'selected_provider,selected_model_openrouter,selected_model_mistral,theme,temperature,max_tokens',
      )
      .eq('profile_id', profileId)
      .maybeSingle(),
    client
      .from('provider_credentials')
      .select('provider,status,updated_at,last_validated_at')
      .eq('profile_id', profileId),
  ])

  if (profileError || preferencesError || credentialsError) throw new Error('PROFILE_READ_FAILED')
  if (!profile || profile.deleted_at) throw new Error('PROFILE_NOT_FOUND')

  const byProvider = new Map((credentials ?? []).map((item) => [item.provider, item]))
  const providerRows = (['openrouter', 'mistral'] as const).map((provider) => {
    const row = byProvider.get(provider)
    return {
      provider,
      connected: Boolean(row),
      status: row?.status ?? 'unknown',
      updatedAt: row?.updated_at ?? undefined,
      lastValidatedAt: row?.last_validated_at ?? undefined,
    }
  })

  return {
    id: profile.id,
    displayName: profile.display_name,
    createdAt: profile.created_at,
    providers: providerRows,
    preferences: {
      selectedProvider: preferences?.selected_provider ?? 'openrouter',
      selectedModelOpenrouter: preferences?.selected_model_openrouter ?? null,
      selectedModelMistral: preferences?.selected_model_mistral ?? null,
      theme: preferences?.theme ?? 'light',
      temperature: Number(preferences?.temperature ?? 0.7),
      maxTokens: preferences?.max_tokens ?? 4096,
    },
  }
}
