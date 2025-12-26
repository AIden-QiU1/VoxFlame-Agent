/**
 * useContributor Hook
 * 
 * 管理贡献者身份，使用 localStorage 持久化匿名ID
 * 首次访问时自动生成，后续访问复用
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLES } from '@/lib/supabase/client'

const CONTRIBUTOR_KEY = 'ranyan_contributor_id'
const CONTRIBUTOR_NAME_KEY = 'ranyan_contributor_name'

export interface ContributorData {
  id: string
  anonymous_id: string
  displayName: string
  total_recordings: number
  total_duration_seconds: number
  age_range?: string
  etiology?: string
  severity?: string
}

/**
 * 生成友好的随机昵称
 */
function generateFriendlyName(): string {
  const adjectives = ['温暖', '勇敢', '闪亮', '可爱', '开心', '友善', '活力', '阳光']
  const nouns = ['星星', '小鱼', '小鸟', '蜜蜂', '蝴蝶', '小熊', '小兔', '小猫']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 100)
  return `${adj}的${noun}${num}`
}

/**
 * 生成简短的匿名ID
 */
function generateAnonymousId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `v_${id}`
}

export function useContributor() {
  const [contributor, setContributor] = useState<ContributorData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 初始化或获取贡献者
  const initContributor = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. 检查 localStorage 中是否有已存储的 ID
      let anonymousId = localStorage.getItem(CONTRIBUTOR_KEY)
      let displayName = localStorage.getItem(CONTRIBUTOR_NAME_KEY)
      
      if (!anonymousId) {
        // 2. 生成新的匿名 ID 和昵称
        anonymousId = generateAnonymousId()
        displayName = generateFriendlyName()
        localStorage.setItem(CONTRIBUTOR_KEY, anonymousId)
        localStorage.setItem(CONTRIBUTOR_NAME_KEY, displayName)
      }
      
      if (!displayName) {
        displayName = generateFriendlyName()
        localStorage.setItem(CONTRIBUTOR_NAME_KEY, displayName)
      }

      // 3. 检查 Supabase 中是否存在该贡献者
      const { data: existing, error: fetchError } = await supabase
        .from(TABLES.CONTRIBUTORS)
        .select('*')
        .eq('anonymous_id', anonymousId)
        .single()

      if (existing && !fetchError) {
        const contributorData: ContributorData = {
          ...existing,
          displayName,
        }
        setContributor(contributorData)
        return contributorData
      }

      // 4. 如果不存在，创建新贡献者
      const { data: newContributor, error: insertError } = await supabase
        .from(TABLES.CONTRIBUTORS)
        .insert({
          anonymous_id: anonymousId,
        })
        .select()
        .single()

      if (insertError) {
        // 如果插入失败（可能是 Supabase 未配置），使用本地模式
        console.warn('Supabase 未配置或连接失败，使用本地模式:', insertError)
        const localContributor: ContributorData = {
          id: anonymousId,
          anonymous_id: anonymousId,
          displayName,
          total_recordings: 0,
          total_duration_seconds: 0,
        }
        setContributor(localContributor)
        return localContributor
      }

      const contributorData: ContributorData = {
        ...newContributor,
        displayName,
      }
      setContributor(contributorData)
      return contributorData

    } catch (err) {
      console.error('初始化贡献者失败:', err)
      // 即使出错也返回一个本地贡献者对象
      const fallbackId = localStorage.getItem(CONTRIBUTOR_KEY) || generateAnonymousId()
      const fallbackName = localStorage.getItem(CONTRIBUTOR_NAME_KEY) || generateFriendlyName()
      localStorage.setItem(CONTRIBUTOR_KEY, fallbackId)
      localStorage.setItem(CONTRIBUTOR_NAME_KEY, fallbackName)
      
      const localContributor: ContributorData = {
        id: fallbackId,
        anonymous_id: fallbackId,
        displayName: fallbackName,
        total_recordings: 0,
        total_duration_seconds: 0,
      }
      setContributor(localContributor)
      setError('无法连接到服务器，数据将暂存本地')
      return localContributor
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 更新昵称
  const updateDisplayName = useCallback((name: string) => {
    localStorage.setItem(CONTRIBUTOR_NAME_KEY, name)
    setContributor(prev => prev ? { ...prev, displayName: name } : null)
  }, [])

  // 更新贡献者信息（如填写年龄范围等）
  const updateProfile = useCallback(async (updates: Partial<ContributorData>) => {
    if (!contributor) return

    try {
      const { displayName, ...dbUpdates } = updates
      
      // 更新 localStorage 中的昵称
      if (displayName) {
        localStorage.setItem(CONTRIBUTOR_NAME_KEY, displayName)
      }
      
      // 更新数据库（不包括 displayName）
      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from(TABLES.CONTRIBUTORS)
          .update(dbUpdates)
          .eq('id', contributor.id)

        if (error) {
          console.warn('更新数据库失败:', error)
        }
      }
      
      setContributor(prev => prev ? { ...prev, ...updates } : null)
    } catch (err) {
      console.error('更新贡献者信息失败:', err)
    }
  }, [contributor])

  // 刷新统计数据
  const refreshStats = useCallback(async () => {
    if (!contributor) return

    try {
      const { data, error } = await supabase
        .from(TABLES.CONTRIBUTORS)
        .select('total_recordings, total_duration_seconds')
        .eq('id', contributor.id)
        .single()

      if (!error && data) {
        setContributor(prev => prev ? { ...prev, ...data } : null)
      }
    } catch (err) {
      console.error('刷新统计失败:', err)
    }
  }, [contributor])

  // 组件挂载时初始化
  useEffect(() => {
    initContributor()
  }, [initContributor])

  return {
    contributor,
    isLoading,
    error,
    updateProfile,
    updateDisplayName,
    refreshStats,
    contributorId: contributor?.id || null,
    anonymousId: contributor?.anonymous_id || null,
    displayName: contributor?.displayName || '访客',
  }
}
