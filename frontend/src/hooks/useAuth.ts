/**
 * useAuth Hook
 * 统一的用户认证管理
 * 
 * 功能：
 * 1. 获取当前登录用户
 * 2. 提供 loading 状态
 * 3. 监听登录/登出事件
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface UseAuthOptions {
  /** 未登录时是否自动跳转到登录页 */
  redirectToLogin?: boolean
  /** 自定义登录页路径 */
  loginPath?: string
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
  const { redirectToLogin = false, loginPath = '/login' } = options
  
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

    // 获取当前用户
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
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
          setState({
            user: session.user,
            session: session,
            userId: session.user.id,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          })
        } else {
          console.log('[useAuth] 用户未登录')
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            isAuthenticated: false,
          }))
          
          // 如果需要跳转到登录页
          if (redirectToLogin) {
            console.log('[useAuth] 跳转到登录页:', loginPath)
            router.push(loginPath)
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

        if (event === 'SIGNED_IN' && session?.user) {
          setState({
            user: session.user,
            session: session,
            userId: session.user.id,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          })
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            session: null,
            userId: null,
            isLoading: false,
            isAuthenticated: false,
            error: null,
          })
          
          if (redirectToLogin) {
            router.push(loginPath)
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setState(prev => ({
            ...prev,
            session: session,
          }))
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [redirectToLogin, loginPath, router])

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
