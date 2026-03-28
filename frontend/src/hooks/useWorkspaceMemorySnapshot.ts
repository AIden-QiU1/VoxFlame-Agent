'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '@/lib/config'
import type { StarterKitScene } from '@/lib/communication/starter-kit'
import { getValidToken } from '@/lib/supabase/client'
import type { WorkspaceMemorySnapshot } from '@/lib/memory/workspace-snapshot'

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

function buildWorkspaceSnapshotUrl(userId: string, sceneId?: StarterKitScene['id']): string {
  const params = new URLSearchParams()
  if (sceneId) {
    params.set('scene', sceneId)
  }

  return `${config.api.baseUrl}/memory/workspace/${userId}${params.size > 0 ? `?${params.toString()}` : ''}`
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
      const token = await getValidToken()
      if (!token) {
        if (requestSequenceRef.current === requestId) {
          setSnapshot(null)
          setIsLoading(false)
        }
        return null
      }

      const response = await fetch(buildWorkspaceSnapshotUrl(userId, nextSceneId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`workspace_snapshot_${response.status}`)
      }

      const data = await response.json() as WorkspaceMemorySnapshot
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
