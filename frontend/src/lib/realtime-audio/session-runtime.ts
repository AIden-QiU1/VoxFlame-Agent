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
  applyConnectingState,
  applyRtcError,
} from './session-state'
import {
  connectSessionExecution,
  disconnectSessionExecution,
  type SessionExecutionClient,
} from './session-execution'
import type {
  LatestUserTranscriptSnapshot,
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
  latestUserTranscriptRef: MutableRefObject<LatestUserTranscriptSnapshot>
  onDecodedEnvelopeRef: MutableRefObject<((message: RtcMessageEnvelope) => void) | null>
}

interface CreateDecodedRtcMessageHandlerOptions {
  memoryOwnerId: string | null
  latestUserTranscriptRef: MutableRefObject<LatestUserTranscriptSnapshot>
  setState: Dispatch<SetStateAction<RtcAgentState>>
}

interface CreateRtmMessageHandlerOptions extends CreateDecodedRtcMessageHandlerOptions {
  inboundRtmChunksRef: MutableRefObject<Map<string, ChunkAccumulator>>
  onDecodedEnvelope?: (message: RtcMessageEnvelope) => void
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
  timeoutSeconds?: number
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

const SESSION_INIT_ACK_TIMEOUT_MS = 6_000
const SESSION_INIT_ACK_RETRY_DELAY_MS = 900
const SESSION_INIT_ACK_MAX_ATTEMPTS = 2

export class SessionBootstrapTimeoutError extends Error {
  constructor(message = '助手没有及时进入房间，当前这次连接不会有转录结果。') {
    super(message)
    this.name = 'SessionBootstrapTimeoutError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSessionInitAckMessage(
  message: RtcMessageEnvelope,
  requestId: string,
): boolean {
  if (message.type !== 'session_init_ack') {
    return false
  }

  if (!isRecord(message.metadata)) {
    return true
  }

  const metadataRequestId = message.metadata.request_id
  return typeof metadataRequestId !== 'string' || metadataRequestId === requestId
}

export function createSessionInitAckGate(
  requestId: string,
  timeoutMs: number = SESSION_INIT_ACK_TIMEOUT_MS,
) {
  let settled = false
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null
  let resolveReady: () => void = () => {}
  let rejectReady: (error: Error) => void = () => {}

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = () => {
      if (settled) {
        return
      }

      settled = true
      if (timeoutHandle) {
        globalThis.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
      resolve()
    }

    rejectReady = (error) => {
      if (settled) {
        return
      }

      settled = true
      if (timeoutHandle) {
        globalThis.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
      reject(error)
    }

    timeoutHandle = globalThis.setTimeout(() => {
      rejectReady(
        new SessionBootstrapTimeoutError(
          '助手还没有成功进入当前房间，系统已阻止这次“假连接”。请稍后重试。',
        ),
      )
    }, timeoutMs)
  })

  return {
    handleDecodedMessage: (message: RtcMessageEnvelope) => {
      if (!isSessionInitAckMessage(message, requestId)) {
        return
      }

      resolveReady()
    },
    waitForReady: () => ready,
    cleanup: () => {
      if (timeoutHandle) {
        globalThis.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    },
  }
}

function waitForDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

function resetRuntimeRefs(refs: SessionRuntimeRefs): void {
  refs.clientRef.current = null
  refs.rtmClientRef.current = null
  refs.micTrackRef.current = null
  refs.sessionRef.current = null
  refs.inboundRtmChunksRef.current.clear()
  refs.latestUserTranscriptRef.current = { text: '', clientCaptureId: null }
  refs.onDecodedEnvelopeRef.current = null
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

      if (message.type === 'session_userdata_ack' && isRecord(message.session_memory)) {
        const sessionMemory = message.session_memory
        const compactionCandidate = isRecord(message.compaction_candidate)
          ? message.compaction_candidate
          : undefined
        const hasCompactionCandidate = Boolean(
          (typeof compactionCandidate?.summary === 'string' && compactionCandidate.summary.trim().length > 0)
          || (Array.isArray(compactionCandidate?.risky_terms) && compactionCandidate.risky_terms.length > 0)
          || (Array.isArray(compactionCandidate?.support_strategies) && compactionCandidate.support_strategies.length > 0)
          || (Array.isArray(compactionCandidate?.recent_user_intents) && compactionCandidate.recent_user_intents.length > 0)
          || (Array.isArray(compactionCandidate?.recent_confirmed_phrases) && compactionCandidate.recent_confirmed_phrases.length > 0),
        )

        memoryService.updateCurrentSessionMetadata({
          serverCurrentTurnState:
            typeof sessionMemory.current_turn_state === 'string'
              ? sessionMemory.current_turn_state
              : undefined,
          serverTurnCount:
            typeof sessionMemory.turn_count === 'number'
              ? sessionMemory.turn_count
              : undefined,
          serverContextRevision:
            typeof sessionMemory.context_revision === 'number'
              ? sessionMemory.context_revision
              : undefined,
          serverPreparationSource:
            typeof sessionMemory.last_preparation_source === 'string'
              ? sessionMemory.last_preparation_source
              : undefined,
          serverInterruptionCount:
            typeof sessionMemory.interruption_count === 'number'
              ? sessionMemory.interruption_count
              : undefined,
          serverBargeInCount:
            typeof sessionMemory.barge_in_count === 'number'
              ? sessionMemory.barge_in_count
              : undefined,
          serverCaptionModeEnabled:
            typeof sessionMemory.caption_mode_enabled === 'boolean'
              ? sessionMemory.caption_mode_enabled
              : undefined,
          serverCompactionSummary:
            typeof compactionCandidate?.summary === 'string'
              ? compactionCandidate.summary
              : undefined,
          serverCompactionSessionKind:
            typeof compactionCandidate?.session_kind === 'string'
              ? compactionCandidate.session_kind
              : undefined,
          serverCompactionFallbackPhrases:
            Array.isArray(compactionCandidate?.fallback_phrases)
              ? compactionCandidate.fallback_phrases.filter((item): item is string => typeof item === 'string')
              : undefined,
          serverCompactionRiskyTerms:
            Array.isArray(compactionCandidate?.risky_terms)
              ? compactionCandidate.risky_terms.filter((item): item is string => typeof item === 'string')
              : undefined,
          serverCompactionSupportStrategies:
            Array.isArray(compactionCandidate?.support_strategies)
              ? compactionCandidate.support_strategies.filter((item): item is string => typeof item === 'string')
              : undefined,
          serverCompactionHotwords:
            Array.isArray(compactionCandidate?.hotwords)
              ? compactionCandidate.hotwords.filter((item): item is string => typeof item === 'string')
              : undefined,
          serverCompactionRecentUserIntents:
            Array.isArray(compactionCandidate?.recent_user_intents)
              ? compactionCandidate.recent_user_intents.filter((item): item is string => typeof item === 'string')
              : undefined,
          serverCompactionRecentConfirmedPhrases:
            Array.isArray(compactionCandidate?.recent_confirmed_phrases)
              ? compactionCandidate.recent_confirmed_phrases.filter((item): item is string => typeof item === 'string')
              : undefined,
        })
        if (hasCompactionCandidate) {
          void memoryService.persistCurrentSessionProfileUpdate()
        }

        setState((prev) => ({
          ...prev,
          lastSessionMemoryAck: {
            currentTurnState:
              typeof sessionMemory.current_turn_state === 'string'
                ? sessionMemory.current_turn_state
                : null,
            turnCount:
              typeof sessionMemory.turn_count === 'number'
                ? sessionMemory.turn_count
                : null,
            contextRevision:
              typeof sessionMemory.context_revision === 'number'
                ? sessionMemory.context_revision
                : null,
            preparationSource:
              typeof sessionMemory.last_preparation_source === 'string'
                ? sessionMemory.last_preparation_source
                : null,
            interruptionCount:
              typeof sessionMemory.interruption_count === 'number'
                ? sessionMemory.interruption_count
                : null,
            bargeInCount:
              typeof sessionMemory.barge_in_count === 'number'
                ? sessionMemory.barge_in_count
                : null,
          },
        }))
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
  onDecodedEnvelope,
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
    onDecodedEnvelope?.(envelope)
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

  resetRuntimeRefs(refs)
  refs.connectPromiseRef.current = null

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
  timeoutSeconds,
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

  setState((prev) => applyConnectingState(prev))

  const sessionIntent: RtcSessionIntent = {
    surface: surface ?? (mode === 'training' ? 'training_workspace' : 'communication_workspace'),
    mode,
    sessionStrategy: defaultStrategyForMode(mode),
    requestedCapabilities: requestedCapabilities ?? defaultCapabilitiesForMode(mode),
    scene,
    deviceContext: buildClientDeviceContext(mode),
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= SESSION_INIT_ACK_MAX_ATTEMPTS; attempt += 1) {
    const session = await startRtcSession(mode, sessionIntent, {
      executionBackend: executionBackend ?? config.rtc.executionBackend,
      accessToken,
      timeoutSeconds,
    })
    let client: SessionExecutionClient | null = null
    let rtmClient: SessionControlClient | null = null
    const initAckGate = createSessionInitAckGate(session.requestId)
    refs.onDecodedEnvelopeRef.current = initAckGate.handleDecodedMessage

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

      await initAckGate.waitForReady()

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

      refs.onDecodedEnvelopeRef.current = null
      initAckGate.cleanup()
      setState((prev) => applyConnectedRtcSession(prev, session, connectionNotice))
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      refs.onDecodedEnvelopeRef.current = null
      initAckGate.cleanup()

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
      resetRuntimeRefs(refs)

      try {
        await stopRtcSession(session.channelName, accessToken)
      } catch {
        // ignore cleanup error
      }

      if (
        lastError instanceof SessionBootstrapTimeoutError &&
        attempt < SESSION_INIT_ACK_MAX_ATTEMPTS
      ) {
        console.warn(
          '[useRtcAgentSession] agent bootstrap timed out, retrying session connect once',
        )
        setState((prev) => applyConnectingState(prev))
        await waitForDelay(SESSION_INIT_ACK_RETRY_DELAY_MS)
        continue
      }

      break
    }
  }

  const connectionError =
    lastError instanceof SessionBootstrapTimeoutError
      ? new Error(
          '助手没有真正进入房间，所以这次录音不会有转录结果。系统已自动重试一次，请再点连接；如果持续出现，请检查 livekit-agent 日志。',
        )
      : lastError ?? new Error('RTC 会话启动失败')

  setState((prev) => applyRtcError(prev, connectionError.message))
  throw connectionError
}
