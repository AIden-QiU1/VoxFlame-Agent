'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'
import type { LatestUserTranscriptSnapshot } from '@/lib/realtime-audio/session-types'
import {
  createRecordingQualityAccumulator,
  type RecordingQualityAccumulator,
} from '@/lib/audio/recording-quality'
import {
  getRecordingInputDeviceMetadata,
  readPreferredMicrophoneDevice,
} from '@/lib/audio/microphone-preferences'
import { calculateNormalizedInputLevel } from '@/lib/audio/microphone-input-feedback'
import { pickPreferredTrainingTranscriptCandidate } from '@/lib/training/final-transcript'
import { useRtcAgentSession } from './useRtcAgentSession'

type SessionStatus = 'idle' | 'connecting' | 'ready' | 'recording' | 'processing' | 'error'

interface StopRecordingResult {
  transcript: string
  recording: VoxFlameRecordingEnvelope | null
  transcriptLatencyMs: number
}

interface PracticeTranscriptState {
  clientCaptureId: string | null
  transcript: string
}

function createEmptyTranscriptSnapshot(): LatestUserTranscriptSnapshot {
  return {
    text: '',
    clientCaptureId: null,
  }
}

function createEmptyPracticeTranscriptState(): PracticeTranscriptState {
  return {
    clientCaptureId: null,
    transcript: '',
  }
}

interface UseMandarinTrainingSessionOptions {
  userId?: string
  accessToken?: string
  shortUtteranceMode?: boolean
}

function pickRecorderMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]

  for (const mimeType of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }

  return ''
}

function transcriptLength(text: string): number {
  return text.replace(/\s+/g, '').trim().length
}

