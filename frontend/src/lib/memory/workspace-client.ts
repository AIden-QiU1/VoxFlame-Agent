'use client'

import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import type { StarterKitScene } from '@/lib/communication/starter-kit'
import type { CommunicationPreferences } from '@/lib/communication/communication-preferences'
import type { WorkspaceMemorySnapshot } from '@/lib/memory/workspace-snapshot'

export interface PreparedExpressionDraftAsset {
  id: string
  title: string
  scene: string | null
  source: string
  content: string
  updated_at: string
}

export interface PreparedExpressionStructuredSectionAsset {
  id: string
  title: string
  summary: string
  anchorLine: string
  practiceLines: string[]
  highRiskPhrases: string[]
  fallbackPhrases: string[]
  hotwords: string[]
  basePriority: number
}

export interface PreparedExpressionStructuredAsset {
  id: string
  title: string
  summary: string
  scene: string | null
  source: string
  hotwords: string[]
  highRiskPhrases: string[]
  fallbackPhrases: string[]
  sections: PreparedExpressionStructuredSectionAsset[]
}

export interface PreparedExpressionAsrHotwordEntryAsset {
  text: string
  weight: number
  lang: 'zh' | 'en'
}

export interface PreparedExpressionRehearsalSummaryAsset {
  summary: string
  hotwords: string[]
  recurringErrors: string[]
  pronunciationPatterns: string[]
  supportStrategies: string[]
  fallbackPhrases: string[]
  nextFocus: string[]
  asrHotwordEntries: PreparedExpressionAsrHotwordEntryAsset[]
  basedOnTrainingCount: number
  model: string
  updated_at: string
}

export interface PreparedExpressionAsset {
  draft: PreparedExpressionDraftAsset
  structured: PreparedExpressionStructuredAsset
  rehearsal_summary: PreparedExpressionRehearsalSummaryAsset | null
}

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

export async function fetchPreparedExpressionAsset(
  userId: string,
): Promise<PreparedExpressionAsset | null> {
  const token = await getValidToken()
  if (!token) {
    return null
  }

  const response = await fetch(`${config.api.baseUrl}/memory/workspace/${userId}/prepared-expression`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`prepared_expression_${response.status}`)
  }

  const data = await response.json() as {
    prepared_expression_asset?: PreparedExpressionAsset | null
  }

  return data.prepared_expression_asset ?? null
}

export async function savePreparedExpressionAsset(
  userId: string,
  input: {
    title?: string | null
    scene?: string | null
    source?: string | null
    content: string
  },
): Promise<PreparedExpressionAsset | null> {
  const token = await getValidToken()
  if (!token) {
    return null
  }

  const response = await fetch(`${config.api.baseUrl}/memory/workspace/${userId}/prepared-expression`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      ...input,
    }),
  })

  if (!response.ok) {
    throw new Error(`prepared_expression_save_${response.status}`)
  }

  const data = await response.json() as {
    prepared_expression_asset?: PreparedExpressionAsset | null
  }

  return data.prepared_expression_asset ?? null
}

export async function summarizePreparedExpressionAsset(
  userId: string,
  trigger: 'manual' | 'periodic_auto' = 'manual',
): Promise<PreparedExpressionAsset | null> {
  const token = await getValidToken()
  if (!token) {
    return null
  }

  const response = await fetch(`${config.api.baseUrl}/memory/workspace/${userId}/prepared-expression/summarize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      trigger,
    }),
  })

  if (!response.ok) {
    throw new Error(`prepared_expression_summarize_${response.status}`)
  }

  const data = await response.json() as {
    prepared_expression_asset?: PreparedExpressionAsset | null
  }

  return data.prepared_expression_asset ?? null
}
