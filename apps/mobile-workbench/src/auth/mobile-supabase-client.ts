import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

import {
  getMobileRuntimeConfig,
  type MobileRuntimeConfig,
} from '../api/mobile-config'

export function isMobileSupabaseConfigured(
  config: MobileRuntimeConfig = getMobileRuntimeConfig(),
): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

export function createMobileSupabaseClient(
  config: MobileRuntimeConfig = getMobileRuntimeConfig(),
): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}
