/**
 * useAuth Hook
 * 统一的用户认证管理
 * 
 * 功能：
 * 1. 获取当前登录用户
 * 2. 提供 loading 状态
 * 3. 监听登录/登出事件
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { buildLoginPath, getCurrentPathWithSearch } from '@/lib/auth/navigation'
import { createClient } from '@/lib/supabase/client'

const AUTH_INIT_TIMEOUT_MS = 3000

export interface UseAuthOptions {
  /** 未登录时是否自动跳转到登录页 */
  redirectToLogin?: boolean
  /** 自定义登录页路径 */
  loginPath?: string
  /** 登录后回跳的目标页，默认使用当前地址 */
  nextPath?: string
  /** 初始鉴权超时时，是否先按游客态继续渲染 */
  timeoutBehavior?: 'wait' | 'guest'
}

export interface AuthState {
  user: User | null
  session: Session | null
  userId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  error: Error | null
}

export function useAuth(options: UseAuthOptions = {}): AuthState {
  const {
    redirectToLogin = false,
    loginPath = '/login',
    nextPath,
    timeoutBehavior = 'wait',
  } = options
  
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    userId: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })

  useEffect(() => {
    const supabase = createClient()

    const redirectToAuthPage = () => {
      const targetPath = nextPath ?? getCurrentPathWithSearch()
      router.replace(buildLoginPath(targetPath, loginPath))
    }

    const setAuthenticatedState = (session: Session) => {
      setState({
        user: session.user,
        session,
        userId: session.user.id,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      })
    }

    const setSignedOutState = () => {
      setState({
        user: null,
        session: null,
        userId: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      })
    }

    // 获取当前用户
    const getInitialSession = async () => {
      try {
        const sessionResult = timeoutBehavior === 'guest'
          ? await Promise.race([
              supabase.auth.getSession().then((result) => ({
                type: 'session' as const,
                result,
              })),
              new Promise<{ type: 'timeout' }>((resolve) => {
                window.setTimeout(() => resolve({ type: 'timeout' }), AUTH_INIT_TIMEOUT_MS)
              }),
            ])
          : {
              type: 'session' as const,
              result: await supabase.auth.getSession(),
            }

        if (sessionResult.type === 'timeout') {
          console.warn(`[useAuth] 初始化超时，${AUTH_INIT_TIMEOUT_MS}ms 后先以游客态继续渲染`)
          setState(prev => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
            error: null,
          }))
          return
        }

        const { data: { session }, error } = sessionResult.result
        
        if (error) {
          console.error('[useAuth] 获取 session 失败:', error)
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: error as Error 
          }))
          return
        }

        if (session?.user) {
          console.log('[useAuth] 用户已登录:', session.user.email)
          setAuthenticatedState(session)
        } else {
          console.log('[useAuth] 用户未登录')
          setSignedOutState()
          
          // 如果需要跳转到登录页
          if (redirectToLogin) {
            console.log('[useAuth] 跳转到登录页:', loginPath)
            redirectToAuthPage()
          }
        }
      } catch (err) {
        console.error('[useAuth] 初始化异常:', err)
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: err as Error 
        }))
      }
    }

    getInitialSession()

    // 监听认证状态变化
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] Auth 状态变化:', event)

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          setAuthenticatedState(session)
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session?.user)) {
          setSignedOutState()
          
          if (redirectToLogin) {
            redirectToAuthPage()
          }
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [loginPath, nextPath, redirectToLogin, router, timeoutBehavior])

  return state
}

/**
 * 获取用户 ID 的便捷函数
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * 获取当前用户的便捷函数
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export default useAuth
