/**
 * useVoiceUpload Hook
 * 
 * 处理语音录音的上传逻辑
 * 支持 Supabase 云端上传和本地降级
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { normalizeRecordingToWav } from '@/lib/audio/recording-to-wav'
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
import { sanitizeTrainingUploadMetadata } from '@/lib/recording/upload-metadata'

interface UploadOptions {
  /** 录音对应的文本内容 */
  text: string
  /** 前端识别出的句子，仅用于反馈与样本诊断 */
  recognizedText?: string
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
  source: 'cloud' | 'background_retry'
  syncStatus: 'uploaded' | 'retrying'
  message: string
}

export interface UploadResult {
  ok: boolean
  status: 'uploaded' | 'retrying' | 'auth_required' | 'failed'
  receipt?: UploadReceipt
  errorMessage?: string
}

export interface DiscardUploadOptions {
  recordingId: string
  contributionId?: string | null
  storagePath?: string | null
}

export interface DiscardUploadResult {
  ok: boolean
  status: 'discarded' | 'auth_required' | 'failed'
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
  const autoRetryTimerRef = useRef<number | null>(null)
  const syncLocalRecordingsRef = useRef<(silent?: boolean) => Promise<{ synced: number; total: number }>>(async () => ({ synced: 0, total: 0 }))

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

