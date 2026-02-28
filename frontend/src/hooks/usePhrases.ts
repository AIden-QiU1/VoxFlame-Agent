/**
 * usePhrases Hook
 *
 * 管理常用短语的 React Hook
 * 提供 CRUD 操作和本地缓存
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient, getValidToken } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import type {
  QuickPhrase,
  CreatePhraseDTO,
  UpdatePhraseDTO,
  PhraseCategory
} from '@/lib/types/phrases'

export interface UsePhrasesOptions {
  autoLoad?: boolean
  userId?: string
}

export interface PhrasesState {
  phrases: QuickPhrase[]
  isLoading: boolean
  error: string | null
  selectedCategory: PhraseCategory | 'all'
}

export function usePhrases(options: UsePhrasesOptions = {}) {
  const { autoLoad = true, userId } = options

  const [state, setState] = useState<PhrasesState>({
    phrases: [],
    isLoading: false,
    error: null,
    selectedCategory: 'all'
  })

  // 获取当前用户 ID
  const getCurrentUserId = useCallback(async (): Promise<string | null> => {
    if (userId) return userId

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  }, [userId])

  // API 请求辅助函数
  const apiRequest = useCallback(async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> => {
    const token = await getValidToken()
    const url = `${config.api.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }))
      throw new Error(error.error || error.message || '请求失败')
    }

    return response.json()
  }, [])

  // 加载用户短语
  const loadPhrases = useCallback(async (category?: PhraseCategory | 'all') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const currentUserId = await getCurrentUserId()
      if (!currentUserId) {
        throw new Error('未登录')
      }

      const categoryParam = category && category !== 'all' ? `?category=${category}` : ''
      const data = await apiRequest(`/phrases/user/${currentUserId}${categoryParam}`)

      setState(prev => ({
        ...prev,
        phrases: data.phrases || [],
        isLoading: false,
        selectedCategory: category || 'all'
      }))
    } catch (error) {
      console.error('Failed to load phrases:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '加载失败'
      }))
    }
  }, [apiRequest, getCurrentUserId])

  // 创建短语
  const createPhrase = useCallback(async (dto: CreatePhraseDTO): Promise<QuickPhrase | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const currentUserId = await getCurrentUserId()
      if (!currentUserId) {
        throw new Error('未登录')
      }

      const data = await apiRequest('/phrases', {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUserId,
          ...dto
        })
      })

      // 刷新列表
      await loadPhrases(state.selectedCategory)

      return data
    } catch (error) {
      console.error('Failed to create phrase:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '创建失败'
      }))
      return null
    }
  }, [apiRequest, getCurrentUserId, loadPhrases, state.selectedCategory])

  // 更新短语
  const updatePhrase = useCallback(async (
    phraseId: string,
    dto: UpdatePhraseDTO
  ): Promise<QuickPhrase | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await apiRequest(`/phrases/${phraseId}`, {
        method: 'PUT',
        body: JSON.stringify(dto)
      })

      // 更新本地状态
      setState(prev => ({
        ...prev,
        phrases: prev.phrases.map(p =>
          p.id === phraseId ? { ...p, ...data } : p
        ),
        isLoading: false
      }))

      return data
    } catch (error) {
      console.error('Failed to update phrase:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '更新失败'
      }))
      return null
    }
  }, [apiRequest])

  // 删除短语
  const deletePhrase = useCallback(async (phraseId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      await apiRequest(`/phrases/${phraseId}`, {
        method: 'DELETE'
      })

      // 更新本地状态
      setState(prev => ({
        ...prev,
        phrases: prev.phrases.filter(p => p.id !== phraseId),
        isLoading: false
      }))

      return true
    } catch (error) {
      console.error('Failed to delete phrase:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '删除失败'
      }))
      return false
    }
  }, [apiRequest])

  // 记录使用
  const incrementUsage = useCallback(async (phraseId: string): Promise<void> => {
    try {
      await apiRequest(`/phrases/${phraseId}/use`, {
        method: 'POST'
      })

      // 更新本地状态
      setState(prev => ({
        ...prev,
        phrases: prev.phrases.map(p =>
          p.id === phraseId
            ? { ...p, usage_count: (p.usage_count || 0) + 1, last_used_at: new Date().toISOString() }
            : p
        )
      }))
    } catch (error) {
      console.error('Failed to increment usage:', error)
      // 静默失败，不影响用户体验
    }
  }, [apiRequest])

  // 批量重排
  const reorderPhrases = useCallback(async (
    phraseOrders: Array<{ id: string; order_index: number }>
  ): Promise<boolean> => {
    try {
      await apiRequest('/phrases/reorder', {
        method: 'POST',
        body: JSON.stringify({ phrase_orders: phraseOrders })
      })

      return true
    } catch (error) {
      console.error('Failed to reorder phrases:', error)
      return false
    }
  }, [apiRequest])

  // 初始化预设短语
  const initializePresets = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const currentUserId = await getCurrentUserId()
      if (!currentUserId) {
        throw new Error('未登录')
      }

      await apiRequest('/phrases/presets/initialize', {
        method: 'POST',
        body: JSON.stringify({ user_id: currentUserId })
      })

      // 刷新列表
      await loadPhrases(state.selectedCategory)

      return true
    } catch (error) {
      console.error('Failed to initialize presets:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '初始化失败'
      }))
      return false
    }
  }, [apiRequest, getCurrentUserId, loadPhrases, state.selectedCategory])

  // 按分类筛选
  const filterByCategory = useCallback((category: PhraseCategory | 'all') => {
    setState(prev => ({ ...prev, selectedCategory: category }))
    loadPhrases(category)
  }, [loadPhrases])

  // 获取分类统计
  const getCategoryStats = useCallback(() => {
    const stats: Record<string, number> = {}
    state.phrases.forEach(phrase => {
      stats[phrase.category] = (stats[phrase.category] || 0) + 1
    })
    return stats
  }, [state.phrases])

  // 获取最常用短语
  const getMostUsed = useCallback((limit: number = 5) => {
    return [...state.phrases]
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, limit)
  }, [state.phrases])

  // 自动加载
  useEffect(() => {
    if (autoLoad) {
      loadPhrases()
    }
  }, [autoLoad, loadPhrases])

  return {
    ...state,
    loadPhrases,
    createPhrase,
    updatePhrase,
    deletePhrase,
    incrementUsage,
    reorderPhrases,
    initializePresets,
    filterByCategory,
    getCategoryStats,
    getMostUsed
  }
}

export default usePhrases
