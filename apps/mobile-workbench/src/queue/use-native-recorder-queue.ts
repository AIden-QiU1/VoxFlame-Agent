import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'

import { uploadMobileRecorderQueueItem } from '../api/mobile-upload-client'
import type { MobileAuthTokenProvider } from '../api/mobile-workbench-client'
import type { MobileWorkbenchSurfaceId } from '../constants/surfaces'
import type {
  MobileWorkbenchRecorderQueueItem,
  MobileWorkbenchRecordingMode,
  MobileWorkbenchUploadReceipt,
} from '../contracts/workbench-contracts'
import {
  appendNativeRecorderQueueItem,
  loadNativeRecorderQueue,
  persistNativeRecordingFile,
  removeNativeRecorderQueueItem,
  updateNativeRecorderQueueItemStatus,
} from './native-recorder-storage'
import { assessMobileRecordingQuality } from './recording-quality'
import { summarizeRecorderQueue } from './recorder-queue-policy'
import { toMobileProductMessage } from '../ui/product-message'

export type NativeRecorderPermissionStatus =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'undetermined'

export interface NativeRecorderQueueState {
  items: MobileWorkbenchRecorderQueueItem[]
  latestItem: MobileWorkbenchRecorderQueueItem | null
  summary: ReturnType<typeof summarizeRecorderQueue>
  permissionStatus: NativeRecorderPermissionStatus
  isRecording: boolean
  durationMs: number
  isPlayingLatest: boolean
  isUploading: boolean
  uploadingRecordingId: string | null
  lastUploadReceipt: MobileWorkbenchUploadReceipt | null
  errorMessage: string | null
  refreshQueue(): Promise<void>
  requestPermission(): Promise<boolean>
  startRecording(text: string): Promise<void>
  stopRecording(): Promise<MobileWorkbenchRecorderQueueItem | null>
  playRecording(recordingId: string): void
  playLatest(): void
  discard(recordingId: string): Promise<void>
  markUploadPending(recordingId: string): Promise<void>
  uploadRecording(recordingId: string): Promise<MobileWorkbenchUploadReceipt | null>
}

function createRecordingId(): string {
  const timestamp = Date.now().toString(36)
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `mobile-rec-${timestamp}-${randomSuffix}`
}

function normalizePermissionStatus(status: string): NativeRecorderPermissionStatus {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') {
    return status
  }

  return 'unknown'
}

