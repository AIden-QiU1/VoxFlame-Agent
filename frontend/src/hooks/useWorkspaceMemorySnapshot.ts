'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StarterKitScene } from '@/lib/communication/starter-kit'
import type { WorkspaceMemorySnapshot } from '@/lib/memory/workspace-snapshot'
import { fetchWorkspaceSnapshot } from '@/lib/memory/workspace-client'

interface UseWorkspaceMemorySnapshotOptions {
  userId?: string | null
  isAuthenticated?: boolean
  sceneId?: StarterKitScene['id']
  enabled?: boolean
}

interface UseWorkspaceMemorySnapshotResult {
  snapshot: WorkspaceMemorySnapshot | null
  isLoading: boolean
  error: string | null
  refresh: (sceneId?: StarterKitScene['id']) => Promise<WorkspaceMemorySnapshot | null>
}

export function useWorkspaceMemorySnapshot({
  userId,
  isAuthenticated = false,
  sceneId,
  enabled = true,
}: UseWorkspaceMemorySnapshotOptions): UseWorkspaceMemorySnapshotResult {
  const [snapshot, setSnapshot] = useState<WorkspaceMemorySnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(userId && isAuthenticated && enabled))
  const [error, setError] = useState<string | null>(null)
  const requestSequenceRef = useRef(0)

  const refresh = useCallback(async (nextSceneId = sceneId) => {
    if (!enabled || !userId || !isAuthenticated) {
      setSnapshot(null)
      setIsLoading(false)
      setError(null)
      return null
    }

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchWorkspaceSnapshot(userId, nextSceneId)
      if (requestSequenceRef.current === requestId) {
        setSnapshot(data)
        setIsLoading(false)
      }
      return data
    } catch (fetchError) {
      if (requestSequenceRef.current === requestId) {
        setError(fetchError instanceof Error ? fetchError.message : 'workspace_snapshot_failed')
        setIsLoading(false)
      }
      return null
    }
  }, [enabled, isAuthenticated, sceneId, userId])

  useEffect(() => {
    void refresh(sceneId)
  }, [refresh, sceneId])

  return {
    snapshot,
    isLoading,
    error,
    refresh,
  }
}