export function useMandarinTrainingSession(
  options: UseMandarinTrainingSessionOptions = {},
) {
  const { userId, accessToken, shortUtteranceMode = false } = options
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const latestUserTranscriptRef = useRef<LatestUserTranscriptSnapshot>(createEmptyTranscriptSnapshot())
  const currentASRTextRef = useRef('')
  const bestObservedTranscriptRef = useRef('')
  const recordingBaselineRef = useRef<LatestUserTranscriptSnapshot>(createEmptyTranscriptSnapshot())
  const activeTranscriptStateRef = useRef<PracticeTranscriptState>(createEmptyPracticeTranscriptState())
  const activeClientCaptureIdRef = useRef<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderTrackRef = useRef<MediaStreamTrack | null>(null)
  const recorderOwnsTrackRef = useRef(false)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingSampleRateRef = useRef<number>(16000)
  const recordingQualityRef = useRef<RecordingQualityAccumulator | null>(null)
  const recordingQualityTimerRef = useRef<number | null>(null)

  const rtc = useRtcAgentSession({
    userId,
    accessToken,
    mode: 'training',
    surface: 'training_workspace',
    executionBackend: 'livekit',
    requestedCapabilities: [
      'transport_send_control',
      'workspace_snapshot_read',
      'voice_profile_update',
      'upload_artifact_persist',
    ],
    connectionNotice: null,
  })
  const {
    sessionId,
    currentASRText,
    latestUserTranscript,
    lastVoiceProfileSync,
    isRecording: rtcIsRecording,
    isConnected,
    error: rtcError,
    startRecording: startRtcRecording,
    stopRecording: stopRtcRecording,
    sendControlEvent,
    disconnect: disconnectRtc,
    getMicrophoneStreamTrack,
    getMicrophoneMediaStream,
    getLatestUserTranscriptSnapshot,
    getCachedTranscriptByCaptureId,
    analyser,
  } = rtc

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    const nextSnapshot = getLatestUserTranscriptSnapshot()
    latestUserTranscriptRef.current = nextSnapshot
    if (
      (!nextSnapshot.clientCaptureId || nextSnapshot.clientCaptureId === activeClientCaptureIdRef.current)
      && transcriptLength(latestUserTranscript) > transcriptLength(bestObservedTranscriptRef.current)
    ) {
      bestObservedTranscriptRef.current = latestUserTranscript
    }
  }, [getLatestUserTranscriptSnapshot, latestUserTranscript])

  const readCapturedTranscript = useCallback((clientCaptureId: string): string => {
    const cached = getCachedTranscriptByCaptureId(clientCaptureId)
    if (cached && cached.clientCaptureId === clientCaptureId) {
      return cached.text.trim()
    }
    return ''
  }, [getCachedTranscriptByCaptureId])

  const updateActiveTranscriptState = useCallback((
    clientCaptureId: string | null,
    transcript: string,
  ) => {
    activeTranscriptStateRef.current = {
      clientCaptureId,
      transcript,
    }
  }, [])

  useEffect(() => {
    currentASRTextRef.current = currentASRText
    if (
      activeTranscriptStateRef.current.clientCaptureId === activeClientCaptureIdRef.current
      && transcriptLength(currentASRText) > transcriptLength(bestObservedTranscriptRef.current)
    ) {
      bestObservedTranscriptRef.current = currentASRText
    }
  }, [currentASRText])

  const sendSpeechActivity = useCallback((
    state: 'speech_started' | 'speech_stopped',
    autoFinalize: boolean = false,
    clientCaptureId: string | null = activeClientCaptureIdRef.current,
  ) => {
    void sendControlEvent('speech_activity', {
      state,
      auto_finalize: autoFinalize,
      short_utterance_expected: shortUtteranceMode,
      client_capture_id: clientCaptureId,
      detected_at: Date.now(),
    }).catch((eventError: unknown) => {
      console.warn('[useMandarinTrainingSession] speech activity send failed:', eventError)
    })
  }, [sendControlEvent, shortUtteranceMode])

  const beginLocalRecording = useCallback(() => {
    const sourceStream = getMicrophoneMediaStream()
    const sourceTrack = sourceStream?.getAudioTracks()[0] ?? getMicrophoneStreamTrack()
    if (!sourceTrack) {
      return null
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('当前浏览器暂不支持训练录音保存，请换到较新的浏览器再试。')
    }

    let recorderTrack: MediaStreamTrack = sourceTrack
    let ownsTrack = false

    try {
      recorderTrack = sourceTrack.clone()
      ownsTrack = true
    } catch {
      recorderTrack = sourceTrack
      ownsTrack = false
    }

    try {
      const stream = new MediaStream([recorderTrack])
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      recordedChunksRef.current = []
      recorderTrackRef.current = recorderTrack
      recorderOwnsTrackRef.current = ownsTrack
      recordingStartedAtRef.current = Date.now()
      recordingSampleRateRef.current = recorderTrack.getSettings().sampleRate || 16000
      const analyserNode = analyser
      const qualityAccumulator = createRecordingQualityAccumulator()
      recordingQualityRef.current = qualityAccumulator
      if (recordingQualityTimerRef.current !== null) {
        window.clearInterval(recordingQualityTimerRef.current)
      }
      if (analyserNode) {
        const data = new Uint8Array(analyserNode.frequencyBinCount)
        recordingQualityTimerRef.current = window.setInterval(() => {
          analyserNode.getByteTimeDomainData(data)
          qualityAccumulator.observeLevel(calculateNormalizedInputLevel(data))
        }, 120)
      }

      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      })

      recorder.start(250)
      recorderRef.current = recorder
      return recorder
    } catch (error) {
      if (ownsTrack) {
        try {
          recorderTrack.stop()
        } catch {
          // ignore cleanup error
        }
      }

      const message =
        error instanceof Error && error.message
          ? error.message
          : '训练录音初始化失败，请再点一次；如果还是这样，就是本地录音链路还没接稳。'
      throw new Error(message)
    }
  }, [analyser, getMicrophoneMediaStream, getMicrophoneStreamTrack])

  const stopLocalRecording = useCallback(async (): Promise<StopRecordingResult['recording']> => {
    const recorder = recorderRef.current
    const startedAt = recordingStartedAtRef.current
    recorderRef.current = null
    recordingStartedAtRef.current = null
    if (recordingQualityTimerRef.current !== null) {
      window.clearInterval(recordingQualityTimerRef.current)
      recordingQualityTimerRef.current = null
    }

    const finalize = async (): Promise<StopRecordingResult['recording']> => {
      const chunks = recordedChunksRef.current
      recordedChunksRef.current = []

      const track = recorderTrackRef.current
      recorderTrackRef.current = null
      const qualityMetrics = recordingQualityRef.current
        ? recordingQualityRef.current.finish(
            startedAt ? Math.max(300, Date.now() - startedAt) : 0,
          )
        : null
      recordingQualityRef.current = null
      const ownsTrack = recorderOwnsTrackRef.current
      recorderOwnsTrackRef.current = false
      if (ownsTrack) {
        track?.stop()
      }

      if (!chunks.length) {
        return null
      }

      const blob = new Blob(chunks, {
        type: recorder?.mimeType || 'audio/webm',
      })
      const stoppedAt = Date.now()
      const durationMs = startedAt ? Math.max(300, stoppedAt - startedAt) : 0
      const inputDevice = getRecordingInputDeviceMetadata(
        track,
        readPreferredMicrophoneDevice(),
      )

      return {
        recordingId: crypto.randomUUID(),
        sessionId: sessionIdRef.current ?? `training_local_${stoppedAt}`,
        mode: 'training',
        sourceSurface: 'web',
        collectionMode: 'supervised',
        createdAt: new Date(startedAt ?? stoppedAt).toISOString(),
        startedAt: new Date(startedAt ?? stoppedAt).toISOString(),
        stoppedAt: new Date(stoppedAt).toISOString(),
        audio: {
          blob,
          format: recorder?.mimeType || 'audio/webm',
          sampleRate: recordingSampleRateRef.current,
          channelCount: 1,
          durationMs,
          durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
          fileSizeBytes: blob.size,
          captureTransport: 'rtc_dup_track',
          inputDevice,
          quality: qualityMetrics ? {
            durationMs: qualityMetrics.duration_ms,
            speechDurationMs: qualityMetrics.speech_duration_ms,
            leadingSilenceMs: qualityMetrics.leading_silence_ms,
            trailingSilenceMs: qualityMetrics.trailing_silence_ms,
            silenceRatio: qualityMetrics.silence_ratio,
            inputLevelRms: qualityMetrics.input_level_rms,
            inputLevelPeak: qualityMetrics.input_level_peak,
            disposition: qualityMetrics.quality_disposition,
            reasons: qualityMetrics.quality_reasons,
          } : undefined,
        },
      }
    }

    if (!recorder) {
      return finalize()
    }

    if (recorder.state === 'inactive') {
      return finalize()
    }

    return new Promise((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          void finalize().then(resolve)
        },
        { once: true },
      )
      recorder.stop()
    })
  }, [])

  const readScopedFinalTranscript = useCallback((
    baseline: LatestUserTranscriptSnapshot,
    clientCaptureId: string,
  ): string => {
    void baseline
    return readCapturedTranscript(clientCaptureId)
  }, [readCapturedTranscript])

  const waitForFinalTranscript = useCallback(async (
    baseline: LatestUserTranscriptSnapshot,
    clientCaptureId: string,
  ): Promise<string> => {
    const baselineTrimmed = baseline.text.trim()
    const deadline = Date.now() + (shortUtteranceMode ? 8_500 : 7_000)
    let settledTranscript = ''
    let settledSince = 0

    while (Date.now() < deadline) {
      const latestFinal = readScopedFinalTranscript(baseline, clientCaptureId)
      const latestInterim =
        activeTranscriptStateRef.current.clientCaptureId === clientCaptureId
          ? currentASRTextRef.current.trim()
          : ''
      const bestObserved =
        activeTranscriptStateRef.current.clientCaptureId === clientCaptureId
          ? bestObservedTranscriptRef.current.trim()
          : ''
      const candidate = pickPreferredTrainingTranscriptCandidate({
        baseline: baselineTrimmed,
        latestFinal,
        latestInterim,
        bestObserved,
      })
      const candidateFinal =
        latestFinal && latestFinal !== baselineTrimmed
          ? latestFinal
          : ''

      if (candidate) {
        if (candidate !== settledTranscript) {
          settledTranscript = candidate
          settledSince = Date.now()
        } else if (Date.now() - settledSince >= (shortUtteranceMode ? 820 : 650) && candidateFinal) {
          return candidate
        } else if (
          Date.now() > deadline - (shortUtteranceMode ? 1_600 : 1_200)
          && Date.now() - settledSince >= (shortUtteranceMode ? 650 : 500)
        ) {
          return candidate
        }
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, shortUtteranceMode ? 140 : 120)
      })
    }

    const latestFinal = readScopedFinalTranscript(baseline, clientCaptureId)
    if (latestFinal && latestFinal !== baselineTrimmed) {
      return latestFinal
    }

    return pickPreferredTrainingTranscriptCandidate({
      baseline: baselineTrimmed,
      latestFinal,
      latestInterim: latestFinal ? currentASRTextRef.current : '',
      bestObserved: latestFinal ? bestObservedTranscriptRef.current : '',
    })
  }, [readScopedFinalTranscript, shortUtteranceMode])

  const startRecording = useCallback(async () => {
    setError(null)
    setIsConnecting(true)

    try {
      const clientCaptureId = crypto.randomUUID()
      activeClientCaptureIdRef.current = clientCaptureId
      recordingBaselineRef.current = latestUserTranscriptRef.current
      latestUserTranscriptRef.current = createEmptyTranscriptSnapshot()
      updateActiveTranscriptState(clientCaptureId, '')
      currentASRTextRef.current = ''
      bestObservedTranscriptRef.current = ''
      await startRtcRecording({ suppressGreeting: true })
      const recorder = beginLocalRecording()

      if (!recorder) {
        throw new Error('训练会话已连上，但录音没有真正开始。请再点一次；如果还是这样，就是代码链路还没接稳。')
      }

      sendSpeechActivity('speech_started', false, clientCaptureId)
    } catch (recordingError) {
      const message =
        recordingError instanceof Error ? recordingError.message : '录音启动失败，请检查麦克风权限。'
      setError(message)
      void stopRtcRecording().catch(() => {
        void disconnectRtc()
      })
      throw recordingError
    } finally {
      setIsConnecting(false)
    }
  }, [beginLocalRecording, disconnectRtc, sendSpeechActivity, startRtcRecording, stopRtcRecording])

  const stopRecording = useCallback(async (): Promise<StopRecordingResult> => {
    setIsProcessing(true)

    try {
      const finalizeStartedAt = Date.now()
      const clientCaptureId = activeClientCaptureIdRef.current ?? crypto.randomUUID()
      const recordingPromise = stopLocalRecording()
      sendSpeechActivity('speech_stopped', true, clientCaptureId)
      await new Promise((resolve) => {
        window.setTimeout(resolve, shortUtteranceMode ? 420 : 180)
      })
      await stopRtcRecording()
      const [recording, transcript] = await Promise.all([
        recordingPromise,
        waitForFinalTranscript(recordingBaselineRef.current, clientCaptureId),
      ])

      return {
        transcript: transcript.trim(),
        recording,
        transcriptLatencyMs: Math.max(0, Date.now() - finalizeStartedAt),
      }
    } finally {
      activeClientCaptureIdRef.current = null
      updateActiveTranscriptState(null, '')
      setIsProcessing(false)
    }
  }, [sendSpeechActivity, shortUtteranceMode, stopLocalRecording, stopRtcRecording, waitForFinalTranscript])

  const disconnect = useCallback(() => {
    setError(null)
    void stopLocalRecording()
    void disconnectRtc()
  }, [disconnectRtc, stopLocalRecording])

  const syncVoiceProfile = useCallback((payload: Record<string, unknown>) => {
    void sendControlEvent('update_voice_profile', payload).catch((eventError: unknown) => {
      const message =
        eventError instanceof Error ? eventError.message : '训练画像同步失败'
      setError(message)
    })
  }, [sendControlEvent])

  const sessionError = error || rtcError
  const status: SessionStatus = sessionError
    ? 'error'
    : isProcessing
      ? 'processing'
      : rtcIsRecording
        ? 'recording'
        : isConnecting
          ? 'connecting'
          : isConnected
            ? 'ready'
            : 'idle'

  return {
    status,
    interimText: currentASRText,
    finalText: latestUserTranscript,
    latestVoiceProfileSync: lastVoiceProfileSync,
    error: sessionError,
    isRecording: rtcIsRecording,
    isProcessing,
    isConnected,
    sessionIntent: rtc.sessionIntent,
    sessionReadiness: rtc.sessionReadiness,
    grantedCapabilities: rtc.grantedCapabilities,
    analyser,
    startRecording,
    stopRecording,
    syncVoiceProfile,
    sendSpeechActivity,
    disconnect,
  }
}
