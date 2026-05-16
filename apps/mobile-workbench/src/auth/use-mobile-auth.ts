import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type {
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js'

import type { MobileRuntimeConfig } from '../api/mobile-config'
import type { MobileAuthTokenProvider } from '../api/mobile-workbench-client'
import {
  clearLastAuthEmail,
  readLastAuthEmail,
  rememberLastAuthEmail,
} from './mobile-auth-hint-storage'
import { createMobileSupabaseClient } from './mobile-supabase-client'

export type MobileAuthStatus =
  | 'config_missing'
  | 'initializing'
  | 'signed_out'
  | 'signed_in'
  | 'signing_in'
  | 'signing_out'
  | 'error'

export interface MobileAuthState {
  client: SupabaseClient | null
  user: User | null
  session: Session | null
  status: MobileAuthStatus
  errorMessage: string | null
  lastEmail: string
  tokenProvider: MobileAuthTokenProvider
  signInWithPassword(params: {
    email: string
    password: string
  }): Promise<boolean>
  signOut(): Promise<void>
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export function useMobileAuth(config: MobileRuntimeConfig): MobileAuthState {
  const client = useMemo(() => createMobileSupabaseClient(config), [
    config.supabaseAnonKey,
    config.supabaseUrl,
  ])
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<MobileAuthStatus>(
    client ? 'initializing' : 'config_missing',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState('')

  useEffect(() => {
    let isMounted = true

    void readLastAuthEmail().then((email) => {
      if (!isMounted || !email) {
        return
      }

      setLastEmail(email)
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!client) {
      setStatus('config_missing')
      setUser(null)
      setSession(null)
      return undefined
    }

    let isMounted = true

    void client.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
        setStatus('error')
        return
      }

      const currentSession = data.session ?? null
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setStatus(currentSession ? 'signed_in' : 'signed_out')
    })

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setStatus(nextSession ? 'signed_in' : 'signed_out')
      setErrorMessage(null)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const signInWithPassword = useCallback(async (
    params: { email: string; password: string },
  ): Promise<boolean> => {
    if (!client) {
      setStatus('config_missing')
      setErrorMessage('missing_mobile_supabase_config')
      return false
    }

    const email = params.email.trim().toLowerCase()
    const password = params.password
    if (!email || !password) {
      setStatus('signed_out')
      setErrorMessage('email_and_password_required')
      return false
    }

    setStatus('signing_in')
    setErrorMessage(null)

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setStatus('signed_out')
        setErrorMessage(error.message)
        return false
      }

      await rememberLastAuthEmail(email)
      setLastEmail(email)
      setSession(data.session)
      setUser(data.user)
      setStatus(data.session ? 'signed_in' : 'signed_out')
      return Boolean(data.session)
    } catch (error) {
      setStatus('error')
      setErrorMessage(getErrorMessage(error, 'mobile_sign_in_failed'))
      return false
    }
  }, [client])

  const signOut = useCallback(async (): Promise<void> => {
    if (!client) {
      setStatus('config_missing')
      return
    }

    setStatus('signing_out')
    setErrorMessage(null)

    try {
      await client.auth.signOut()
      await clearLastAuthEmail()
      setLastEmail('')
      setSession(null)
      setUser(null)
      setStatus('signed_out')
    } catch (error) {
      setStatus('error')
      setErrorMessage(getErrorMessage(error, 'mobile_sign_out_failed'))
    }
  }, [client])

  const tokenProvider = useMemo<MobileAuthTokenProvider>(() => ({
    async getAccessToken(): Promise<string | null> {
      if (!client) {
        return null
      }

      const { data, error } = await client.auth.getSession()
      if (error || !data.session) {
        return null
      }

      return data.session.access_token
    },
  }), [client])

  return {
    client,
    user,
    session,
    status,
    errorMessage,
    lastEmail,
    tokenProvider,
    signInWithPassword,
    signOut,
  }
}
