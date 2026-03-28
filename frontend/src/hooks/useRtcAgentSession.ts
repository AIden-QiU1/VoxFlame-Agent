'use client'

import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '@/lib/config'
import { memoryService } from '@/lib/memory/memory-service'
import { getValidToken } from '@/lib/supabase/client'

export type RtcSessionMode = 'communication' | 'training'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface DualLineSubtitle {
  originalText: string
  correctedText: string
  isCorrected: boolean
  timestamp: Date
}

export interface TrainingFeedbackEvent {
  requestId: string
  exerciseId: string
  exerciseText: string
  recognizedText: string
  status: string
  category: string
  clarityScore: number
  summary: string
  focusTags: string[]
  keywords: string[]
  confusionPatternsCount: number
  pronunciationSummary: string
  persisted: boolean
  memoryEnabled: boolean
  voiceProfileUpdateRequested: boolean
  voiceProfileUpdated: boolean
  encouragement: string
  primaryFocus: string
  primaryPinyin: string
  articulationTip: string
  nextStep: string
  source: string
  timestamp: Date
  error: string | null
  voiceProfileError: string | null
}

export interface VoiceProfileSyncEvent {
  source: string
  exerciseId: string
  category: string
  hotwordCount: number
  confusionPatternsCount: number
  clarityScore: number
  lastTrainingCategory: string
  timestamp: Date
}

const MICROPHONE_CONSTRAINTS = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const

interface StartRtcSessionResponse {
  requestId: string
  channelName: string
  graphName: string
  userUid: number
  botUid: number
  appId: string
  token: string
  rtmUserId: string
  rtmChannelName: string
  rtmToken: string
  timeoutSeconds: number
  controlServerUrl: string
}

interface RtcMessageEnvelope {
  type?: string
  name?: string
  role?: 'user' | 'assistant' | 'system'
  text?: string
  delta?: string
  full_text?: string
  corrected_text?: string
  original_text?: string
  clarity_score?: number
  is_final?: boolean
  error?: string
  message?: string
  feedback_request_id?: string
  metadata?: Record<string, unknown>
  data?: Record<string, unknown>
  exercise_id?: string
  exercise_text?: string
  recognized_text?: string
  feedback_status?: string
  exercise_category?: string
  summary?: string
  focus_tags?: string[]
  keywords?: string[]
  pronunciation_summary?: string
  encouragement?: string
  primary_focus?: string
  primary_pinyin?: string
  articulation_tip?: string
  next_step?: string
  confusion_patterns_count?: number
  persisted?: boolean
  memory_enabled?: boolean
  voice_profile_update_requested?: boolean
  voice_profile_updated?: boolean
  source?: string
  hotword_count?: number
  last_training_category?: string
}

interface RtmMessageEvent {
  message: string | Uint8Array
  publisher: string
  channelName: string
}

interface RtmStatusEvent {
  newState?: string
  reason?: string
}

interface AgoraRtmClient {
  login(options?: { token?: string }): Promise<unknown>
  logout(): Promise<unknown>
  publish(
    channelName: string,
    message: string | Uint8Array,
    options?: { channelType: 'MESSAGE' | 'STREAM' },
  ): Promise<unknown>
  subscribe(channelName: string): Promise<unknown>
  unsubscribe(channelName: string): Promise<unknown>
  addEventListener(
    eventName: 'message' | 'status',
    listener: ((event: RtmMessageEvent) => void) | ((event: RtmStatusEvent) => void),
  ): void
  removeEventListener(
    eventName: 'message' | 'status',
    listener: ((event: RtmMessageEvent) => void) | ((event: RtmStatusEvent) => void),
  ): void
}

export interface RtcAgentState {
  isConnected: boolean
  isRecording: boolean
  isThinking: boolean
  isSpeaking: boolean
  sessionId: string | null
  currentASRText: string
  currentResponseText: string
  currentDualLine: DualLineSubtitle | null
  latestUserTranscript: string
  messages: ConversationMessage[]
  error: string | null
  transport: 'rtc'
  lastTrainingFeedback: TrainingFeedbackEvent | null
  lastVoiceProfileSync: VoiceProfileSyncEvent | null
}

