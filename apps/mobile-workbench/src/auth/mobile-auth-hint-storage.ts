import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const LAST_EMAIL_KEY = 'voxflame.mobile_workbench.last_email'

function readWebStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }

    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeWebStorage(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') {
      return
    }

    if (value) {
      localStorage.setItem(key, value)
      return
    }

    localStorage.removeItem(key)
  } catch {
    // Auth hints are convenience only; failures must not block sign-in/out.
  }
}

export async function readLastAuthEmail(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return readWebStorage(LAST_EMAIL_KEY)
  }

  try {
    return await SecureStore.getItemAsync(LAST_EMAIL_KEY)
  } catch {
    return null
  }
}

export async function rememberLastAuthEmail(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return
  }

  if (Platform.OS === 'web') {
    writeWebStorage(LAST_EMAIL_KEY, normalizedEmail)
    return
  }

  try {
    await SecureStore.setItemAsync(LAST_EMAIL_KEY, normalizedEmail)
  } catch {
    // The Supabase session itself is stored by the official RN adapter.
  }
}

export async function clearLastAuthEmail(): Promise<void> {
  if (Platform.OS === 'web') {
    writeWebStorage(LAST_EMAIL_KEY, null)
    return
  }

  try {
    await SecureStore.deleteItemAsync(LAST_EMAIL_KEY)
  } catch {
    // Best-effort cleanup.
  }
}
