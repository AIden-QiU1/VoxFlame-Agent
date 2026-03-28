'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'
import { useRtcAgentSession } from './useRtcAgentSession'

type SessionStatus = 'idle' | 'connecting' | 'ready' | 'recording' | 'processing' | 'error'

interface StopRecordingResult {
  transcript: string
  recording: VoxFlameRecordingEnvelope | null
}

interface UseMandarinTrainingSessionOptions {
  userId?: string
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

export function useMandarinTrainingSession(
  options: UseMandarinTrainingSessionOptions = {},
) {
  const { userId } = options
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const latestUserTranscriptRef = useRef('')
  const currentASRTextRef = useRef('')
  const recordingBaselineRef = useRef('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderTrackRef = useRef<MediaStreamTrack | null>(null)
  const recorderOwnsTrackRef = useRef(false)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingSampleRateRef = useRef<number>(16000)

  const rtc = useRtcAgentSession({
    userId,
    mode: 'training',
    connectionNotice: null,
  })
  const {
    sessionId,
    currentASRText,
    latestUserTranscript,
    lastTrainingFeedback,
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
    analyser,
  } = rtc

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    latestUserTranscriptRef.current = latestUserTranscript
  }, [latestUserTranscript])

  useEffect(() => {
    currentASRTextRef.current = currentASRText
  }, [currentASRText])

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
  }, [getMicrophoneMediaStream, getMicrophoneStreamTrack])

  const stopLocalRecording = useCallback(async (): Promise<StopRecordingResult['recording']> => {
    const recorder = recorderRef.current
    const startedAt = recordingStartedAtRef.current
    recorderRef.current = null
    recordingStartedAtRef.current = null

    const finalize = async (): Promise<StopRecordingResult['recording']> => {
      const chunks = recordedChunksRef.current
      recordedChunksRef.current = []

      const track = recorderTrackRef.current
      recorderTrackRef.current = null
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

  const waitForFinalTranscript = useCallback(async (baseline: string): Promise<string> => {
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      const nextTranscript = latestUserTranscriptRef.current.trim()
      if (nextTranscript && nextTranscript !== baseline.trim()) {
        return nextTranscript
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 100)
      })
    }

    return latestUserTranscriptRef.current.trim() || currentASRTextRef.current.trim()
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    setIsConnecting(true)

    try {
      recordingBaselineRef.current = latestUserTranscriptRef.current
      await startRtcRecording({ suppressGreeting: true })
      const recorder = beginLocalRecording()

      if (!recorder) {
        throw new Error('训练会话已连上，但录音没有真正开始。请再点一次；如果还是这样，就是代码链路还没接稳。')
      }
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
  }, [beginLocalRecording, disconnectRtc, startRtcRecording, stopRtcRecording])

  const stopRecording = useCallback(async (): Promise<StopRecordingResult> => {
    setIsProcessing(true)

    try {
      const recordingPromise = stopLocalRecording()
      await stopRtcRecording()
      const [recording, transcript] = await Promise.all([
        recordingPromise,
        waitForFinalTranscript(recordingBaselineRef.current),
      ])

      return {
        transcript,
        recording,
      }
    } finally {
      setIsProcessing(false)
    }
  }, [stopLocalRecording, stopRtcRecording, waitForFinalTranscript])

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

  const requestTrainingFeedback = useCallback((payload: Record<string, unknown>) => {
    void sendControlEvent('training_feedback_request', payload).catch((eventError: unknown) => {
      const message =
        eventError instanceof Error ? eventError.message : '训练建议生成失败'
      setError(message)
    })
  }, [sendControlEvent])

  const sendSpeechActivity = useCallback((
    state: 'speech_started' | 'speech_stopped',
    autoFinalize: boolean = false,
  ) => {
    void sendControlEvent('speech_activity', {
      state,
      auto_finalize: autoFinalize,
      detected_at: Date.now(),
    }).catch((eventError: unknown) => {
      console.warn('[useMandarinTrainingSession] speech activity send failed:', eventError)
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
    latestTrainingFeedback: lastTrainingFeedback,
    latestVoiceProfileSync: lastVoiceProfileSync,
    error: sessionError,
    isRecording: rtcIsRecording,
    isProcessing,
    isConnected,
    analyser,
    startRecording,
    stopRecording,
    syncVoiceProfile,
    requestTrainingFeedback,
    sendSpeechActivity,
    disconnect,
  }
}
