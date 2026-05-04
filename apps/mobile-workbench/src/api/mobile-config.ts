type ExpoProcess = {
  env?: Record<string, string | undefined>
}

declare const process: ExpoProcess | undefined

export interface MobileRuntimeConfig {
  apiBaseUrl: string | null
  supabaseUrl: string | null
  supabaseAnonKey: string | null
}

function readPublicEnv(name: string): string | null {
  const value = process?.env?.[name]?.trim()
  return value || null
}

export function getMobileRuntimeConfig(): MobileRuntimeConfig {
  return {
    apiBaseUrl: readPublicEnv('EXPO_PUBLIC_API_BASE_URL'),
    supabaseUrl: readPublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: readPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

export function requireMobileApiBaseUrl(config: MobileRuntimeConfig): string {
  if (!config.apiBaseUrl) {
    throw new Error('missing_EXPO_PUBLIC_API_BASE_URL')
  }

  return config.apiBaseUrl.replace(/\/$/, '')
}
