'use client'

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react'
import { config } from '@/lib/config'
import {
  buildClientDeviceContext,
  defaultCapabilitiesForMode,
  defaultStrategyForMode,
  type RtcCapabilityId,
  type RtcExecutionBackend,
  type RtcScene,
  type RtcSessionIntent,
  type RtcSessionMode,
  type RtcSurface,
} from './session-contract'
import { createSessionTransportEventHandlers } from './session-effects'
import {
  applyConnectedRtcSession,
  decodeInboundEnvelopeFromEvent,
  extractLatestUserTranscriptFromEnvelope,
  extractMemoryTurnsFromEnvelope,
  publishSessionControlMessage,
  reduceRtcEnvelope,
  type ChunkAccumulator,
} from './session-messages'
import { syncRtcSessionProfile } from './session-profile'
import {
  pingRtcSession,
  startRtcSession,
  stopRtcSession,
} from './session-bootstrap'
import {
  applyDisconnectedState,
  applyRtcError,
} from './session-state'
import {
  connectSessionExecution,
  disconnectSessionExecution,
  type SessionExecutionClient,
} from './session-execution'
import type {
  RtcAgentState,
  RtcMessageEnvelope,
  RtmMessageEvent,
  SessionControlClient,
  SessionMicrophoneTrack,
  StartRtcSessionResponse,
} from './session-types'
import { memoryService } from '@/lib/memory/memory-service'

export interface SessionRuntimeRefs {
  clientRef: MutableRefObject<SessionExecutionClient | null>
  rtmClientRef: MutableRefObject<SessionControlClient | null>
  micTrackRef: MutableRefObject<SessionMicrophoneTrack | null>
  sessionRef: MutableRefObject<StartRtcSessionResponse | null>
  connectPromiseRef: MutableRefObject<Promise<void> | null>
  inboundRtmChunksRef: MutableRefObject<Map<string, ChunkAccumulator>>
  latestUserTranscriptRef: MutableRefObject<string>
}

interface CreateDecodedRtcMessageHandlerOptions {
  memoryOwnerId: string | null
  latestUserTranscriptRef: MutableRefObject<string>
  setState: Dispatch<SetStateAction<RtcAgentState>>
}

interface CreateRtmMessageHandlerOptions extends CreateDecodedRtcMessageHandlerOptions {
  inboundRtmChunksRef: MutableRefObject<Map<string, ChunkAccumulator>>
}

interface StartRtcRuntimeConnectionOptions {
  refs: SessionRuntimeRefs
  userId?: string
  accessToken?: string
  memoryOwnerId: string | null
  mode: RtcSessionMode
  surface?: RtcSurface
  scene?: RtcScene
  requestedCapabilities?: RtcCapabilityId[]
  executionBackend?: RtcExecutionBackend
  connectionNotice: string | null
  suppressGreeting?: boolean
  setState: Dispatch<SetStateAction<RtcAgentState>>
  clearPing: () => void
  cleanupMicrophoneResources: () => void
  pingTimerRef: MutableRefObject<number | null>
  handleRtmMessage: (event: RtmMessageEvent) => void
}

