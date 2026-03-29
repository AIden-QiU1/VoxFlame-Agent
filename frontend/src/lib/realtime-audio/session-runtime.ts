'use client'

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react'
import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng'
import { connectAgoraTransport, disconnectAgoraTransport } from './agora-transport'
import {
  buildClientDeviceContext,
  defaultCapabilitiesForMode,
  defaultStrategyForMode,
  type RtcCapabilityId,
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
import type {
  AgoraRtmClient,
  RtcAgentState,
  RtcMessageEnvelope,
  RtmMessageEvent,
  StartRtcSessionResponse,
} from './session-types'
import { memoryService } from '@/lib/memory/memory-service'

export interface SessionRuntimeRefs {
  clientRef: MutableRefObject<IAgoraRTCClient | null>
  rtmClientRef: MutableRefObject<AgoraRtmClient | null>
  micTrackRef: MutableRefObject<ILocalAudioTrack | null>
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
  memoryOwnerId: string | null
  mode: RtcSessionMode
  surface?: RtcSurface
  scene?: RtcScene
  requestedCapabilities?: RtcCapabilityId[]
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
  clearPing: () => void
  cleanupMicrophoneResources: () => void
  setState: Dispatch<SetStateAction<RtcAgentState>>
}

export async function pingRtcRuntimeSession(
  sessionRef: MutableRefObject<StartRtcSessionResponse | null>,
): Promise<void> {
  const session = sessionRef.current
  if (!session) {
    return
  }

  try {
    await pingRtcSession(session.channelName)
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

  await disconnectAgoraTransport({
    client,
    rtmClient,
    micTrack,
    session,
  })
  cleanupMicrophoneResources()

  if (session) {
    try {
      await stopRtcSession(session.channelName)
    } catch (error) {
      console.warn('[useRtcAgentSession] stop session failed:', error)
    }
  }
}

export async function startRtcRuntimeConnection({
  refs,
  userId,
  memoryOwnerId,
  mode,
  surface,
  scene,
  requestedCapabilities,
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

  setState((prev) => applyRtcError(prev, ''))

  const sessionIntent: RtcSessionIntent = {
    surface: surface ?? (mode === 'training' ? 'training_workspace' : 'communication_workspace'),
    mode,
    sessionStrategy: defaultStrategyForMode(mode),
    requestedCapabilities: requestedCapabilities ?? defaultCapabilitiesForMode(mode),
    scene,
    deviceContext: buildClientDeviceContext(mode),
  }

  const session = await startRtcSession(mode, sessionIntent)
  let client: IAgoraRTCClient | null = null
  let rtmClient: AgoraRtmClient | null = null
  let connectionError: Error | null = null

  try {
    const transportEventHandlers = createSessionTransportEventHandlers(setState)
    const transport = await connectAgoraTransport({
      session,
      onRtmMessage: handleRtmMessage,
      ...transportEventHandlers,
    })
    client = transport.client
    rtmClient = transport.rtmClient

    refs.clientRef.current = client
    refs.rtmClientRef.current = rtmClient
    refs.sessionRef.current = session

    if (memoryOwnerId) {
      memoryService.updateCurrentSessionMetadata({
        kind: session.intent.mode === 'training' ? 'training' : 'communication',
        source: 'rtc_agent',
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
      void pingRtcRuntimeSession(refs.sessionRef)
    }, 30_000)

    setState((prev) => applyConnectedRtcSession(prev, session, connectionNotice))
  } catch (error) {
    connectionError = error instanceof Error ? error : new Error(String(error))

    try {
      refs.micTrackRef.current?.stop()
    } catch {
      // ignore cleanup error
    }

    await disconnectAgoraTransport({
      client,
      rtmClient,
      micTrack: refs.micTrackRef.current,
      session,
    })
    cleanupMicrophoneResources()

    try {
      await stopRtcSession(session.channelName)
    } catch {
      // ignore cleanup error
    }
  }

  if (connectionError) {
    setState((prev) => applyRtcError(prev, connectionError.message))
    throw connectionError
  }
}
