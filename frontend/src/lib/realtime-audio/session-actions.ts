'use client'

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react'
import type { ILocalAudioTrack } from 'agora-rtc-sdk-ng'
import { memoryService } from '@/lib/memory/memory-service'
import {
  applyClearedMessages,
  applyLocalUserText,
  applyRecordingStarted,
  applyRecordingStopped,
  applyRtcError,
} from './session-state'
import type { RtcAgentState, StartRtcSessionResponse } from './session-types'

interface SessionActionRefs {
  micTrackRef: MutableRefObject<ILocalAudioTrack | null>
  micStreamRef: MutableRefObject<MediaStream | null>
  preflightMicStreamRef: MutableRefObject<MediaStream | null>
  sessionRef: MutableRefObject<StartRtcSessionResponse | null>
  latestUserTranscriptRef: MutableRefObject<string>
}

interface StartRtcRecordingActionOptions {
  refs: SessionActionRefs
  setState: Dispatch<SetStateAction<RtcAgentState>>
  connect: (options?: { suppressGreeting?: boolean }) => Promise<void>
  ensureMicrophoneTrack: () => Promise<ILocalAudioTrack>
  warmUpMicrophoneStream: () => Promise<MediaStream>
  connectOptions?: { suppressGreeting?: boolean }
}

interface StopRtcRecordingActionOptions {
  refs: Pick<SessionActionRefs, 'micTrackRef' | 'latestUserTranscriptRef'>
  setState: Dispatch<SetStateAction<RtcAgentState>>
  sendControlMessage: (type: string, payload?: Record<string, unknown>) => Promise<void>
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
  connectOptions,
}: StartRtcRecordingActionOptions): Promise<void> {
  if (!refs.micTrackRef.current) {
    await warmUpMicrophoneStream()
  }

  if (!refs.sessionRef.current) {
    await connect(connectOptions)
  }

  const micTrack = await ensureMicrophoneTrack()
  await micTrack.setEnabled(true)
  refs.latestUserTranscriptRef.current = ''
  setState((prev) => applyRecordingStarted(prev))
}

export async function stopRtcRecordingAction({
  refs,
  setState,
  sendControlMessage,
}: StopRtcRecordingActionOptions): Promise<void> {
  const micTrack = refs.micTrackRef.current
  if (!micTrack) {
    return
  }

  await micTrack.setEnabled(false)
  await sendControlMessage('end_audio', { reason: 'manual_stop' })
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
    setState((prev) => applyRtcError(prev, '请先连接 RTC 助手。'))
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
  latestUserTranscriptRef: MutableRefObject<string>,
  setState: Dispatch<SetStateAction<RtcAgentState>>,
): void {
  setState((prev) => applyClearedMessages(prev))
  latestUserTranscriptRef.current = ''
}

export function getRtcMicrophoneStreamTrack(
  micTrackRef: MutableRefObject<ILocalAudioTrack | null>,
): MediaStreamTrack | null {
  return micTrackRef.current?.getMediaStreamTrack() ?? null
}

export function getRtcMicrophoneMediaStream(
  micStreamRef: MutableRefObject<MediaStream | null>,
  preflightMicStreamRef: MutableRefObject<MediaStream | null>,
): MediaStream | null {
  return micStreamRef.current ?? preflightMicStreamRef.current ?? null
}
