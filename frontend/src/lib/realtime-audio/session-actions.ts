'use client'

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react'
import { memoryService } from '@/lib/memory/memory-service'
import {
  applyClearedMessages,
  applyLocalUserText,
  applyRecordingStarted,
  applyRecordingStopped,
  applyRtcError,
} from './session-state'
import type {
  LatestUserTranscriptSnapshot,
  RtcAgentState,
  SessionMicrophoneTrack,
  StartRtcSessionResponse,
} from './session-types'

interface SessionActionRefs {
  micTrackRef: MutableRefObject<SessionMicrophoneTrack | null>
  micStreamRef: MutableRefObject<MediaStream | null>
  preflightMicStreamRef: MutableRefObject<MediaStream | null>
  sessionRef: MutableRefObject<StartRtcSessionResponse | null>
  latestUserTranscriptRef: MutableRefObject<LatestUserTranscriptSnapshot>
}

interface StartRtcRecordingActionOptions {
  refs: SessionActionRefs
  setState: Dispatch<SetStateAction<RtcAgentState>>
  connect: (options?: { suppressGreeting?: boolean }) => Promise<void>
  ensureMicrophoneTrack: () => Promise<SessionMicrophoneTrack>
  warmUpMicrophoneStream: () => Promise<MediaStream>
  sendControlMessage: (type: string, payload?: Record<string, unknown>) => Promise<void>
  connectOptions?: { suppressGreeting?: boolean }
  clientCaptureId?: string
  shortUtteranceExpected?: boolean
}

interface StopRtcRecordingActionOptions {
  refs: Pick<SessionActionRefs, 'micTrackRef' | 'latestUserTranscriptRef'>
  setState: Dispatch<SetStateAction<RtcAgentState>>
  sendControlMessage: (type: string, payload?: Record<string, unknown>) => Promise<void>
  clientCaptureId?: string
}

interface SendRtcTextActionOptions {
  refs: Pick<SessionActionRefs, 'sessionRef'>
  text: string
  memoryOwnerId: string | null
  setState: Dispatch<SetStateAction<RtcAgentState>>
  isControlChannelReady: () => boolean
  sendControlMessage: (type: string, payload?: Record<string, unknown>) => Promise<void>
}

export async function startRtcRecordingAction({
  refs,
  setState,
  connect,
  ensureMicrophoneTrack,
  warmUpMicrophoneStream,
  sendControlMessage,
  connectOptions,
  clientCaptureId,
  shortUtteranceExpected = false,
}: StartRtcRecordingActionOptions): Promise<void> {
  if (!refs.micTrackRef.current) {
    await warmUpMicrophoneStream()
  }

  if (!refs.sessionRef.current) {
    await connect(connectOptions)
  }

  const micTrack = await ensureMicrophoneTrack()
  if (clientCaptureId) {
    await sendControlMessage('speech_activity', {
      state: 'speech_started',
      auto_finalize: false,
      short_utterance_expected: shortUtteranceExpected,
      client_capture_id: clientCaptureId,
      detected_at: Date.now(),
    })
  }
  await micTrack.setEnabled(true)
  refs.latestUserTranscriptRef.current = { text: '', clientCaptureId: null }
  setState((prev) => applyRecordingStarted(prev))
}

export async function stopRtcRecordingAction({
  refs,
  setState,
  sendControlMessage,
  clientCaptureId,
}: StopRtcRecordingActionOptions): Promise<void> {
  const micTrack = refs.micTrackRef.current
  if (!micTrack) {
    return
  }

  await micTrack.setEnabled(false)
  if (clientCaptureId) {
    await sendControlMessage('speech_activity', {
      state: 'speech_stopped',
      auto_finalize: true,
      client_capture_id: clientCaptureId,
      detected_at: Date.now(),
    })
  }
  await sendControlMessage('end_audio', {
    reason: 'manual_stop',
    ...(clientCaptureId ? { client_capture_id: clientCaptureId } : {}),
  })
  setState((prev) => applyRecordingStopped(prev))
}

export async function sendRtcTextAction({
  refs,
  text,
  memoryOwnerId,
  setState,
  isControlChannelReady,
  sendControlMessage,
}: SendRtcTextActionOptions): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) {
    return
  }

  if (!refs.sessionRef.current || !isControlChannelReady()) {
    setState((prev) => applyRtcError(prev, '请先连接助手。'))
    return
  }

  if (memoryOwnerId) {
    memoryService.addTurn('user', trimmed)
  }

  setState((prev) => applyLocalUserText(prev, trimmed))
  await sendControlMessage('user_input', {
    input_type: 'text',
    text: trimmed,
  })
}

export function clearRtcMessagesAction(
  latestUserTranscriptRef: MutableRefObject<LatestUserTranscriptSnapshot>,
  setState: Dispatch<SetStateAction<RtcAgentState>>,
): void {
  setState((prev) => applyClearedMessages(prev))
  latestUserTranscriptRef.current = { text: '', clientCaptureId: null }
}

export function getRtcMicrophoneStreamTrack(
  micTrackRef: MutableRefObject<SessionMicrophoneTrack | null>,
): MediaStreamTrack | null {
  return micTrackRef.current?.getMediaStreamTrack() ?? null
}

export function getRtcMicrophoneMediaStream(
  micStreamRef: MutableRefObject<MediaStream | null>,
  preflightMicStreamRef: MutableRefObject<MediaStream | null>,
): MediaStream | null {
  return micStreamRef.current ?? preflightMicStreamRef.current ?? null
}