export function useNativeRecorderQueue(params: {
  apiBaseUrl: string | null
  contributorId: string | null
  tokenProvider: MobileAuthTokenProvider
  surface: MobileWorkbenchSurfaceId
  mode: MobileWorkbenchRecordingMode
}): NativeRecorderQueueState {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder, 250)
  const latestPlayer = useAudioPlayer(null)
  const [items, setItems] = useState<MobileWorkbenchRecorderQueueItem[]>([])
  const [permissionStatus, setPermissionStatus] =
    useState<NativeRecorderPermissionStatus>('unknown')
  const [recordingStartedAt, setRecordingStartedAt] = useState<string | null>(null)
  const [recordingText, setRecordingText] = useState('')
  const [uploadingRecordingId, setUploadingRecordingId] = useState<string | null>(null)
  const [lastUploadReceipt, setLastUploadReceipt] =
    useState<MobileWorkbenchUploadReceipt | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshQueue = useCallback(async (): Promise<void> => {
    setItems(await loadNativeRecorderQueue())
  }, [])

  useEffect(() => {
    void refreshQueue()
    void AudioModule.getRecordingPermissionsAsync()
      .then((permission) => {
        setPermissionStatus(normalizePermissionStatus(permission.status))
      })
      .catch(() => {
        setPermissionStatus('unknown')
      })
  }, [refreshQueue])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const existingPermission =
        await AudioModule.getRecordingPermissionsAsync()
      if (existingPermission.granted) {
        setPermissionStatus('granted')
        return true
      }

      const requestedPermission =
        await AudioModule.requestRecordingPermissionsAsync()
      setPermissionStatus(normalizePermissionStatus(requestedPermission.status))
      return requestedPermission.granted
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'microphone'))
      return false
    }
  }, [])

  const startRecording = useCallback(async (text: string): Promise<void> => {
    setErrorMessage(null)

    if (!params.contributorId) {
      setErrorMessage('请先登录。')
      return
    }

    const hasPermission = await requestPermission()
    if (!hasPermission) {
      setErrorMessage('请允许麦克风权限后重试。')
      return
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setRecordingStartedAt(new Date().toISOString())
      setRecordingText(text.trim() || '移动端练习样本')
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'recording'))
    }
  }, [params.contributorId, recorder, requestPermission])

  const stopRecording = useCallback(async (): Promise<MobileWorkbenchRecorderQueueItem | null> => {
    setErrorMessage(null)

    if (!params.contributorId) {
      setErrorMessage('请先登录。')
      return null
    }

    const stoppedAt = new Date().toISOString()
    const startedAt = recordingStartedAt ?? stoppedAt

    try {
      await recorder.stop()
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      })

      const sourceUri = recorder.uri
      if (!sourceUri) {
        throw new Error('recording_uri_missing')
      }

      const recordingId = createRecordingId()
      const persistedAudio = persistNativeRecordingFile({
        recordingId,
        sourceUri,
      })
      const durationMs = Math.max(0, recorderState.durationMillis)
      const quality = assessMobileRecordingQuality(durationMs)
      const item: MobileWorkbenchRecorderQueueItem = {
        recordingId,
        contributorId: params.contributorId,
        text: recordingText.trim() || '移动端练习样本',
        surface: params.surface,
        metadata: {
          app_surface: 'mobile_workbench',
          recorder: 'expo-audio',
          queue_owner: 'mobile_cache',
          audio_quality_disposition: quality.disposition,
          audio_quality_reasons: quality.reasons,
        },
        consentScope: 'training_only',
        syncStatus: 'local_only',
        syncAttempts: 0,
        createdAt: stoppedAt,
        recording: {
          recordingId,
          sessionId: `mobile-local-${recordingId}`,
          mode: params.mode,
          sourceSurface: 'mobile_workbench',
          collectionMode: 'supervised',
          createdAt: stoppedAt,
          startedAt,
          stoppedAt,
          audio: {
            uri: persistedAudio.uri,
            format: persistedAudio.format,
            sampleRate: 44100,
            channelCount: 1,
            durationMs,
            durationSeconds: durationMs / 1000,
            fileSizeBytes: persistedAudio.fileSizeBytes,
            captureTransport: 'native_recorder',
            quality,
          },
        },
      }

      setItems(await appendNativeRecorderQueueItem(item))
      setRecordingStartedAt(null)
      setRecordingText('')
      return item
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'recording'))
      return null
    }
  }, [
    params.contributorId,
    params.mode,
    params.surface,
    recorder,
    recorderState.durationMillis,
    recordingStartedAt,
    recordingText,
  ])

  const playRecording = useCallback((recordingId: string): void => {
    const item = items.find((queueItem) => queueItem.recordingId === recordingId)
    if (!item) {
      return
    }

    latestPlayer.replace({ uri: item.recording.audio.uri })
    latestPlayer.play()
  }, [items, latestPlayer])

  const playLatest = useCallback((): void => {
    const latestItem = items[0]
    if (latestItem) {
      playRecording(latestItem.recordingId)
    }
  }, [items, playRecording])

  const discard = useCallback(async (recordingId: string): Promise<void> => {
    setItems(await removeNativeRecorderQueueItem(recordingId))
  }, [])

  const markUploadPending = useCallback(async (
    recordingId: string,
  ): Promise<void> => {
    setItems(await updateNativeRecorderQueueItemStatus(
      recordingId,
      'upload_pending',
    ))
  }, [])

  const uploadRecording = useCallback(async (
    recordingId: string,
  ): Promise<MobileWorkbenchUploadReceipt | null> => {
    setErrorMessage(null)
    setLastUploadReceipt(null)

    if (!params.apiBaseUrl) {
      setErrorMessage('服务暂不可用，请稍后再试。')
      return null
    }

    const currentItems = await loadNativeRecorderQueue()
    const item = currentItems.find((queueItem) => (
      queueItem.recordingId === recordingId
    ))

    if (!item) {
      setErrorMessage('未找到这条录音。')
      return null
    }

    setUploadingRecordingId(recordingId)
    setItems(await updateNativeRecorderQueueItemStatus(
      recordingId,
      'upload_pending',
      undefined,
      item.uploadReceipt ?? null,
    ))

    try {
      const receipt = await uploadMobileRecorderQueueItem(item, {
        apiBaseUrl: params.apiBaseUrl,
        tokenProvider: params.tokenProvider,
      })
      setItems(await updateNativeRecorderQueueItemStatus(
        recordingId,
        'uploaded',
        undefined,
        receipt,
      ))
      setLastUploadReceipt(receipt)
      return receipt
    } catch (error) {
      const message = toMobileProductMessage(error, 'upload')
      setItems(await updateNativeRecorderQueueItemStatus(
        recordingId,
        'failed',
        message,
        item.uploadReceipt ?? null,
      ))
      setErrorMessage(message)
      return null
    } finally {
      setUploadingRecordingId(null)
    }
  }, [params.apiBaseUrl, params.tokenProvider])

  const summary = useMemo(() => summarizeRecorderQueue(items), [items])

  return {
    items,
    latestItem: items[0] ?? null,
    summary,
    permissionStatus,
    isRecording: recorderState.isRecording,
    durationMs: recorderState.durationMillis,
    isPlayingLatest: latestPlayer.playing,
    isUploading: Boolean(uploadingRecordingId),
    uploadingRecordingId,
    lastUploadReceipt,
    errorMessage,
    refreshQueue,
    requestPermission,
    startRecording,
    stopRecording,
    playRecording,
    playLatest,
    discard,
    markUploadPending,
    uploadRecording,
  }
}