interface DisconnectRtcRuntimeOptions {
  refs: SessionRuntimeRefs
  accessToken?: string
  clearPing: () => void
  cleanupMicrophoneResources: () => void
  setState: Dispatch<SetStateAction<RtcAgentState>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export async function pingRtcRuntimeSession(
  sessionRef: MutableRefObject<StartRtcSessionResponse | null>,
  accessToken?: string,
): Promise<void> {
  const session = sessionRef.current
  if (!session) {
    return
  }

  try {
    await pingRtcSession(session.channelName, accessToken)
  } catch (error) {
    console.error('[useRtcAgentSession] ping failed:', error)
  }
}

export async function publishRtcRuntimeControlMessage(
  refs: Pick<SessionRuntimeRefs, 'rtmClientRef' | 'sessionRef'>,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const rtmClient = refs.rtmClientRef.current
  const session = refs.sessionRef.current
  if (!rtmClient || !session) {
    throw new Error('RTM 会话尚未就绪')
  }

  await publishSessionControlMessage({
    rtmClient,
    session,
    type,
    payload,
  })
}

export function createDecodedRtcMessageHandler({
  memoryOwnerId,
  latestUserTranscriptRef,
  setState,
}: CreateDecodedRtcMessageHandlerOptions): (message: RtcMessageEnvelope) => void {
  return (message) => {
    const nextLatestTranscript = extractLatestUserTranscriptFromEnvelope(message)
    if (nextLatestTranscript) {
      latestUserTranscriptRef.current = nextLatestTranscript
    }

    if (memoryOwnerId) {
      extractMemoryTurnsFromEnvelope(message).forEach((turn) => {
        memoryService.addTurn(turn.role, turn.content)
      })

      if (message.type === 'voice_profile_updated') {
        memoryService.updateCurrentSessionMetadata({
          lastVoiceProfileSource:
            typeof message.source === 'string' ? message.source : 'unknown',
          lastVoiceProfileUpdatedAt: Date.now(),
          clarity_score:
            typeof message.clarity_score === 'number' ? message.clarity_score : undefined,
          communicationScene:
            typeof message.exercise_category === 'string' ? message.exercise_category : undefined,
          communicationConfusionPatternsCount:
            typeof message.confusion_patterns_count === 'number'
              ? message.confusion_patterns_count
              : undefined,
        })
      }

      if (message.type === 'speech_activity') {
        const sessionMetadata = memoryService.peekSession()?.metadata
        const previousInterruptionCount =
          isRecord(sessionMetadata) && typeof sessionMetadata.interruptionCount === 'number'
            ? sessionMetadata.interruptionCount
            : 0
        const previousBargeInCount =
          isRecord(sessionMetadata) && typeof sessionMetadata.bargeInCount === 'number'
            ? sessionMetadata.bargeInCount
            : 0

        if (message.state === 'barge_in_triggered') {
          memoryService.updateCurrentSessionMetadata({
            interruptionCount: previousInterruptionCount + 1,
            bargeInCount: previousBargeInCount + 1,
            lastSpeechDurationMs:
              typeof message.speech_duration_ms === 'number'
                ? message.speech_duration_ms
                : undefined,
          })
        }
      }

      if (message.type === 'audio_input_telemetry') {
        const sessionMetadata = memoryService.peekSession()?.metadata
        const previousClippingCount =
          isRecord(sessionMetadata) && typeof sessionMetadata.audioClippingEventCount === 'number'
            ? sessionMetadata.audioClippingEventCount
            : 0

        const clippingDetected = message.clipping_detected === true
        const telemetryReason =
          typeof message.reason === 'string' && message.reason.trim()
            ? message.reason
            : undefined

        memoryService.updateCurrentSessionMetadata({
          lastAudioTelemetryAt: Date.now(),
          lastInputTelemetryReason: telemetryReason,
          lastInputNormalizedLevel:
            typeof message.normalized_level === 'number'
              ? message.normalized_level
              : undefined,
          lastInputPeakLevel:
            typeof message.peak_level === 'number'
              ? message.peak_level
              : undefined,
          lastInputClippingDetected: clippingDetected,
          lastInputApmEnabled: message.apm_enabled === true,
          audioClippingEventCount:
            clippingDetected && telemetryReason === 'clipping_detected'
              ? previousClippingCount + 1
              : previousClippingCount,
        })
      }
    }

    setState((prev) => reduceRtcEnvelope(prev, message))
  }
}

export function createRtmMessageHandler({
  inboundRtmChunksRef,
  memoryOwnerId,
  latestUserTranscriptRef,
  setState,
}: CreateRtmMessageHandlerOptions): (event: RtmMessageEvent) => void {
  const handleDecodedMessage = createDecodedRtcMessageHandler({
    memoryOwnerId,
    latestUserTranscriptRef,
    setState,
  })

  return (event) => {
    const envelope = decodeInboundEnvelopeFromEvent(event, inboundRtmChunksRef.current)
    if (!envelope) {
      return
    }

    handleDecodedMessage(envelope)
  }
}

export async function disconnectRtcRuntime({
  refs,
  accessToken,
  clearPing,
  cleanupMicrophoneResources,
  setState,
}: DisconnectRtcRuntimeOptions): Promise<void> {
  clearPing()

  const client = refs.clientRef.current
  const rtmClient = refs.rtmClientRef.current
  const micTrack = refs.micTrackRef.current
  const session = refs.sessionRef.current

  refs.clientRef.current = null
  refs.rtmClientRef.current = null
  refs.micTrackRef.current = null
  refs.sessionRef.current = null
  refs.connectPromiseRef.current = null
  refs.inboundRtmChunksRef.current.clear()

  setState((prev) => applyDisconnectedState(prev))

  await disconnectSessionExecution({
    clientHandle: client,
    rtmClient,
    micTrack,
    session,
  })
  cleanupMicrophoneResources()

  if (session) {
    try {
      await stopRtcSession(session.channelName, accessToken)
    } catch (error) {
      console.warn('[useRtcAgentSession] stop session failed:', error)
    }
  }
}

export async function startRtcRuntimeConnection({
  refs,
  userId,
  accessToken,
  memoryOwnerId,
  mode,
  surface,
  scene,
  requestedCapabilities,
  executionBackend,
  connectionNotice,
  suppressGreeting,
  setState,
  clearPing,
  cleanupMicrophoneResources,
  pingTimerRef,
  handleRtmMessage,
}: StartRtcRuntimeConnectionOptions): Promise<void> {
  if (!userId) {
    throw new Error('请先登录后再使用这个功能。')
  }

  if (!accessToken) {
    throw new Error('当前登录态还没有准备好，请刷新页面后再试。')
  }

  setState((prev) => applyRtcError(prev, ''))

  const sessionIntent: RtcSessionIntent = {
    surface: surface ?? (mode === 'training' ? 'training_workspace' : 'communication_workspace'),
    mode,
    sessionStrategy: defaultStrategyForMode(mode),
    requestedCapabilities: requestedCapabilities ?? defaultCapabilitiesForMode(mode),
    scene,
    deviceContext: buildClientDeviceContext(mode),
  }

  const session = await startRtcSession(mode, sessionIntent, {
    executionBackend: executionBackend ?? config.rtc.executionBackend,
    accessToken,
  })
  let client: SessionExecutionClient | null = null
  let rtmClient: SessionControlClient | null = null
  let connectionError: Error | null = null

  try {
    const transportEventHandlers = createSessionTransportEventHandlers(setState)
    const transport = await connectSessionExecution({
      session,
      onRtmMessage: handleRtmMessage,
      ...transportEventHandlers,
    })
    client = transport.clientHandle
    rtmClient = transport.rtmClient

    refs.clientRef.current = client
    refs.rtmClientRef.current = rtmClient
    refs.sessionRef.current = session

    if (memoryOwnerId) {
      memoryService.updateCurrentSessionMetadata({
        kind: session.intent.mode === 'training' ? 'training' : 'communication',
        source: 'rtc_agent',
        surface: session.intent.surface,
        scene: session.intent.scene,
        sessionStrategy: session.intent.sessionStrategy,
        executionBackend: session.executionBackend,
        transportProvider: session.transport.provider,
      })
    }

    const bootstrapSendControlMessage = async (
      type: string,
      payload: Record<string, unknown> = {},
    ) => {
      await publishSessionControlMessage({
        rtmClient: rtmClient!,
        session,
        type,
        payload,
      })
    }

    await syncRtcSessionProfile({
      session,
      userId,
      suppressGreeting,
      sendControl: bootstrapSendControlMessage,
    })

    clearPing()
    pingTimerRef.current = window.setInterval(() => {
      void pingRtcRuntimeSession(refs.sessionRef, accessToken)
    }, 30_000)

    setState((prev) => applyConnectedRtcSession(prev, session, connectionNotice))
  } catch (error) {
    connectionError = error instanceof Error ? error : new Error(String(error))

    try {
      refs.micTrackRef.current?.stop()
    } catch {
      // ignore cleanup error
    }

    await disconnectSessionExecution({
      clientHandle: client,
      rtmClient,
      micTrack: refs.micTrackRef.current,
      session,
    })
    cleanupMicrophoneResources()

    try {
      await stopRtcSession(session.channelName, accessToken)
    } catch {
      // ignore cleanup error
    }
  }

  if (connectionError) {
    setState((prev) => applyRtcError(prev, connectionError.message))
    throw connectionError
  }
}
