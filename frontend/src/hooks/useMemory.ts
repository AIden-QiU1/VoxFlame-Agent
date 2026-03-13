/**
 * useMemory Hook
 * React hook for memory service with auth integration
 */

import { useEffect, useCallback, useState } from 'react'
import { memoryService, Memory, Session, ConversationTurn } from '@/lib/memory/memory-service'
import { useAuth } from './useAuth'
import { getAnonymousUserId } from '@/lib/identity/anonymous-user'

export interface UseMemoryReturn {
  isInitialized: boolean
  currentSession: Session | null
  memories: Memory[]
  stats: { totalSessions: number; totalTurns: number; totalMemories: number }
  addTurn: (role: 'user' | 'assistant', content: string, opts?: { originalText?: string }) => ConversationTurn
  endSession: () => Promise<void>
  search: (query: string, limit?: number) => Memory[]
  getRecentMemories: (limit?: number) => Memory[]
  getAllSessions: () => Session[]
}

export function useMemory(): UseMemoryReturn {
  const { userId, isAuthenticated } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)
  const [memories, setMemories] = useState<Memory[]>([])
  const [stats, setStats] = useState({ totalSessions: 0, totalTurns: 0, totalMemories: 0 })

  useEffect(() => {
    const ownerId = isAuthenticated && userId ? userId : getAnonymousUserId()
    if (!ownerId) {
      setIsInitialized(false)
      return
    }

    memoryService.init(ownerId)
    setIsInitialized(true)
    refreshStats()
    console.log('[useMemory] Initialized for owner:', ownerId)
  }, [isAuthenticated, userId])

  const refreshStats = useCallback(() => {
    const s = memoryService.getStats()
    setStats(s)
    setMemories(memoryService.getRecent(10))
  }, [])

  const addTurn = useCallback((role: 'user' | 'assistant', content: string, opts?: { originalText?: string }) => {
    const turn = memoryService.addTurn(role, content, opts)
    refreshStats()
    return turn
  }, [])

  const endSession = useCallback(async () => {
    await memoryService.endSession()
    refreshStats()
  }, [])

  const search = useCallback((query: string, limit = 10) => {
    return memoryService.search(query, limit)
  }, [])

  const getRecentMemories = useCallback((limit = 20) => {
    return memoryService.getRecent(limit)
  }, [])

  const getAllSessions = useCallback(() => {
    return memoryService.getAllSessions()
  }, [])

  return {
    isInitialized,
    currentSession: isInitialized ? memoryService.peekSession() : null,
    memories,
    stats,
    addTurn,
    endSession,
    search,
    getRecentMemories,
    getAllSessions,
  }
}

export default useMemory
