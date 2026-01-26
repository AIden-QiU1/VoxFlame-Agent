/**
 * useVoiceUpload Hook
 * 
 * 处理语音录音的上传逻辑
 * 支持 Supabase 云端上传和本地降级
 */

import { useState, useCallback } from 'react'
import { supabase, AUDIO_BUCKET, TABLES } from '@/lib/supabase/client'
import { useContributor } from './useContributor'
import { config } from '@/lib/config'

interface UploadOptions {
  /** 录音对应的文本内容 */
  text: string
  /** 录音时长（秒） */
  duration: number
  /** 来源：guided_recording | free_recording | transcription_page */
  source?: string
  /** 句子ID（引导模式时） */
  sentenceId?: string
}

interface UploadResult {
  success: boolean
  audioPath?: string
  contributionId?: string
  error?: string
}

export function useVoiceUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)

  const { contributorId } = useContributor()

  /**
   * 上传录音
   */
  const uploadRecording = useCallback(async (
    audioBlob: Blob,
    options: UploadOptions
  ): Promise<boolean> => {
    setIsUploading(true)
    setUploadProgress(0)
    setLastError(null)

    const actualContributorId = contributorId || getLocalContributorId()

    try {
      // 1. 准备文件名与存储路径 (按 有标注/无标注 分类)
      const timestamp = Date.now()
      const ext = audioBlob.type.includes('wav') ? 'wav' : 'webm'

      let storagePath = ''

      if (options.source === 'guided_recording' && options.sentenceId) {
        // 有标注数据: dataset/{user_id}/{sentence_id}_{timestamp}.{ext}
        storagePath = `dataset/${actualContributorId}/${options.sentenceId}_${timestamp}.${ext}`
      } else {
        // 无标注数据 (自由录音/对话): unlabeled/{user_id}/{timestamp}.{ext}
        storagePath = `unlabeled/${actualContributorId}/${timestamp}.${ext}`
      }

      setUploadProgress(20)

      // 2. 尝试上传到 OSS (通过后端签名)
      try {
        // Use config.api.baseUrl which handles rewrites (e.g. /api)
        const signRes = await fetch(`${config.api.baseUrl}/upload/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        return await saveLocally(audioBlob, options, actualContributorId)
      }

      setUploadProgress(50)

      // 3. 通知后端完成 (DB写入 + OSS Manifest追加)
      const completeRes = await fetch(`${config.api.baseUrl}/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributorId: actualContributorId,
          audioPath: storagePath,
          text: options.text,
          sentenceId: options.sentenceId || null,
          duration: options.duration,
          source: options.source,
          metadata: {
            source: options.source || 'unknown',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            timestamp: new Date().toISOString(),
            storage_type: 'oss'
          }
        })
      })

      if (!completeRes.ok) {
        throw new Error(`后端记录失败: ${completeRes.statusText}`)
      }

      setUploadProgress(80)

      // 4. 更新贡献者统计 (暂时跳过，或者也移交给后端)
      // 由于 RLS 或 RPC 权限，前端直接调用可能失败。
      // 可以将 stats_increment Logic 放入 /api/upload/complete 后端处理中。

      setUploadProgress(100)
      return true

    } catch (err) {
      console.error('上传过程出错:', err)
      // 尝试本地保存
      return await saveLocally(audioBlob, options, actualContributorId)
    } finally {
      setIsUploading(false)
    }
  }, [contributorId])

  /**
   * 本地降级存储
   */
  const saveLocally = useCallback(async (
    audioBlob: Blob,
    options: UploadOptions,
    contributorId: string
  ): Promise<boolean> => {
    try {
      const timestamp = Date.now()
      const key = `ranyan_recording_${timestamp}`

      // 将 Blob 转为 base64 存储
      const base64 = await blobToBase64(audioBlob)

      const localRecord = {
        id: key,
        audioData: base64,
        transcript: options.text,
        sentenceId: options.sentenceId,
        source: options.source,
        duration: options.duration,
        contributorId,
        createdAt: new Date().toISOString(),
        synced: false,
      }

      // 获取现有的本地记录
      const existingRecords = JSON.parse(
        localStorage.getItem('ranyan_local_recordings') || '[]'
      )
      existingRecords.push(localRecord)
      localStorage.setItem('ranyan_local_recordings', JSON.stringify(existingRecords))

      setLastError('已保存到本地，网络恢复后将自动同步')
      setUploadProgress(100)
      return true
    } catch (err) {
      console.error('本地保存失败:', err)
      setLastError('保存失败，请检查存储空间')
      return false
    }
  }, [])

  /**
   * 同步本地记录到云端
   */
  const syncLocalRecordings = useCallback(async () => {
    const localRecords = JSON.parse(
      localStorage.getItem('ranyan_local_recordings') || '[]'
    )

    const unsynced = localRecords.filter((r: { synced: boolean }) => !r.synced)
    if (unsynced.length === 0) return { synced: 0, total: 0 }

    let syncedCount = 0

    for (const record of unsynced) {
      try {
        // 将 base64 转回 Blob
        const blob = await base64ToBlob(record.audioData)

        const success = await uploadRecording(blob, {
          text: record.transcript,
          duration: record.duration,
          source: record.source,
          sentenceId: record.sentenceId,
        })

        if (success) {
          record.synced = true
          syncedCount++
        }
      } catch (err) {
        console.error('同步记录失败:', err)
      }
    }

    // 更新本地存储，清理已同步的
    const remaining = localRecords.filter((r: { synced: boolean }) => !r.synced)
    localStorage.setItem('ranyan_local_recordings', JSON.stringify(remaining))

    return { synced: syncedCount, total: unsynced.length }
  }, [uploadRecording])

  /**
   * 获取本地未同步的记录数量
   */
  const getLocalRecordCount = useCallback(() => {
    const records = JSON.parse(
      localStorage.getItem('ranyan_local_recordings') || '[]'
    )
    return records.filter((r: { synced: boolean }) => !r.synced).length
  }, [])

  return {
    uploadRecording,
    syncLocalRecordings,
    getLocalRecordCount,
    isUploading,
    uploadProgress,
    lastError,
  }
}

// ============ 工具函数 ============

function getLocalContributorId(): string {
  const stored = localStorage.getItem('ranyan_contributor_id')
  if (stored) return stored

  const newId = `v_${Math.random().toString(36).substring(2, 10)}`
  localStorage.setItem('ranyan_contributor_id', newId)
  return newId
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function base64ToBlob(base64: string): Promise<Blob> {
  const response = await fetch(base64)
  return response.blob()
}
