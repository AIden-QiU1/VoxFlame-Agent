'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { config } from '@/lib/config'
import type { VoxFlameRecorderQueueItem } from '@/lib/recording/recording-contract'
import { getAccessToken } from '@/lib/supabase/client'

export interface CloudRecordingProgress {
  recordedSentenceIds: string[]
  recordedReadingSegmentIds: string[]
  recordedReadingRoundKeys: string[]
  readingArticleRoundIds: Record<string, string>
  todayDurationSeconds: number
  totalDurationSeconds: number
}

export interface RecordingProgress extends CloudRecordingProgress {
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const EMPTY_PROGRESS: CloudRecordingProgress = {
  recordedSentenceIds: [],
  recordedReadingSegmentIds: [],
  recordedReadingRoundKeys: [],
  readingArticleRoundIds: {},
  todayDurationSeconds: 0,
  totalDurationSeconds: 0,
}

function isToday(value: string): boolean {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return false
  }

  const date = new Date(timestamp)
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean))).sort()
}

/** Merge durable cloud progress with recordings still waiting in this browser. */
export function mergeRecordingProgress(
  cloud: CloudRecordingProgress,
  localQueueItems: VoxFlameRecorderQueueItem[],
): CloudRecordingProgress {
  const localDurationSeconds = localQueueItems.reduce(
    (sum, item) => sum + Math.max(0, item.recording.audio.durationSeconds),
    0,
  )
  const localTodayDurationSeconds = localQueueItems.reduce(
    (sum, item) => sum + (isToday(item.createdAt) ? Math.max(0, item.recording.audio.durationSeconds) : 0),
    0,
  )
  const localSentenceIds = localQueueItems
    .map((item) => item.sentenceId?.trim() ?? '')
    .filter(Boolean)
  const localReadingSegmentIds = localQueueItems
    .map((item) => (
      typeof item.metadata.reading_segment_id === 'string'
        ? item.metadata.reading_segment_id.trim()
        : ''
    ))
    .filter(Boolean)
  const localReadingRoundKeys = localQueueItems.flatMap((item) => {
    const segmentId = typeof item.metadata.reading_segment_id === 'string'
      ? item.metadata.reading_segment_id.trim()
      : ''
    if (!segmentId) {
      return []
    }
    const roundId = typeof item.metadata.reading_round_id === 'string'
      ? item.metadata.reading_round_id.trim()
      : 'initial'
    return [`${roundId || 'initial'}:${segmentId}`]
  })

  return {
    recordedSentenceIds: uniqueStrings([...cloud.recordedSentenceIds, ...localSentenceIds]),
    recordedReadingSegmentIds: uniqueStrings([
      ...cloud.recordedReadingSegmentIds,
      ...localReadingSegmentIds,
    ]),
    recordedReadingRoundKeys: uniqueStrings([
      ...cloud.recordedReadingRoundKeys,
      ...localReadingRoundKeys,
    ]),
    readingArticleRoundIds: cloud.readingArticleRoundIds,
    todayDurationSeconds: cloud.todayDurationSeconds + localTodayDurationSeconds,
    totalDurationSeconds: cloud.totalDurationSeconds + localDurationSeconds,
  }
}

export function useRecordingProgress(
  isAuthenticated: boolean,
  localQueueItems: VoxFlameRecorderQueueItem[] = [],
): RecordingProgress {
  const [cloud, setCloud] = useState<CloudRecordingProgress>(EMPTY_PROGRESS)
  const [isLoading, setIsLoading] = useState(isAuthenticated)
  const [error, setError] = useState<string | null>(null)
  const previousLocalQueueCountRef = useRef(localQueueItems.length)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCloud(EMPTY_PROGRESS)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('auth_required')
      }

      const timezoneOffsetMinutes = new Date().getTimezoneOffset()
      const response = await fetch(
        `${config.api.baseUrl}/upload/progress?timezoneOffsetMinutes=${timezoneOffsetMinutes}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!response.ok) {
        throw new Error(`progress_${response.status}`)
      }

      const payload = await response.json() as Partial<CloudRecordingProgress>
      setCloud({
        recordedSentenceIds: Array.isArray(payload.recordedSentenceIds)
          ? payload.recordedSentenceIds.filter((item): item is string => typeof item === 'string')
          : [],
        recordedReadingSegmentIds: Array.isArray(payload.recordedReadingSegmentIds)
          ? payload.recordedReadingSegmentIds.filter((item): item is string => typeof item === 'string')
          : [],
        recordedReadingRoundKeys: Array.isArray(payload.recordedReadingRoundKeys)
          ? payload.recordedReadingRoundKeys.filter((item): item is string => typeof item === 'string')
          : [],
        readingArticleRoundIds: payload.readingArticleRoundIds
          && typeof payload.readingArticleRoundIds === 'object'
          && !Array.isArray(payload.readingArticleRoundIds)
            ? Object.fromEntries(
                Object.entries(payload.readingArticleRoundIds)
                  .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
              )
            : {},
        todayDurationSeconds: typeof payload.todayDurationSeconds === 'number'
          ? Math.max(0, payload.todayDurationSeconds)
          : 0,
        totalDurationSeconds: typeof payload.totalDurationSeconds === 'number'
          ? Math.max(0, payload.totalDurationSeconds)
          : 0,
      })
    } catch (refreshError) {
      console.error('[recording-progress] refresh failed:', refreshError)
      setError('录音时长暂时没有更新，本机待同步录音仍会计入。')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const previousCount = previousLocalQueueCountRef.current
    previousLocalQueueCountRef.current = localQueueItems.length
    if (isAuthenticated && localQueueItems.length < previousCount) {
      void refresh()
    }
  }, [isAuthenticated, localQueueItems.length, refresh])

  const merged = useMemo(
    () => mergeRecordingProgress(cloud, localQueueItems),
    [cloud, localQueueItems],
  )

  return {
    ...merged,
    isLoading,
    error,
    refresh,
  }
}
