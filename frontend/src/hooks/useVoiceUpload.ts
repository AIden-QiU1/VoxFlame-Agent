/**
 * useVoiceUpload Hook
 * 
 * 处理语音录音的上传逻辑
 * 支持 Supabase 云端上传和本地降级
 */

import { useState, useCallback } from 'react'
import {
  enqueueRecorderQueueItem,
  getRecorderQueueItem,
  listRecorderQueueItems,
  removeRecorderQueueItem,
  updateRecorderQueueItem,
} from '@/lib/recording/recorder-queue'
import type {
  VoxFlameConsentScope,
  VoxFlameRecorderQueueItem,
  VoxFlameRecordingEnvelope,
} from '@/lib/recording/recording-contract'
import { getValidToken } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { config } from '@/lib/config'

interface UploadOptions {
  /** 录音对应的文本内容 */
  text: string
  /** 来源：guided_recording | free_recording | transcription_page */
  source?: string
  /** 句子ID（引导模式时） */
  sentenceId?: string
  /** 录音结构化 envelope */
  recording: VoxFlameRecordingEnvelope
  /** 上传授权范围 */
  consentScope?: VoxFlameConsentScope
  /** 结构化元数据 */
  metadata?: Record<string, unknown>
}

export interface UploadReceipt {
  recordingId: string
  contributionId?: string | null
  manifestPath?: string
  storagePath?: string
  reusedContribution?: boolean
  manifestAlreadySynced?: boolean
  source: 'cloud' | 'local_queue'
  syncStatus: 'uploaded' | 'local_only'
  message: string
}

export interface UploadResult {
  ok: boolean
  status: 'uploaded' | 'queued_locally' | 'auth_required' | 'failed'
  receipt?: UploadReceipt
  errorMessage?: string
}

function toStorageSegment(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'unknown'
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}

