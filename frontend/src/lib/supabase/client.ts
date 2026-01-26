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
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
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

// 存储桶名称
export const AUDIO_BUCKET = 'voice-contributions'

// 数据库表名
export const TABLES = {
  CONTRIBUTIONS: 'voice_contributions',
  CONTRIBUTORS: 'contributors',
  CORPUS: 'corpus_sentences',
} as const

/**
 * 检查 Supabase 是否已配置
 */
export function isSupabaseConfigured(): boolean {
  return hasSupabaseConfig
}

/**
 * 上传音频文件到 Supabase Storage
 */
export async function uploadAudio(
  audioBlob: Blob,
  contributorId: string,
  filename: string
): Promise<{ path: string; error: Error | null }> {
  const client = getSupabase()
  if (!client) {
    return { path: '', error: new Error('Supabase not configured') }
  }

  const path = `${contributorId}/${filename}`

  const { data, error } = await client.storage
    .from(AUDIO_BUCKET)
    .upload(path, audioBlob, {
      contentType: 'audio/wav',
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('上传音频失败:', error)
    return { path: '', error: error as Error }
  }

  return { path: data.path, error: null }
}

/**
 * 保存语音贡献记录
 */
export interface VoiceContribution {
  contributor_id: string
  audio_path: string
  transcript: string
  sentence_id?: string
  duration_seconds: number
  is_free_recording: boolean
  metadata?: {
    age_range?: string
    etiology?: string
    severity?: string
    device_info?: string
  }
}

export async function saveContribution(contribution: VoiceContribution) {
  const client = getSupabase()
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data, error } = await client
    .from(TABLES.CONTRIBUTIONS)
    .insert({
      ...contribution,
      created_at: new Date().toISOString(),
    })
    .select()

  if (error) {
    console.error('保存贡献记录失败:', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * 获取或创建贡献者
 */
export async function getOrCreateContributor(anonymousId: string) {
  const client = getSupabase()
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  // 先查询是否存在
  const { data: existing } = await client
    .from(TABLES.CONTRIBUTORS)
    .select('*')
    .eq('anonymous_id', anonymousId)
    .single()

  if (existing) {
    return { data: existing, error: null }
  }

  // 创建新贡献者
  const { data, error } = await client
    .from(TABLES.CONTRIBUTORS)
    .insert({
      anonymous_id: anonymousId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  return { data, error }
}

/**
 * 更新贡献者统计
 */
export async function updateContributorStats(
  contributorId: string,
  durationToAdd: number
) {
  const client = getSupabase()
  if (!client) {
    return { error: new Error('Supabase not configured') }
  }

  const { error } = await client.rpc('increment_contributor_stats', {
    p_contributor_id: contributorId,
    p_duration: durationToAdd,
  })

  return { error }
}

/**
 * 获取语料句子列表
 */
export async function getCorpusSentences() {
  const client = getSupabase()
  if (!client) {
    return { data: [], error: new Error('Supabase not configured') }
  }

  const { data, error } = await client
    .from(TABLES.CORPUS)
    .select('*')
    .order('order_index', { ascending: true })

  return { data, error }
}

/**
 * 获取社区统计数据
 */
export async function getCommunityStats() {
  const client = getSupabase()
  if (!client) {
    return {
      data: {
        total_contributors: 0,
        total_recordings: 0,
        total_duration_hours: 0,
      },
      error: new Error('Supabase not configured')
    }
  }

  const { data, error } = await client.rpc('get_community_stats')

  return {
    data: data || {
      total_contributors: 0,
      total_recordings: 0,
      total_duration_hours: 0,
    },
    error
  }
}
