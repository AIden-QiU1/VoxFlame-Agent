'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioProcessor } from '@/lib/audio/audio-processor'
import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import { ASRClient } from '@/lib/websocket/asr-client'

type SessionStatus = 'idle' | 'connecting' | 'ready' | 'recording' | 'processing' | 'error'

interface TrainingMessageData {
  text?: string
  is_final?: boolean
  role?: string
}

interface TrainingMessage {
  type: string
  name?: string
  data?: TrainingMessageData
  error?: string
}

interface StopRecordingResult {
  transcript: string
  recording: {
    blob: Blob
    duration: number
    sampleRate: number
  } | null
}

function isIgnorableError(errorText?: string): boolean {
  if (!errorText) {
    return false
  }

  return (
    errorText.includes('Missing') && errorText.includes('audio')
  ) || errorText.includes('NO_VALID_AUDIO_ERROR')
}

interface UseMandarinTrainingSessionOptions {
  anonymousUserId?: string
}

export function useMandarinTrainingSession(
  options: UseMandarinTrainingSessionOptions = {},
) {
  const { anonymousUserId } = options
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [interimText, setInterimText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<ASRClient | null>(null)
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const finalResolverRef = useRef<((value: string) => void) | null>(null)
  const latestInterimRef = useRef('')
  const latestFinalRef = useRef('')

  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor()

    return () => {
      audioProcessorRef.current?.stop()
      clientRef.current?.close()
    }
  }, [])

  const handleMessage = useCallback((message: TrainingMessage) => {
    if (message.type === 'error') {
      const errorText = message.error
      if (!isIgnorableError(errorText)) {
        setError(errorText || '训练连接出现错误')
        setStatus('error')
      }
      return
    }

    if (message.type !== 'data') {
      return
    }

    const payload = message.data
    if (!payload?.text) {
      return
    }

    if (message.name === 'interim_text') {
      latestInterimRef.current = payload.text
      setInterimText(payload.text)
      return
    }

    if (message.name === 'text_data' && payload.is_final !== undefined) {
      latestFinalRef.current = payload.text
      latestInterimRef.current = payload.text
      setFinalText(payload.text)
      setInterimText(payload.text)
      finalResolverRef.current?.(payload.text)
      finalResolverRef.current = null
      return
    }

    if (message.name === 'transcript' && payload.role === 'user') {
      latestFinalRef.current = payload.text
      latestInterimRef.current = payload.text
      setFinalText(payload.text)
      setInterimText(payload.text)
      finalResolverRef.current?.(payload.text)
      finalResolverRef.current = null
    }
  }, [])

  const ensureConnection = useCallback(async () => {
    if (clientRef.current?.isOpen()) {
      setStatus((current) => (current === 'idle' ? 'ready' : current))
      return
    }

    setStatus('connecting')
    setError(null)

    const token = await getValidToken()
    const wsUrl = new URL(
      config.api.agentWsUrl,
      typeof window !== 'undefined' ? window.location.href : 'http://localhost',
    )
    wsUrl.searchParams.set('suppress_greeting', '1')
    if (token) {
      wsUrl.searchParams.set('token', token)
    } else if (anonymousUserId) {
      wsUrl.searchParams.set('anon_id', anonymousUserId)
    }

    const client = new ASRClient(wsUrl.toString())
    clientRef.current = client

    await client.connect(
      () => {
        setStatus('ready')
      },
      (message) => {
        handleMessage(message as TrainingMessage)
      },
      () => {
        setError('训练连接失败，请稍后重试。')
        setStatus('error')
      },
      () => {
        setStatus('idle')
      },
    )
  }, [anonymousUserId, handleMessage])

  const resetTexts = useCallback(() => {
    latestInterimRef.current = ''
    latestFinalRef.current = ''
    setInterimText('')
    setFinalText('')
  }, [])

  const waitForFinalText = useCallback(async (timeoutMs: number): Promise<string> => {
    if (latestFinalRef.current) {
      return latestFinalRef.current
    }

    return new Promise((resolve) => {
      const fallbackTimer = window.setTimeout(() => {
        if (finalResolverRef.current) {
          finalResolverRef.current = null
          resolve(latestFinalRef.current || latestInterimRef.current)
        }
      }, timeoutMs)

      finalResolverRef.current = (value: string) => {
        window.clearTimeout(fallbackTimer)
        resolve(value)
      }
    })
  }, [])

  const startRecording = useCallback(async () => {
    if (!audioProcessorRef.current) {
      throw new Error('录音器未初始化')
    }

    await ensureConnection()
    resetTexts()

    try {
      await audioProcessorRef.current.start((audioBuffer) => {
        clientRef.current?.sendAudio(audioBuffer)
      }, true)
      setStatus('recording')
    } catch (startError) {
      setStatus(clientRef.current?.isOpen() ? 'ready' : 'error')
      throw startError
    }
  }, [ensureConnection, resetTexts])

  const stopRecording = useCallback(async (): Promise<StopRecordingResult> => {
    if (!audioProcessorRef.current) {
      return {
        transcript: '',
        recording: null,
      }
    }

    setStatus('processing')
    const recording = audioProcessorRef.current.stop()
    clientRef.current?.endAudioStream()

    const transcript = await waitForFinalText(1200)
    setStatus(clientRef.current?.isOpen() ? 'ready' : 'idle')

    return {
      transcript,
      recording,
    }
  }, [waitForFinalText])

  const disconnect = useCallback(() => {
    clientRef.current?.close()
    clientRef.current = null
    setStatus('idle')
  }, [])

  const sendTrainingResult = useCallback((payload: Record<string, unknown>) => {
    if (!clientRef.current?.isOpen()) {
      return
    }

    clientRef.current.send({
      type: 'training_result',
      ...payload,
    })
  }, [])

  return {
    status,
    interimText,
    finalText,
    error,
    isRecording: status === 'recording',
    isProcessing: status === 'processing',
    isConnected: status === 'ready' || status === 'recording' || status === 'processing',
    startRecording,
    stopRecording,
    sendTrainingResult,
    disconnect,
  }
}