  useEffect(() => {
    void refreshLocalQueueCount()
  }, [refreshLocalQueueCount])

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
      setLastError(null)
      setUploadProgress(100)
      const receipt: UploadReceipt = {
        recordingId: options.recording.recordingId,
        source: 'background_retry',
        syncStatus: 'retrying',
        message: existingItem
          ? '这条录音的云端登记还没补齐，系统正在后台继续自动重试。'
          : '录音已先保留为后台补登任务，系统会自动继续上传与登记。',
      }
      setLastUploadReceipt(receipt)
      if (typeof window !== 'undefined') {
        if (autoRetryTimerRef.current !== null) {
          window.clearTimeout(autoRetryTimerRef.current)
        }

        autoRetryTimerRef.current = window.setTimeout(() => {
          autoRetryTimerRef.current = null
          void syncLocalRecordingsRef.current(true)
        }, 2000)
      }
      return {
        ok: true,
        status: 'retrying',
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
    let effectiveOptions: UploadOptions = options

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

      const recordingForNormalization = audioBlob === options.recording.audio.blob
        ? options.recording
        : {
            ...options.recording,
            audio: {
              ...options.recording.audio,
              blob: audioBlob,
              format: audioBlob.type || options.recording.audio.format,
              fileSizeBytes: audioBlob.size || options.recording.audio.fileSizeBytes,
            },
          }

      let normalizedRecording: VoxFlameRecordingEnvelope
      try {
        normalizedRecording = await normalizeRecordingToWav(recordingForNormalization)
      } catch (error) {
        console.error('录音转 WAV 失败:', error)
        const errorMessage = '录音处理失败，请重试。'
        setLastError(errorMessage)
        return {
          ok: false,
          status: 'failed',
          errorMessage,
        }
      }

      const normalizedOptions: UploadOptions = {
        ...options,
        recording: normalizedRecording,
      }
      effectiveOptions = normalizedOptions
      const normalizedAudioBlob = normalizedRecording.audio.blob

      // 1. 准备文件名与存储路径 (按 有标注/无标注 分类)
      const ext = normalizedAudioBlob.type.includes('wav')
        ? 'wav'
        : normalizedAudioBlob.type.includes('mp4')
          ? 'mp4'
          : 'webm'
      const recordingId = normalizedOptions.recording.recordingId
      const sessionId = toStorageSegment(normalizedOptions.recording.sessionId)

      let storagePath = ''

      if (normalizedOptions.source === 'guided_recording' && normalizedOptions.sentenceId) {
        const categorySegment = toStorageSegment(normalizedOptions.metadata?.exercise_category)
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
            contentType: normalizedAudioBlob.type || 'audio/wav'
          })
        })

        if (!signRes.ok) throw new Error(`签名请求失败: ${signRes.statusText}`)
        const { url: uploadUrl } = await signRes.json()

        // PUT 上传
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': normalizedAudioBlob.type || 'audio/wav' },
          body: normalizedAudioBlob
        })

        if (!uploadRes.ok) throw new Error(`OSS上传失败: ${uploadRes.statusText}`)
      } catch (uploadError: unknown) {
        console.warn('云端保存失败，已转为本地保存。')
        return await saveLocally(
          normalizedOptions,
          userId,
          '云端保存失败',
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
          text: normalizedOptions.text,
          recognizedText: normalizedOptions.recognizedText || null,
          sentenceId: normalizedOptions.sentenceId || null,
          duration: normalizedOptions.recording.audio.durationSeconds,
          source: normalizedOptions.source,
          metadata: {
            recording_id: normalizedOptions.recording.recordingId,
            session_id: normalizedOptions.recording.sessionId,
            mode: normalizedOptions.recording.mode,
            source_surface: normalizedOptions.recording.sourceSurface,
            collection_mode: normalizedOptions.recording.collectionMode,
            consent_scope: normalizedOptions.consentScope ?? 'training_only',
            source: normalizedOptions.source || 'unknown',
            timestamp: normalizedOptions.recording.createdAt,
            storage_type: 'oss',
            audio_format: normalizedOptions.recording.audio.format,
            sample_rate: normalizedOptions.recording.audio.sampleRate,
            channel_count: normalizedOptions.recording.audio.channelCount,
            duration_ms: normalizedOptions.recording.audio.durationMs,
            file_size_bytes: normalizedOptions.recording.audio.fileSizeBytes,
            capture_transport: normalizedOptions.recording.audio.captureTransport,
            speech_duration_ms: normalizedOptions.recording.audio.quality?.speechDurationMs,
            leading_silence_ms: normalizedOptions.recording.audio.quality?.leadingSilenceMs,
            trailing_silence_ms: normalizedOptions.recording.audio.quality?.trailingSilenceMs,
            silence_ratio: normalizedOptions.recording.audio.quality?.silenceRatio,
            input_level_rms: normalizedOptions.recording.audio.quality?.inputLevelRms,
            input_level_peak: normalizedOptions.recording.audio.quality?.inputLevelPeak,
            audio_quality_disposition: normalizedOptions.recording.audio.quality?.disposition,
            audio_quality_reasons: normalizedOptions.recording.audio.quality?.reasons,
            ...sanitizeTrainingUploadMetadata(normalizedOptions.metadata),
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
          ? '同一条录音已经在训练资产里了，这次重试已安全复用；同一句的新录音仍会保留为独立样本。'
          : '录音已上传并写入训练 manifest；同一句后续再练也会保留为新的样本。',
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
        effectiveOptions,
        userId || 'unknown-user',
        '云端保存失败',
      )
    } finally {
      setIsUploading(false)
    }
  }, [isAuthenticated, refreshLocalQueueCount, saveLocally, userId])

  const discardUploadedRecording = useCallback(async (
    options: DiscardUploadOptions,
  ): Promise<DiscardUploadResult> => {
    if (options.recordingId) {
      await removeRecorderQueueItem(options.recordingId)
      await refreshLocalQueueCount()
    }

    if (!options.contributionId && !options.storagePath) {
      return {
        ok: true,
        status: 'discarded',
      }
    }

    if (!isAuthenticated || !userId) {
      const errorMessage = '请先登录后再撤回训练样本。'
      setLastError(errorMessage)
      return {
        ok: false,
        status: 'auth_required',
        errorMessage,
      }
    }

    const token = await getValidToken()
    if (!token) {
      const errorMessage = '登录状态已失效，请重新登录后再撤回。'
      setLastError(errorMessage)
      return {
        ok: false,
        status: 'auth_required',
        errorMessage,
      }
    }

    try {
      const response = await fetch(`${config.api.baseUrl}/upload/contribution`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contributionId: options.contributionId ?? null,
          audioPath: options.storagePath ?? null,
          recordingId: options.recordingId,
        }),
      })

      if (!response.ok) {
        throw new Error(`discard_upload_${response.status}`)
      }

      setLastError(null)
      setLastUploadReceipt(null)
      return {
        ok: true,
        status: 'discarded',
      }
    } catch (error) {
      const errorMessage = '撤回失败，请重试。'
      setLastError(errorMessage)
      return {
        ok: false,
        status: 'failed',
        errorMessage,
      }
    }
  }, [isAuthenticated, refreshLocalQueueCount, userId])

  /**
   * 同步本地记录到云端
   */
  const syncLocalRecordings = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setLastError(null)
    }

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
          recognizedText:
            typeof record.metadata?.recognized_text === 'string'
              ? record.metadata.recognized_text
              : undefined,
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
                  lastError: result.errorMessage || '登录后才能继续自动补登录音。',
                }
              : current
          ))
          break
        }

        if (result.status === 'failed' || result.status === 'retrying') {
          await updateRecorderQueueItem(record.recordingId, (current) => (
            current
              ? {
                  ...current,
                  syncStatus: result.status === 'retrying' ? 'upload_pending' : 'failed',
                  lastError: result.errorMessage || '云端登记暂时异常，系统会继续自动重试。',
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
                lastError: '同步失败，请重试。',
              }
            : current
        ))
      }
    }
    await refreshLocalQueueCount()
    setIsSyncingLocalQueue(false)

    return { synced: syncedCount, total: unsynced.length }
  }, [refreshLocalQueueCount, uploadRecording])

  syncLocalRecordingsRef.current = syncLocalRecordings

  useEffect(() => {
    if (!isAuthenticated || localQueueCount === 0) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    if (autoRetryTimerRef.current !== null) {
      window.clearTimeout(autoRetryTimerRef.current)
    }

    autoRetryTimerRef.current = window.setTimeout(() => {
      autoRetryTimerRef.current = null
      void syncLocalRecordingsRef.current(true)
    }, 1500)

    return () => {
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current)
        autoRetryTimerRef.current = null
      }
    }
  }, [isAuthenticated, localQueueCount, syncLocalRecordings])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleOnline = () => {
      void syncLocalRecordingsRef.current(true)
    }

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncLocalRecordingsRef.current(true)
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [syncLocalRecordings])

  /**
   * 获取本地未同步的记录数量
   */
  const getLocalRecordCount = useCallback(() => {
    return localQueueCount
  }, [localQueueCount])

  return {
    uploadRecording,
    discardUploadedRecording,
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
