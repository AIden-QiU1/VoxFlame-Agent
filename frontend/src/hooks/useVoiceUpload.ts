/**
 * useVoiceUpload Hook
 * 
 * 处理语音录音的上传逻辑
 * 支持 Supabase 云端上传和本地降级
 */

import { useState, useCallback } from 'react'
import { supabase, AUDIO_BUCKET, TABLES } from '@/lib/supabase/client'
import { useContributor } from './useContributor'

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
      // 1. 准备文件名
      const timestamp = Date.now()
      const ext = audioBlob.type.includes('wav') ? 'wav' : 'webm'
      const prefix = options.sentenceId || 'recording'
      const filename = `${prefix}_${timestamp}.${ext}`
      const storagePath = `${actualContributorId}/${filename}`

      setUploadProgress(20)

      // 2. 尝试上传到 Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, audioBlob, {
          contentType: audioBlob.type || 'audio/wav',
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.warn('Storage 上传失败，降级到本地:', uploadError.message)
        return await saveLocally(audioBlob, options, actualContributorId)
      }

      setUploadProgress(50)

      // 3. 保存贡献记录到数据库
      const { data: contributionData, error: dbError } = await supabase
        .from(TABLES.CONTRIBUTIONS)
        .insert({
          contributor_id: actualContributorId,
          audio_path: uploadData.path,
          transcript: options.text,
          sentence_id: options.sentenceId || null,
          is_free_recording: options.source !== 'guided_recording',
          duration_seconds: options.duration,
          metadata: {
            source: options.source || 'unknown',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (dbError) {
        console.warn('数据库记录失败:', dbError.message)
        // 文件已上传但记录失败，仍算成功
        setUploadProgress(100)
        return true
      }

      setUploadProgress(80)

      // 4. 更新贡献者统计（可能会失败，不影响主流程）
      try {
        await supabase.rpc('increment_contributor_stats', {
          p_contributor_id: actualContributorId,
          p_duration: options.duration,
        })
      } catch (e) {
        console.warn('统计更新失败，不影响录音保存')
      }

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
