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
  | 'sending_code'
  | 'verifying_code'
  | 'binding_phone'
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
  requestPhoneLoginCode(phone: string, shouldCreateUser?: boolean): Promise<boolean>
  verifyPhoneLoginCode(params: { phone: string; otp: string }): Promise<boolean>
  requestPhoneBindingCode(phone: string): Promise<boolean>
  verifyPhoneBindingCode(params: { phone: string; otp: string }): Promise<boolean>
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

  const requestPhoneLoginCode = useCallback(async (
    phone: string,
    shouldCreateUser = false,
  ): Promise<boolean> => {
    if (!client) {
      setStatus('config_missing')
      setErrorMessage('missing_mobile_supabase_config')
      return false
    }

    setStatus('sending_code')
    setErrorMessage(null)
    try {
      const { error } = await client.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser },
      })
      setStatus('signed_out')
      if (error) {
        setErrorMessage(error.message)
        return false
      }
      return true
    } catch (error) {
      setStatus('error')
      setErrorMessage(getErrorMessage(error, 'mobile_phone_code_request_failed'))
      return false
    }
  }, [client])

  const verifyPhoneLoginCode = useCallback(async (
    params: { phone: string; otp: string },
  ): Promise<boolean> => {
    if (!client) {
      setStatus('config_missing')
      setErrorMessage('missing_mobile_supabase_config')
      return false
    }

    setStatus('verifying_code')
    setErrorMessage(null)
    try {
      const { data, error } = await client.auth.verifyOtp({
        phone: params.phone,
        token: params.otp,
        type: 'sms',
      })
      if (error || !data.session || !data.user) {
        setStatus('signed_out')
        setErrorMessage(error?.message || 'mobile_phone_verification_failed')
        return false
      }

      setSession(data.session)
      setUser(data.user)
      setStatus('signed_in')
      return true
    } catch (error) {
      setStatus('error')
      setErrorMessage(getErrorMessage(error, 'mobile_phone_verification_failed'))
      return false
    }
  }, [client])

  const requestPhoneBindingCode = useCallback(async (phone: string): Promise<boolean> => {
    if (!client || !user) {
      setErrorMessage('auth_required')
      return false
    }

    setStatus('binding_phone')
    setErrorMessage(null)
    try {
      const { error } = await client.auth.updateUser({ phone })
      setStatus('signed_in')
      if (error) {
        setErrorMessage(error.message)
        return false
      }
      return true
    } catch (error) {
      setStatus('signed_in')
      setErrorMessage(getErrorMessage(error, 'mobile_phone_binding_request_failed'))
      return false
    }
  }, [client, user])

  const verifyPhoneBindingCode = useCallback(async (
    params: { phone: string; otp: string },
  ): Promise<boolean> => {
    if (!client || !user) {
      setErrorMessage('auth_required')
      return false
    }

    const originalUserId = user.id
    setStatus('binding_phone')
    setErrorMessage(null)
    try {
      const { error } = await client.auth.verifyOtp({
        phone: params.phone,
        token: params.otp,
        type: 'phone_change',
      })
      if (error) {
        setStatus('signed_in')
        setErrorMessage(error.message)
        return false
      }

      const { data, error: refreshError } = await client.auth.getUser()
      if (refreshError || !data.user || data.user.id !== originalUserId) {
        setStatus('signed_in')
        setErrorMessage('mobile_phone_binding_identity_mismatch')
        return false
      }

      setUser(data.user)
      setStatus('signed_in')
      return true
    } catch (error) {
      setStatus('signed_in')
      setErrorMessage(getErrorMessage(error, 'mobile_phone_binding_failed'))
      return false
    }
  }, [client, user])

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
    requestPhoneLoginCode,
    verifyPhoneLoginCode,
    requestPhoneBindingCode,
    verifyPhoneBindingCode,
    signOut,
  }
}
