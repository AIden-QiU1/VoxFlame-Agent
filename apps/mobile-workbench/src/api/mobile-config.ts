export interface MobileRuntimeConfig {
  apiBaseUrl: string | null
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  phoneAuthEnabled: boolean
}

function normalizePublicEnv(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

export function getMobileRuntimeConfig(): MobileRuntimeConfig {
  return {
    // Expo only inlines EXPO_PUBLIC values when each property is accessed
    // statically. Computed-key environment reads leave release builds empty.
    apiBaseUrl: normalizePublicEnv(process.env.EXPO_PUBLIC_API_BASE_URL),
    supabaseUrl: normalizePublicEnv(process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: normalizePublicEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    phoneAuthEnabled: process.env.EXPO_PUBLIC_PHONE_AUTH_ENABLED === '1',
  }
}

export function requireMobileApiBaseUrl(config: MobileRuntimeConfig): string {
  if (!config.apiBaseUrl) {
    throw new Error('missing_EXPO_PUBLIC_API_BASE_URL')
  }

  return config.apiBaseUrl.replace(/\/$/, '')
}
