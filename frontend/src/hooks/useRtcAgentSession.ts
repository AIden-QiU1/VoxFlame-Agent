'use client'

import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { memoryService } from '@/lib/memory/memory-service'
import {
  clearRtcMessagesAction,
  getRtcMicrophoneMediaStream,
  getRtcMicrophoneStreamTrack,
  sendRtcTextAction,
  startRtcRecordingAction,
  stopRtcRecordingAction,
} from '@/lib/realtime-audio/session-actions'
import {
  cleanupSessionMicrophoneResources,
  ensurePublishedMicrophoneTrack,
  warmUpSessionMicrophone,
} from '@/lib/realtime-audio/session-audio'
import {
  type RtcCapabilityId,
  type RtcScene,
  type RtcSessionMode,
  type RtcSurface,
} from '@/lib/realtime-audio/session-contract'
import {
  createInitialRtcAgentState,
} from '@/lib/realtime-audio/session-state'
import { type ChunkAccumulator } from '@/lib/realtime-audio/session-messages'
import {
  createRtmMessageHandler,
  disconnectRtcRuntime,
  publishRtcRuntimeControlMessage,
  startRtcRuntimeConnection,
} from '@/lib/realtime-audio/session-runtime'
import type {
  AgoraRtmClient,
  RtcAgentState,
  StartRtcSessionResponse,
} from '@/lib/realtime-audio/session-types'
export type {
  ConversationMessage,
  DualLineSubtitle,
  TrainingFeedbackEvent,
  VoiceProfileSyncEvent,
  RtcAgentState,
} from '@/lib/realtime-audio/session-types'

interface UseRtcAgentSessionOptions {
  userId?: string
  mode?: RtcSessionMode
  surface?: RtcSurface
  scene?: RtcScene
  requestedCapabilities?: RtcCapabilityId[]
  connectionNotice?: string | null
}

interface ConnectRtcOptions {
  suppressGreeting?: boolean
}

interface StartRecordingOptions extends ConnectRtcOptions {}

export function useRtcAgentSession(options: UseRtcAgentSessionOptions = {}) {
  const {
    userId,
    mode = 'communication',
    surface,
    scene,
    requestedCapabilities,
    connectionNotice = mode === 'training'
      ? null
      : '已连接，请点击下方麦克风开始说话，也可以先用文字或短语沟通。',
  } = options
  const memoryOwnerId = userId ?? null

  const [state, setState] = useState<RtcAgentState>(createInitialRtcAgentState)

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
    cleanupSessionMicrophoneResources({
      micTrackRef,
      micStreamRef,
      preflightMicStreamRef,
      micAudioContextRef,
      micSourceNodeRef,
      micAnalyserRef,
    }, setAnalyser)
  }, [])

  const warmUpMicrophoneStream = useCallback(async (): Promise<MediaStream> => {
    return warmUpSessionMicrophone(preflightMicStreamRef)
  }, [])

  const sendControlMessage = useCallback(
    async (type: string, payload: Record<string, unknown> = {}) => {
      await publishRtcRuntimeControlMessage(
        {
          rtmClientRef,
          sessionRef,
        },
        type,
        payload,
      )
    },
    [],
  )

  const handleRtmMessage = useMemo(() => {
    return createRtmMessageHandler({
      inboundRtmChunksRef,
      memoryOwnerId,
      latestUserTranscriptRef,
      setState,
    })
  }, [memoryOwnerId])

  const disconnect = useCallback(async () => {
    await disconnectRtcRuntime({
      refs: {
        clientRef,
        rtmClientRef,
        micTrackRef,
        sessionRef,
        connectPromiseRef,
        inboundRtmChunksRef,
        latestUserTranscriptRef,
      },
      clearPing,
      cleanupMicrophoneResources,
      setState,
    })
  }, [cleanupMicrophoneResources, clearPing])

  const ensureMicrophoneTrack = useCallback(async (): Promise<ILocalAudioTrack> => {
    return ensurePublishedMicrophoneTrack({
      clientRef,
      connectPromiseRef,
      micTrackRef,
      micStreamRef,
      preflightMicStreamRef,
      micAudioContextRef,
      micSourceNodeRef,
      micAnalyserRef,
      mode,
      setAnalyser,
      cleanupMicrophoneResources,
    })
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
      await startRtcRuntimeConnection({
        refs: {
          clientRef,
          rtmClientRef,
          micTrackRef,
          sessionRef,
          connectPromiseRef,
          inboundRtmChunksRef,
          latestUserTranscriptRef,
        },
        userId,
        memoryOwnerId,
        mode,
        surface,
        scene,
        requestedCapabilities,
        connectionNotice,
        suppressGreeting: connectOptions.suppressGreeting,
        setState,
        clearPing,
        cleanupMicrophoneResources,
        pingTimerRef,
        handleRtmMessage,
      })
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
    cleanupMicrophoneResources,
    connectionNotice,
    handleRtmMessage,
    memoryOwnerId,
    mode,
    requestedCapabilities,
    scene,
    surface,
    userId,
  ])

  const startRecording = useCallback(async (recordingOptions: StartRecordingOptions = {}) => {
    await startRtcRecordingAction({
      refs: {
        micTrackRef,
        micStreamRef,
        preflightMicStreamRef,
        sessionRef,
        latestUserTranscriptRef,
      },
      setState,
      connect,
      ensureMicrophoneTrack,
      warmUpMicrophoneStream,
      connectOptions: recordingOptions,
    })
  }, [connect, ensureMicrophoneTrack, warmUpMicrophoneStream])

  const stopRecording = useCallback(async () => {
    await stopRtcRecordingAction({
      refs: {
        micTrackRef,
        latestUserTranscriptRef,
      },
      setState,
      sendControlMessage,
    })
  }, [sendControlMessage])

  const toggleRecording = useCallback(async () => {
    if (state.isRecording) {
      await stopRecording()
      return
    }

    await startRecording()
  }, [startRecording, state.isRecording, stopRecording])

  const sendText = useCallback(async (text: string) => {
    await sendRtcTextAction({
      refs: {
        sessionRef,
      },
      text,
      memoryOwnerId,
      setState,
      isControlChannelReady: () => Boolean(rtmClientRef.current),
      sendControlMessage,
    })
  }, [memoryOwnerId, sendControlMessage])

  const clearMessages = useCallback(() => {
    clearRtcMessagesAction(latestUserTranscriptRef, setState)
  }, [])

  const getMicrophoneStreamTrack = useCallback((): MediaStreamTrack | null => {
    return getRtcMicrophoneStreamTrack(micTrackRef)
  }, [])

  const getMicrophoneMediaStream = useCallback((): MediaStream | null => {
    return getRtcMicrophoneMediaStream(micStreamRef, preflightMicStreamRef)
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