export function useVoiceUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [isSyncingLocalQueue, setIsSyncingLocalQueue] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [localQueueCount, setLocalQueueCount] = useState(0)
  const [localQueueItems, setLocalQueueItems] = useState<VoxFlameRecorderQueueItem[]>([])
  const [lastUploadReceipt, setLastUploadReceipt] = useState<UploadReceipt | null>(null)

  const { userId, isAuthenticated } = useAuth()

  const refreshLocalQueueCount = useCallback(async () => {
    try {
      const items = await listRecorderQueueItems()
      setLocalQueueItems(items)
      setLocalQueueCount(items.length)
      return items.length
    } catch {
      setLocalQueueItems([])
      setLocalQueueCount(0)
      return 0
    }
  }, [])

  /**
   * 本地降级存储
   */
  const saveLocally = useCallback(async (
    options: UploadOptions,
    contributorId: string,
    failureReason?: string,
  ): Promise<UploadResult> => {
    try {
      const existingItem = await getRecorderQueueItem(options.recording.recordingId)
      const syncStatus = existingItem ? 'failed' : 'local_only'
      const localRecord: VoxFlameRecorderQueueItem = {
        recordingId: options.recording.recordingId,
        contributorId,
        text: options.text,
        sentenceId: options.sentenceId,
        source: options.source,
        consentScope: options.consentScope ?? 'training_only',
        syncStatus,
        syncAttempts: existingItem?.syncAttempts ?? 0,
        lastAttemptAt: existingItem?.lastAttemptAt,
        lastError: failureReason,
        metadata: {
          ...(existingItem?.metadata || {}),
          ...(options.metadata || {}),
        },
        createdAt: options.recording.createdAt,
        recording: options.recording,
      }

      await enqueueRecorderQueueItem(localRecord)

      await refreshLocalQueueCount()
      setLastError('已保存到本地录音队列，网络恢复后可以继续同步')
      setUploadProgress(100)
      const receipt: UploadReceipt = {
        recordingId: options.recording.recordingId,
        source: 'local_queue',
        syncStatus: 'local_only',
        message: existingItem
          ? '这条录音已继续保存在本地待同步队列，上次同步没有成功，你可以稍后重试。'
          : '录音已保存在本地待同步队列，网络恢复后仍可继续上传。',
      }
      setLastUploadReceipt(receipt)
      return {
        ok: true,
        status: 'queued_locally',
        receipt,
      }
    } catch (err) {
      console.error('本地保存失败:', err)
      setLastError('保存失败，请检查存储空间')
      return {
        ok: false,
        status: 'failed',
        errorMessage: '保存失败，请检查存储空间',
      }
    }
  }, [refreshLocalQueueCount])

  /**
   * 上传录音
   */
  const uploadRecording = useCallback(async (
    audioBlob: Blob,
    options: UploadOptions
  ): Promise<UploadResult> => {
    setIsUploading(true)
    setUploadProgress(0)
    setLastError(null)
    setLastUploadReceipt(null)

    try {
      if (!isAuthenticated || !userId) {
        const errorMessage = '请先登录后再上传训练语料。'
        setLastError(errorMessage)
        return {
          ok: false,
          status: 'auth_required',
          errorMessage,
        }
      }

      const token = await getValidToken()
      if (!token) {
        const errorMessage = '登录状态已失效，请重新登录后再上传。'
        setLastError(errorMessage)
        return {
          ok: false,
          status: 'auth_required',
          errorMessage,
        }
      }

      // 1. 准备文件名与存储路径 (按 有标注/无标注 分类)
      const ext = audioBlob.type.includes('wav')
        ? 'wav'
        : audioBlob.type.includes('mp4')
          ? 'mp4'
          : 'webm'
      const recordingId = options.recording.recordingId
      const sessionId = toStorageSegment(options.recording.sessionId)

      let storagePath = ''

      if (options.source === 'guided_recording' && options.sentenceId) {
        const categorySegment = toStorageSegment(options.metadata?.exercise_category)
        storagePath =
          `supervised/mandarin/${categorySegment}/${userId}/` +
          `${recordingId}.${ext}`
      } else {
        storagePath = `weak-supervision/dialogue/${userId}/${sessionId}/${recordingId}.${ext}`
      }

      setUploadProgress(20)

      // 2. 尝试上传到 OSS (通过后端签名)
      try {
        // Use config.api.baseUrl which handles rewrites (e.g. /api)
        const signRes = await fetch(`${config.api.baseUrl}/upload/sign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: storagePath,
            contentType: audioBlob.type || 'audio/wav'
          })
        })

        if (!signRes.ok) throw new Error(`签名请求失败: ${signRes.statusText}`)
        const { url: uploadUrl } = await signRes.json()

        // PUT 上传
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': audioBlob.type || 'audio/wav' },
          body: audioBlob
        })

        if (!uploadRes.ok) throw new Error(`OSS上传失败: ${uploadRes.statusText}`)
      } catch (uploadError: any) {
        console.warn('Storage 上传失败，降级到本地:', uploadError.message)
        return await saveLocally(
          options,
          userId,
          uploadError instanceof Error ? uploadError.message : 'storage_upload_failed',
        )
      }

      setUploadProgress(50)

      // 3. 通知后端完成 (DB写入 + OSS Manifest追加)
      const completeRes = await fetch(`${config.api.baseUrl}/upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioPath: storagePath,
          text: options.text,
          sentenceId: options.sentenceId || null,
          duration: options.recording.audio.durationSeconds,
          source: options.source,
          metadata: {
            recording_id: options.recording.recordingId,
            session_id: options.recording.sessionId,
            mode: options.recording.mode,
            source_surface: options.recording.sourceSurface,
            collection_mode: options.recording.collectionMode,
            consent_scope: options.consentScope ?? 'training_only',
            source: options.source || 'unknown',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            timestamp: options.recording.createdAt,
            storage_type: 'oss',
            audio_format: options.recording.audio.format,
            sample_rate: options.recording.audio.sampleRate,
            channel_count: options.recording.audio.channelCount,
            duration_ms: options.recording.audio.durationMs,
            file_size_bytes: options.recording.audio.fileSizeBytes,
            capture_transport: options.recording.audio.captureTransport,
            ...options.metadata,
          }
        })
      })

      if (!completeRes.ok) {
        throw new Error(`后端记录失败: ${completeRes.statusText}`)
      }
      const completePayload = await completeRes.json() as {
        contributionId?: string | null
        manifestPath?: string
        recordingId?: string
        reusedContribution?: boolean
        manifestAlreadySynced?: boolean
      }

      setUploadProgress(80)

      // 4. 更新贡献者统计 (暂时跳过，或者也移交给后端)
      // 由于 RLS 或 RPC 权限，前端直接调用可能失败。
      // 可以将 stats_increment Logic 放入 /api/upload/complete 后端处理中。

      setUploadProgress(100)
      void refreshLocalQueueCount()
      const receipt: UploadReceipt = {
        recordingId: completePayload.recordingId || recordingId,
        contributionId: completePayload.contributionId ?? null,
        manifestPath: completePayload.manifestPath,
        storagePath,
        reusedContribution: completePayload.reusedContribution,
        manifestAlreadySynced: completePayload.manifestAlreadySynced,
        source: 'cloud',
        syncStatus: 'uploaded',
        message: completePayload.manifestAlreadySynced
          ? '这条录音已经在训练资产里了，这次重试已安全复用，不会重复写入 manifest。'
          : '录音已上传并写入训练 manifest，可继续进入后续训练与质检流程。',
      }
      setLastUploadReceipt(receipt)
      return {
        ok: true,
        status: 'uploaded',
        receipt,
      }

    } catch (err) {
      console.error('上传过程出错:', err)
      // 尝试本地保存
      return await saveLocally(
        options,
        userId || 'unknown-user',
        err instanceof Error ? err.message : 'upload_failed',
      )
    } finally {
      setIsUploading(false)
    }
  }, [isAuthenticated, refreshLocalQueueCount, saveLocally, userId])

  /**
   * 同步本地记录到云端
   */
  const syncLocalRecordings = useCallback(async () => {
    setIsSyncingLocalQueue(true)
    const unsynced = await listRecorderQueueItems()
    if (unsynced.length === 0) {
      setIsSyncingLocalQueue(false)
      return { synced: 0, total: 0 }
    }

    let syncedCount = 0

    for (const record of unsynced) {
      try {
        await updateRecorderQueueItem(record.recordingId, (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            syncStatus: 'upload_pending',
            syncAttempts: (current.syncAttempts ?? 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: undefined,
          }
        })

        const result = await uploadRecording(record.recording.audio.blob, {
          text: record.text,
          source: record.source,
          sentenceId: record.sentenceId,
          metadata: record.metadata || {},
          consentScope: record.consentScope,
          recording: record.recording,
        })

        if (result.status === 'uploaded') {
          await removeRecorderQueueItem(record.recordingId)
          syncedCount++
          continue
        }

        if (result.status === 'auth_required') {
          await updateRecorderQueueItem(record.recordingId, (current) => (
            current
              ? {
                  ...current,
                  syncStatus: 'failed',
                  lastError: result.errorMessage || '登录后才能继续同步本地录音。',
                }
              : current
          ))
          break
        }

        if (result.status === 'failed') {
          await updateRecorderQueueItem(record.recordingId, (current) => (
            current
              ? {
                  ...current,
                  syncStatus: 'failed',
                  lastError: result.errorMessage || '同步失败，请稍后重试。',
                }
              : current
          ))
        }
      } catch (err) {
        console.error('同步记录失败:', err)
        await updateRecorderQueueItem(record.recordingId, (current) => (
          current
            ? {
                ...current,
                syncStatus: 'failed',
                lastError: err instanceof Error ? err.message : '同步失败，请稍后重试。',
              }
            : current
        ))
      }
    }
    await refreshLocalQueueCount()
    setIsSyncingLocalQueue(false)

    return { synced: syncedCount, total: unsynced.length }
  }, [refreshLocalQueueCount, uploadRecording])

  /**
   * 获取本地未同步的记录数量
   */
  const getLocalRecordCount = useCallback(() => {
    return localQueueCount
  }, [localQueueCount])

  return {
    uploadRecording,
    syncLocalRecordings,
    getLocalRecordCount,
    isUploading,
    isSyncingLocalQueue,
    uploadProgress,
    lastError,
    lastUploadReceipt,
    localQueueCount,
    localQueueItems,
    refreshLocalQueueCount,
  }
}
