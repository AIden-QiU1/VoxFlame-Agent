/**
 * Supabase 客户端配置
 * 用于数据收集页面的音频存储和元数据记录
 */
import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

// 从环境变量读取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

if (!hasSupabaseConfig) {
  console.warn('⚠️ Supabase 配置缺失，客户端功能受限')
}

// 创建 Supabase 客户端（Singleton）
let supabaseInstance: SupabaseClient | null = null

/**
 * 获取 Supabase 客户端实例 (Browser)
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!hasSupabaseConfig) return null

  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

/**
 * 通用创建函数 (供新代码使用)
 */
export const createClient = () => {
  const client = getSupabase()
  if (client) {
    return client
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

/**
 * 获取有效的 Access Token
 * 自动处理 token 过期和刷新
 *
 * @returns 返回有效的 access_token，如果用户未登录则返回 null
 */
export async function getValidToken(): Promise<string | null> {
  const client = getSupabase()
  if (!client) return null

  try {
    // getSession() 会自动刷新过期的 token
    const { data: { session }, error } = await client.auth.getSession()

    if (error) {
      console.error('[getValidToken] 获取 session 失败:', error)
      return null
    }

    if (!session) {
      console.warn('[getValidToken] 用户未登录')
      return null
    }

    // 检查 token 是否即将过期（5分钟内）
    const expiresAt = session.expires_at
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt - now

      if (timeUntilExpiry < 300) {
        // Token 即将过期，手动刷新
        console.log('[getValidToken] Token 即将过期，正在刷新...')
        const { data: { session: newSession }, error: refreshError } =
          await client.auth.refreshSession()

        if (refreshError) {
          console.error('[getValidToken] 刷新 token 失败:', refreshError)
          // 返回旧 token，让服务器处理过期
          return session.access_token
        }

        return newSession?.access_token || session.access_token
      }
    }

    return session.access_token
  } catch (e) {
    console.error('[getValidToken] 异常:', e)
    return null
  }
}

export async function getFreshSession() {
  const client = getSupabase()
  if (!client) {
    return null
  }

  const { data, error } = await client.auth.getSession()
  if (error) {
    console.error('[getFreshSession] 获取 session 失败:', error)
    return null
  }

  return data.session ?? null
}

// 为了向后兼容，导出一个代理对象
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase()
    if (prop === 'then') return undefined; // Avoid Promise-like behavior check issues
    if (!client) {
      if (typeof prop === 'string' && prop !== 'auth') {
        console.warn(`Supabase not configured, accessing ${String(prop)}`)
      }
      return undefined
    }
    return (client as any)[prop]
  }
})
