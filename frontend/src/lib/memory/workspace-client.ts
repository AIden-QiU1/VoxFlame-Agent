'use client'

import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import type { StarterKitScene } from '@/lib/communication/starter-kit'
import type { CommunicationPreferences } from '@/lib/communication/communication-preferences'
import type { WorkspaceMemorySnapshot } from '@/lib/memory/workspace-snapshot'

function buildWorkspaceSnapshotUrl(
  userId: string,
  sceneId?: StarterKitScene['id'],
): string {
  const params = new URLSearchParams()
  if (sceneId) {
    params.set('scene', sceneId)
  }

  return `${config.api.baseUrl}/memory/workspace/${userId}${params.size > 0 ? `?${params.toString()}` : ''}`
}

export async function fetchWorkspaceSnapshot(
  userId: string,
  sceneId?: StarterKitScene['id'],
): Promise<WorkspaceMemorySnapshot | null> {
  const token = await getValidToken()
  if (!token) {
    return null
  }

  const response = await fetch(buildWorkspaceSnapshotUrl(userId, sceneId), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`workspace_snapshot_${response.status}`)
  }

  return await response.json() as WorkspaceMemorySnapshot
}

export async function saveWorkspaceCommunicationPreferences(
  userId: string,
  communicationPreferences: CommunicationPreferences,
): Promise<CommunicationPreferences | null> {
  const token = await getValidToken()
  if (!token) {
    return null
  }

  const response = await fetch(`${config.api.baseUrl}/memory/workspace/${userId}/preferences`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      communication_preferences: communicationPreferences,
    }),
  })

  if (!response.ok) {
    throw new Error(`workspace_preferences_${response.status}`)
  }

  const data = await response.json() as {
    communication_preferences?: CommunicationPreferences
  }

  return data.communication_preferences ?? communicationPreferences
}