interface UseRtcAgentSessionOptions {
  userId?: string
  mode?: RtcSessionMode
  connectionNotice?: string | null
}

interface ConnectRtcOptions {
  suppressGreeting?: boolean
}

interface StartRecordingOptions extends ConnectRtcOptions {}

interface ChunkAccumulator {
  createdAt: number
  totalParts: number
  parts: Map<number, string>
}

const RTM_PUBLISH_OPTIONS = {
  channelType: 'MESSAGE' as const,
}

const RTM_CHUNK_TTL_MS = 15_000

function buildApiUrl(path: string): string {
  return `${config.api.baseUrl}${path}`
}

function createMessage(
  role: ConversationMessage['role'],
  content: string,
): ConversationMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date(),
  }
}

function parseEnvelope(text: string): RtcMessageEnvelope | null {
  try {
    const parsed = JSON.parse(text) as RtcMessageEnvelope
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function cleanupExpiredChunks(chunks: Map<string, ChunkAccumulator>, now: number): void {
  const expiredMessageIds: string[] = []
  chunks.forEach((chunk, messageId) => {
    if (now - chunk.createdAt > RTM_CHUNK_TTL_MS) {
      expiredMessageIds.push(messageId)
    }
  })
  expiredMessageIds.forEach((messageId) => {
    chunks.delete(messageId)
  })
}

function decodeBase64Utf8(content: string): string {
  const binary = window.atob(content)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function maybeAssembleChunkedMessage(
  rawText: string,
  chunks: Map<string, ChunkAccumulator>,
): string | null | undefined {
  const separatorIndex = rawText.indexOf('|')
  if (separatorIndex <= 0) {
    return undefined
  }

  const [messageId, partIndexRaw, totalPartsRaw, content] = rawText.split('|', 4)
  const partIndex = Number.parseInt(partIndexRaw, 10)
  const totalParts = Number.parseInt(totalPartsRaw, 10)

  if (!messageId || !content || !Number.isInteger(partIndex) || !Number.isInteger(totalParts)) {
    return undefined
  }

  const now = Date.now()
  cleanupExpiredChunks(chunks, now)

  const current =
    chunks.get(messageId) ??
    {
      createdAt: now,
      totalParts,
      parts: new Map<number, string>(),
    }

  current.parts.set(partIndex, content)
  current.totalParts = totalParts
  chunks.set(messageId, current)

  if (current.parts.size < totalParts) {
    return null
  }

  const ordered: string[] = []
  for (let index = 1; index <= totalParts; index += 1) {
    const part = current.parts.get(index)
    if (!part) {
      return null
    }
    ordered.push(part)
  }

  chunks.delete(messageId)
  return decodeBase64Utf8(ordered.join(''))
}

function decodeInboundMessage(
  message: string | Uint8Array,
  chunks: Map<string, ChunkAccumulator>,
): RtcMessageEnvelope | null {
  const text =
    typeof message === 'string' ? message : new TextDecoder().decode(message)

  const directEnvelope = parseEnvelope(text)
  if (directEnvelope) {
    return directEnvelope
  }

  const maybeChunked = maybeAssembleChunkedMessage(text, chunks)
  if (maybeChunked === undefined || maybeChunked === null) {
    return null
  }

  return parseEnvelope(maybeChunked)
}

function buildRtcClientId(session: StartRtcSessionResponse | null): string | null {
  if (!session) {
    return null
  }

  return String(session.userUid)
}

function formatMicrophoneError(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name || '')
      : ''
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : ''
  const normalized = `${name} ${message}`.toLowerCase()

  if (
    normalized.includes('notallowed') ||
    normalized.includes('permission denied') ||
    normalized.includes('permission dismissed')
  ) {
    return '麦克风权限未开启，请在浏览器里允许后再试一次。'
  }

  if (
    normalized.includes('notfound') ||
    normalized.includes('found no microphone') ||
    normalized.includes('requested device not found') ||
    normalized.includes('devices not found')
  ) {
    return '当前设备未检测到可用麦克风，可先用文字或短语沟通。'
  }

  if (
    normalized.includes('notreadable') ||
    normalized.includes('could not start audio source') ||
    normalized.includes('aborterror') ||
    normalized.includes('trackstarterror')
  ) {
    return '麦克风暂时无法使用，可能正被其他应用占用。'
  }

  if (
    normalized.includes('mediadevices api') ||
    normalized.includes('secure context') ||
    normalized.includes('https')
  ) {
    return '当前环境暂时无法访问麦克风，请确认使用 HTTPS 或本地地址访问。'
  }

  return '暂时无法访问麦克风，请检查浏览器权限和设备设置。'
}

function getSessionNotReadyMessage(mode: RtcSessionMode): string {
  return mode === 'training'
    ? '训练会话还没准备好，请重新点击开始录音。'
    : '请先连接助手。'
}

async function buildAuthorizedJsonHeaders(): Promise<Record<string, string>> {
  const token = await getValidToken()
  if (!token) {
    throw new Error('请先登录后再使用这个功能。')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function assertMicrophoneEnvironment(): void {
  if (typeof window === 'undefined') {
    throw new Error('当前环境暂时无法访问麦克风。')
  }

  if (!window.isSecureContext) {
    throw new Error('当前环境暂时无法访问麦克风，请确认使用 HTTPS 或本地地址访问。')
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器暂时不支持麦克风访问，请换到较新的浏览器再试。')
  }
}

async function publishRtmEnvelope(
  rtmClient: AgoraRtmClient,
  session: StartRtcSessionResponse,
  payload: Record<string, unknown>,
): Promise<void> {
  await rtmClient.publish(
    session.rtmChannelName || session.channelName,
    JSON.stringify(payload),
    RTM_PUBLISH_OPTIONS,
  )
}

async function createRtmClient(session: StartRtcSessionResponse): Promise<AgoraRtmClient> {
  const AgoraRTMModule = await import('agora-rtm')
  const AgoraRTM = AgoraRTMModule.default
  return new AgoraRTM.RTM(session.appId, session.rtmUserId)
}

export function useRtcAgentSession(options: UseRtcAgentSessionOptions = {}) {
  const {
    userId,
    mode = 'communication',
    connectionNotice = mode === 'training'
      ? null
      : '已连接，请点击下方麦克风开始说话，也可以先用文字或短语沟通。',
  } = options
  const memoryOwnerId = userId ?? null

  const [state, setState] = useState<RtcAgentState>({
    isConnected: false,
    isRecording: false,
    isThinking: false,
    isSpeaking: false,
    sessionId: null,
    currentASRText: '',
    currentResponseText: '',
    currentDualLine: null,
    latestUserTranscript: '',
    messages: [],
    error: null,
    transport: 'rtc',
    lastTrainingFeedback: null,
    lastVoiceProfileSync: null,
  })

  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const rtmClientRef = useRef<AgoraRtmClient | null>(null)
  const micTrackRef = useRef<ILocalAudioTrack | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const preflightMicStreamRef = useRef<MediaStream | null>(null)
  const micAudioContextRef = useRef<AudioContext | null>(null)
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const sessionRef = useRef<StartRtcSessionResponse | null>(null)
  const connectPromiseRef = useRef<Promise<void> | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const latestUserTranscriptRef = useRef('')
  const inboundRtmChunksRef = useRef<Map<string, ChunkAccumulator>>(new Map())
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  useEffect(() => {
    if (!memoryOwnerId) {
      return
    }

    memoryService.init(memoryOwnerId)
  }, [memoryOwnerId])

  const clearPing = useCallback(() => {
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  const cleanupMicrophoneResources = useCallback(() => {
    micSourceNodeRef.current?.disconnect()
    micSourceNodeRef.current = null

    micAnalyserRef.current?.disconnect()
    micAnalyserRef.current = null
    setAnalyser(null)

    const audioContext = micAudioContextRef.current
    micAudioContextRef.current = null
    if (audioContext) {
      void audioContext.close().catch((error) => {
        console.warn('[useRtcAgentSession] audio context close failed:', error)
      })
    }

    const mediaStream = micStreamRef.current
    micStreamRef.current = null
    mediaStream?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore cleanup error
      }
    })

    const preflightStream = preflightMicStreamRef.current
    preflightMicStreamRef.current = null
    preflightStream?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore cleanup error
      }
    })
  }, [])

  const warmUpMicrophoneStream = useCallback(async (): Promise<MediaStream> => {
    const existingStream = preflightMicStreamRef.current
    const existingTrack = existingStream?.getAudioTracks()[0]

    if (existingStream && existingTrack?.readyState === 'live') {
      return existingStream
    }

    preflightMicStreamRef.current = null
    assertMicrophoneEnvironment()

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: MICROPHONE_CONSTRAINTS,
      })
      const mediaStreamTrack = mediaStream.getAudioTracks()[0]

      if (!mediaStreamTrack) {
        mediaStream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {
            // ignore cleanup error
          }
        })
        throw new Error('当前设备未检测到可用麦克风，可先用文字或短语沟通。')
      }

      preflightMicStreamRef.current = mediaStream
      return mediaStream
    } catch (error) {
      throw new Error(formatMicrophoneError(error))
    }
  }, [])

  const pingSession = useCallback(async () => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    try {
      const headers = await buildAuthorizedJsonHeaders()
      await fetch(buildApiUrl('/rtc/session/ping'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ channelName: session.channelName }),
      })
    } catch (error) {
      console.error('[useRtcAgentSession] ping failed:', error)
    }
  }, [])

  const publishRtmMessage = useCallback(async (payload: Record<string, unknown>) => {
    const rtmClient = rtmClientRef.current
    const session = sessionRef.current
    if (!rtmClient || !session) {
      throw new Error('RTM 会话尚未就绪')
    }

    await publishRtmEnvelope(rtmClient, session, payload)
  }, [])

  const sendControlMessage = useCallback(
    async (type: string, payload: Record<string, unknown> = {}) => {
      const session = sessionRef.current
      const clientId = buildRtcClientId(session)

      await publishRtmMessage({
        type,
        client_id: clientId,
        session_id: session?.channelName,
        metadata: {
          client_id: clientId,
          session_id: session?.channelName,
          transport: 'agora_rtm',
          mode,
        },
        timestamp: Date.now(),
        ...payload,
      })
    },
    [mode, publishRtmMessage],
  )

  const syncProfile = useCallback(async (
    sendControl: (type: string, payload?: Record<string, unknown>) => Promise<void>,
    connectOptions?: ConnectRtcOptions,
  ) => {
    const voiceProfilePayload = memoryService.buildVoiceProfileSyncPayload()

    if (!userId) {
      throw new Error('请先登录后再使用这个功能。')
    }

    await sendControl('system_init', {
      user: { id: userId },
      suppress_greeting: Boolean(connectOptions?.suppressGreeting),
    })

    if (voiceProfilePayload) {
      await sendControl('update_voice_profile', voiceProfilePayload)
    }
  }, [userId])

  const handleDecodedMessage = useCallback((message: RtcMessageEnvelope) => {
    if (message.type === 'training_feedback') {
      setState((prev) => ({
        ...prev,
        lastTrainingFeedback: {
          requestId: message.feedback_request_id || '',
          exerciseId: message.exercise_id || '',
          exerciseText: message.exercise_text || '',
          recognizedText: message.recognized_text || '',
          status: message.feedback_status || 'unclear',
          category: message.exercise_category || '',
          clarityScore:
            typeof message.clarity_score === 'number' ? Math.round(message.clarity_score * 100) : 0,
          summary: message.summary || '',
          focusTags: readStringList(message.focus_tags),
          keywords: readStringList(message.keywords),
          confusionPatternsCount:
            typeof message.confusion_patterns_count === 'number' ? message.confusion_patterns_count : 0,
          pronunciationSummary: message.pronunciation_summary || '',
          persisted: message.persisted === true,
          memoryEnabled: message.memory_enabled !== false,
          voiceProfileUpdateRequested: message.voice_profile_update_requested === true,
          voiceProfileUpdated: message.voice_profile_updated === true,
          encouragement: message.encouragement || '',
          primaryFocus: message.primary_focus || '',
          primaryPinyin: message.primary_pinyin || '',
          articulationTip: message.articulation_tip || '',
          nextStep: message.next_step || '',
          source: typeof message.source === 'string' ? message.source : 'unknown',
          timestamp: new Date(),
          error: typeof message.error === 'string' ? message.error : null,
          voiceProfileError:
            typeof message.metadata?.voice_profile_error === 'string'
              ? message.metadata.voice_profile_error
              : null,
        },
      }))
      return
    }

    if (message.type === 'voice_profile_updated') {
      setState((prev) => ({
        ...prev,
        lastVoiceProfileSync: {
          source: typeof message.source === 'string' ? message.source : 'unknown',
          exerciseId: message.exercise_id || '',
          category: message.exercise_category || '',
          hotwordCount: typeof message.hotword_count === 'number' ? message.hotword_count : 0,
          confusionPatternsCount:
            typeof message.confusion_patterns_count === 'number' ? message.confusion_patterns_count : 0,
          clarityScore:
            typeof message.clarity_score === 'number' ? Math.round(message.clarity_score * 100) : 0,
          lastTrainingCategory: message.last_training_category || '',
          timestamp: new Date(),
        },
      }))
      return
    }

    if (message.type === 'error' || message.error) {
      setState((prev) => ({
        ...prev,
        error: message.error || message.message || 'RTC 会话出现错误',
      }))
      return
    }

    if (message.type === 'transcript' && message.text) {
      const correctionOriginal =
        (typeof message.metadata?.original === 'string' && message.metadata.original) || ''
      const isCorrectionEvent = message.metadata?.type === 'correction'

      if (message.role === 'user' && message.is_final) {
        latestUserTranscriptRef.current = message.text
        if (memoryOwnerId) {
          memoryService.addTurn('user', message.text)
        }
        setState((prev) => ({
          ...prev,
          currentASRText: '',
          latestUserTranscript: message.text!,
          messages: [...prev.messages, createMessage('user', message.text!)],
        }))
        return
      }

      if (message.role === 'assistant' && message.is_final) {
        if (memoryOwnerId) {
          memoryService.addTurn('assistant', message.text)
        }
        setState((prev) => ({
          ...prev,
          currentResponseText: '',
          isThinking: false,
          currentDualLine:
            isCorrectionEvent && correctionOriginal
              ? {
                  originalText: correctionOriginal,
                  correctedText: message.text!,
                  isCorrected: correctionOriginal !== message.text,
                  timestamp: new Date(),
                }
              : null,
          messages: [...prev.messages, createMessage('assistant', message.text!)],
        }))
        return
      }

      if (message.role === 'user') {
        setState((prev) => ({
          ...prev,
          currentASRText: message.text || '',
        }))
        return
      }
    }

    if (message.name === 'interim_text') {
      const text = message.data?.text
      if (typeof text === 'string') {
        setState((prev) => ({ ...prev, currentASRText: text }))
      }
      return
    }

    if (message.name === 'corrected_text') {
      const correctedText =
        (typeof message.data?.corrected_text === 'string' && message.data.corrected_text) ||
        message.corrected_text ||
        ''
      const originalText =
        (typeof message.data?.original_text === 'string' && message.data.original_text) ||
        message.original_text ||
        ''
      if (correctedText) {
        setState((prev) => ({
          ...prev,
          currentDualLine:
            originalText && correctedText && originalText !== correctedText
              ? {
                  originalText,
                  correctedText,
                  isCorrected: true,
                  timestamp: new Date(),
                }
              : null,
        }))
      }
      return
    }

    if (message.name === 'text_data') {
      const delta =
        (typeof message.data?.text === 'string' && message.data.text) ||
        message.delta ||
        ''
      const isFinal =
        (typeof message.data?.is_final === 'boolean' && message.data.is_final) ||
        message.is_final ||
        false

      setState((prev) => {
        const nextResponse = `${prev.currentResponseText}${delta}`
        if (!isFinal) {
          return {
            ...prev,
            isThinking: false,
            currentResponseText: nextResponse,
          }
        }

        return {
          ...prev,
          currentResponseText: '',
          messages: delta
            ? [...prev.messages, createMessage('assistant', nextResponse)]
            : prev.messages,
        }
      })
    }
  }, [memoryOwnerId])

  const handleRtmMessage = useCallback((event: RtmMessageEvent) => {
    const envelope = decodeInboundMessage(event.message, inboundRtmChunksRef.current)
    if (!envelope) {
      return
    }

    handleDecodedMessage(envelope)
  }, [handleDecodedMessage])

  const disconnect = useCallback(async () => {
    clearPing()

    const client = clientRef.current
    const rtmClient = rtmClientRef.current
    const micTrack = micTrackRef.current
    const session = sessionRef.current

    clientRef.current = null
    rtmClientRef.current = null
    micTrackRef.current = null
    sessionRef.current = null
    connectPromiseRef.current = null
    inboundRtmChunksRef.current.clear()

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isRecording: false,
      isSpeaking: false,
      isThinking: false,
      sessionId: null,
      lastTrainingFeedback: null,
      lastVoiceProfileSync: null,
    }))

    try {
      if (micTrack && client) {
        await client.unpublish([micTrack])
      }
    } catch (error) {
      console.warn('[useRtcAgentSession] unpublish failed:', error)
    }

    try {
      micTrack?.close()
    } catch (error) {
      console.warn('[useRtcAgentSession] mic close failed:', error)
    }
    cleanupMicrophoneResources()

    try {
      if (rtmClient && session) {
        await rtmClient.unsubscribe(session.rtmChannelName || session.channelName)
      }
    } catch (error) {
      console.warn('[useRtcAgentSession] RTM unsubscribe failed:', error)
    }

    try {
      await rtmClient?.logout()
    } catch (error) {
      console.warn('[useRtcAgentSession] RTM logout failed:', error)
    }

    try {
      await client?.leave()
    } catch (error) {
      console.warn('[useRtcAgentSession] leave failed:', error)
    }

    if (session) {
      try {
        const headers = await buildAuthorizedJsonHeaders()
        await fetch(buildApiUrl('/rtc/session/stop'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ channelName: session.channelName }),
        })
      } catch (error) {
        console.warn('[useRtcAgentSession] stop session failed:', error)
      }
    }
  }, [cleanupMicrophoneResources, clearPing])

  const ensureMicrophoneTrack = useCallback(async (): Promise<ILocalAudioTrack> => {
    const existingTrack = micTrackRef.current
    if (existingTrack && existingTrack.getMediaStreamTrack().readyState === 'live') {
      return existingTrack
    }

    if (existingTrack) {
      try {
        existingTrack.close()
      } catch {
        // ignore cleanup error
      }
      micTrackRef.current = null
      cleanupMicrophoneResources()
    }

    if (!clientRef.current && connectPromiseRef.current) {
      await connectPromiseRef.current
    }

    const client = clientRef.current
    if (!client) {
      throw new Error(getSessionNotReadyMessage(mode))
    }

    assertMicrophoneEnvironment()

    const AgoraRTCModule = await import('agora-rtc-sdk-ng')
    const AgoraRTC = AgoraRTCModule.default

    let mediaStream: MediaStream | null = null
    let track: ILocalAudioTrack | null = null
    let audioContext: AudioContext | null = null
    let sourceNode: MediaStreamAudioSourceNode | null = null
    let analyserNode: AnalyserNode | null = null

    try {
      mediaStream = preflightMicStreamRef.current
      preflightMicStreamRef.current = null

      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: MICROPHONE_CONSTRAINTS,
        })
      }

      const mediaStreamTrack = mediaStream.getAudioTracks()[0]
      if (!mediaStreamTrack) {
        throw new Error('当前设备未检测到可用麦克风，可先用文字或短语沟通。')
      }

      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      sourceNode = audioContext.createMediaStreamSource(mediaStream)
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.85
      sourceNode.connect(analyserNode)

      track = AgoraRTC.createCustomAudioTrack({
        mediaStreamTrack,
      })
      await client.publish([track])
      micTrackRef.current = track
      micStreamRef.current = mediaStream
      micAudioContextRef.current = audioContext
      micSourceNodeRef.current = sourceNode
      micAnalyserRef.current = analyserNode
      setAnalyser(analyserNode)
      return track
    } catch (error) {
      try {
        track?.close()
      } catch {
        // ignore cleanup error
      }
      try {
        sourceNode?.disconnect()
      } catch {
        // ignore cleanup error
      }
      try {
        analyserNode?.disconnect()
      } catch {
        // ignore cleanup error
      }
      if (audioContext) {
        void audioContext.close().catch(() => {
          // ignore cleanup error
        })
      }
      mediaStream?.getTracks().forEach((mediaTrack) => {
        try {
          mediaTrack.stop()
        } catch {
          // ignore cleanup error
        }
      })
      throw new Error(formatMicrophoneError(error))
    }
  }, [cleanupMicrophoneResources, mode])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  const connect = useCallback(async (connectOptions: ConnectRtcOptions = {}) => {
    if (!userId) {
      throw new Error('请先登录后再使用这个功能。')
    }

    if (clientRef.current && sessionRef.current) {
      return
    }

    if (connectPromiseRef.current) {
      await connectPromiseRef.current
      return
    }

    const connectPromise = (async () => {
      const AgoraRTCModule = await import('agora-rtc-sdk-ng')
      const AgoraRTC = AgoraRTCModule.default

      setState((prev) => ({ ...prev, error: null }))
      const headers = await buildAuthorizedJsonHeaders()

      const response = await fetch(buildApiUrl('/rtc/session/start'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'RTC 会话启动失败')
      }

      const session = (await response.json()) as StartRtcSessionResponse
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      let rtmClient: AgoraRtmClient | null = null
      let connectionError: Error | null = null

      client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
        if (mediaType !== 'audio') {
          return
        }

        await client.subscribe(user, 'audio')
        user.audioTrack?.play()
        setState((prev) => ({ ...prev, isSpeaking: true }))
      })

      client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType) => {
        if (mediaType === 'audio' && user.uid === session.botUid) {
          setState((prev) => ({ ...prev, isSpeaking: false }))
        }
      })

      client.on('connection-state-change', (currentState) => {
        if (currentState === 'DISCONNECTED') {
          setState((prev) => ({ ...prev, isConnected: false, isRecording: false }))
        }
      })

      try {
        await client.join(session.appId, session.channelName, session.token, session.userUid)

        rtmClient = await createRtmClient(session)
        rtmClient.addEventListener('message', handleRtmMessage)
        rtmClient.addEventListener('status', (event: RtmStatusEvent) => {
          if (event.newState === 'DISCONNECTED') {
            setState((prev) => ({
              ...prev,
              isConnected: false,
              error: event.reason || 'RTM 控制通道已断开',
            }))
          }
        })
        await rtmClient.login({ token: session.rtmToken || session.token })
        await rtmClient.subscribe(session.rtmChannelName || session.channelName)

        clientRef.current = client
        rtmClientRef.current = rtmClient
        sessionRef.current = session

        if (memoryOwnerId) {
          memoryService.updateCurrentSessionMetadata({
            kind: mode,
            source: 'rtc_agent',
          })
        }

        const bootstrapSendControlMessage = async (
          type: string,
          payload: Record<string, unknown> = {},
        ) => {
          const clientId = String(session.userUid)
          await publishRtmEnvelope(rtmClient!, session, {
            type,
            client_id: clientId,
            session_id: session.channelName,
            metadata: {
              client_id: clientId,
              session_id: session.channelName,
              transport: 'agora_rtm',
              mode,
            },
            timestamp: Date.now(),
            ...payload,
          })
        }

        await syncProfile(bootstrapSendControlMessage, connectOptions)

        clearPing()
        pingTimerRef.current = window.setInterval(() => {
          void pingSession()
        }, 30_000)

        setState((prev) => ({
          ...prev,
          isConnected: true,
          sessionId: session.channelName,
          error: null,
          messages:
            connectionNotice
              ? [
                  ...prev.messages,
                  createMessage('system', connectionNotice || ''),
                ]
              : prev.messages,
        }))
      } catch (error) {
        connectionError = error instanceof Error ? error : new Error(String(error))

        try {
          if (rtmClient) {
            await rtmClient.logout()
          }
        } catch {
          // ignore cleanup error
        }

        try {
          micTrackRef.current?.stop()
          micTrackRef.current?.close()
        } catch {
          // ignore cleanup error
        }

        try {
          await client.leave()
        } catch {
          // ignore cleanup error
        }

        try {
          const stopHeaders = await buildAuthorizedJsonHeaders()
          await fetch(buildApiUrl('/rtc/session/stop'), {
            method: 'POST',
            headers: stopHeaders,
            body: JSON.stringify({ channelName: session.channelName }),
          })
        } catch {
          // ignore cleanup error
        }
      }

      if (connectionError) {
        setState((prev) => ({ ...prev, error: connectionError.message }))
        throw connectionError
      }
    })()

    connectPromiseRef.current = connectPromise

    try {
      await connectPromise
    } finally {
      if (connectPromiseRef.current === connectPromise) {
        connectPromiseRef.current = null
      }
    }
  }, [
    clearPing,
    connectionNotice,
    handleRtmMessage,
    memoryOwnerId,
    mode,
    pingSession,
    syncProfile,
    userId,
  ])

  const startRecording = useCallback(async (recordingOptions: StartRecordingOptions = {}) => {
    if (!micTrackRef.current) {
      await warmUpMicrophoneStream()
    }

    if (!clientRef.current || !sessionRef.current) {
      await connect(recordingOptions)
    }

    const micTrack = await ensureMicrophoneTrack()

    await micTrack.setEnabled(true)
    latestUserTranscriptRef.current = ''
    setState((prev) => ({
      ...prev,
      isRecording: true,
      error: null,
      currentASRText: '',
      currentResponseText: '',
      currentDualLine: null,
      latestUserTranscript: '',
    }))
  }, [connect, ensureMicrophoneTrack, warmUpMicrophoneStream])

  const stopRecording = useCallback(async () => {
    const micTrack = micTrackRef.current
    if (!micTrack) {
      return
    }

    await micTrack.setEnabled(false)
    await sendControlMessage('end_audio', { reason: 'manual_stop' })
    setState((prev) => ({ ...prev, isRecording: false }))
  }, [sendControlMessage])

  const toggleRecording = useCallback(async () => {
    if (state.isRecording) {
      await stopRecording()
      return
    }

    await startRecording()
  }, [startRecording, state.isRecording, stopRecording])

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }

    if (!rtmClientRef.current || !sessionRef.current) {
      setState((prev) => ({
        ...prev,
        error: '请先连接 RTC 助手。',
      }))
      return
    }

    if (memoryOwnerId) {
      memoryService.addTurn('user', trimmed)
    }

    setState((prev) => ({
      ...prev,
      error: null,
      messages: [...prev.messages, createMessage('user', trimmed)],
    }))

    await sendControlMessage('user_input', {
      input_type: 'text',
      text: trimmed,
    })
  }, [memoryOwnerId, sendControlMessage])

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      currentASRText: '',
      currentResponseText: '',
      currentDualLine: null,
      latestUserTranscript: '',
      lastTrainingFeedback: null,
      lastVoiceProfileSync: null,
    }))
    latestUserTranscriptRef.current = ''
  }, [])

  const getMicrophoneStreamTrack = useCallback((): MediaStreamTrack | null => {
    return micTrackRef.current?.getMediaStreamTrack() ?? null
  }, [])

  const getMicrophoneMediaStream = useCallback((): MediaStream | null => {
    return micStreamRef.current ?? preflightMicStreamRef.current ?? null
  }, [])

  return {
    ...state,
    analyser,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    toggleRecording,
    sendText,
    sendControlEvent: sendControlMessage,
    clearMessages,
    getMicrophoneStreamTrack,
    getMicrophoneMediaStream,
  }
}

export default useRtcAgentSession
