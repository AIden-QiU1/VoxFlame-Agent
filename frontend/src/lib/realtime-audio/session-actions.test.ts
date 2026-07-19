import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearRtcMessagesAction,
  getRtcMicrophoneMediaStream,
  sendRtcTextAction,
  startRtcRecordingAction,
  stopRtcRecordingAction,
} from './session-actions.ts'
import { createInitialRtcAgentState } from './session-state.ts'
import { memoryService } from '../memory/memory-service.ts'
import type { RtcAgentState } from './session-types.ts'

function createStateHarness(initialState: RtcAgentState = createInitialRtcAgentState()) {
  let state = initialState

  return {
    getState: () => state,
    setState: (updater: ((prev: RtcAgentState) => RtcAgentState) | RtcAgentState) => {
      state = typeof updater === 'function' ? updater(state) : updater
      return state
    },
  }
}

test('session-actions registers capture id before enabling audio and commits the same id after disabling', async () => {
  const harness = createStateHarness()
  const calls: string[] = []
  const track = {
    setEnabled: async (enabled: boolean) => {
      calls.push(`track:${enabled ? 'enabled' : 'disabled'}`)
    },
  }
  const micTrackRef = { current: track as never }
  const latestUserTranscriptRef = {
    current: { text: '旧结果', clientCaptureId: 'old-capture' },
  }
  const sendControlMessage = async (
    type: string,
    payload: Record<string, unknown> = {},
  ) => {
    calls.push(`${type}:${String(payload.client_capture_id || '')}`)
  }

  await startRtcRecordingAction({
    refs: {
      micTrackRef,
      micStreamRef: { current: null },
      preflightMicStreamRef: { current: null },
      sessionRef: { current: { channelName: 'training-room' } as never },
      latestUserTranscriptRef,
    },
    setState: harness.setState,
    connect: async () => undefined,
    ensureMicrophoneTrack: async () => track as never,
    warmUpMicrophoneStream: async () => ({}) as MediaStream,
    sendControlMessage,
    clientCaptureId: 'capture-1',
    shortUtteranceExpected: true,
  })

  await stopRtcRecordingAction({
    refs: {
      micTrackRef,
      latestUserTranscriptRef,
    },
    setState: harness.setState,
    sendControlMessage,
    clientCaptureId: 'capture-1',
  })

  assert.deepEqual(calls, [
    'speech_activity:capture-1',
    'track:enabled',
    'track:disabled',
    'speech_activity:capture-1',
    'end_audio:capture-1',
  ])
  assert.deepEqual(latestUserTranscriptRef.current, {
    text: '',
    clientCaptureId: null,
  })
  assert.equal(harness.getState().isRecording, false)
})

test('session-actions sets a user-facing error when text is sent before the control channel is ready', async () => {
  const harness = createStateHarness()
  const sendControlCalls: Array<[string, Record<string, unknown> | undefined]> = []
  const originalAddTurn = memoryService.addTurn
  memoryService.addTurn = ((...args: unknown[]) => {
    throw new Error(`unexpected addTurn call: ${JSON.stringify(args)}`)
  }) as typeof memoryService.addTurn

  try {
    await sendRtcTextAction({
      refs: {
        sessionRef: { current: null },
      },
      text: '你好',
      memoryOwnerId: 'user-1',
      setState: harness.setState,
      isControlChannelReady: () => false,
      sendControlMessage: async (type, payload) => {
        sendControlCalls.push([type, payload])
      },
    })
  } finally {
    memoryService.addTurn = originalAddTurn
  }

  assert.equal(harness.getState().error, '请先连接 RTC 助手。')
  assert.equal(sendControlCalls.length, 0)
})

test('session-actions appends the local user message and publishes a control event when ready', async () => {
  const harness = createStateHarness()
  const sendControlCalls: Array<[string, Record<string, unknown> | undefined]> = []
  const addTurnCalls: Array<[string, string]> = []
  const originalAddTurn = memoryService.addTurn
  memoryService.addTurn = ((role: string, content: string) => {
    addTurnCalls.push([role, content])
    return {} as never
  }) as typeof memoryService.addTurn

  try {
    await sendRtcTextAction({
      refs: {
        sessionRef: {
          current: {
            channelName: 'voxrtc_channel',
          } as never,
        },
      },
      text: '  我想表达清楚  ',
      memoryOwnerId: 'user-1',
      setState: harness.setState,
      isControlChannelReady: () => true,
      sendControlMessage: async (type, payload) => {
        sendControlCalls.push([type, payload])
      },
    })
  } finally {
    memoryService.addTurn = originalAddTurn
  }

  assert.deepEqual(addTurnCalls, [['user', '我想表达清楚']])
  assert.equal(harness.getState().messages.at(-1)?.content, '我想表达清楚')
  assert.deepEqual(sendControlCalls, [[
    'user_input',
    {
      input_type: 'text',
      text: '我想表达清楚',
    },
  ]])
})

test('session-actions clears conversation state and latest transcript refs together', () => {
  const harness = createStateHarness({
    ...createInitialRtcAgentState(),
    currentASRText: '临时转写',
    latestUserTranscript: '稳定转写',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: '你好',
        timestamp: new Date(),
      },
    ],
  })
  const latestTranscriptRef = {
    current: {
      text: '稳定转写',
      clientCaptureId: null,
    },
  }

  clearRtcMessagesAction(latestTranscriptRef, harness.setState)

  assert.equal(harness.getState().messages.length, 0)
  assert.equal(harness.getState().currentASRText, '')
  assert.equal(harness.getState().latestUserTranscript, '')
  assert.deepEqual(latestTranscriptRef.current, { text: '', clientCaptureId: null })
})

test('session-actions prefers the live microphone media stream and falls back to preflight stream', () => {
  const liveStream = { id: 'live-stream' } as MediaStream
  const preflightStream = { id: 'preflight-stream' } as MediaStream

  assert.equal(
    getRtcMicrophoneMediaStream(
      { current: liveStream },
      { current: preflightStream },
    ),
    liveStream,
  )

  assert.equal(
    getRtcMicrophoneMediaStream(
      { current: null },
      { current: preflightStream },
    ),
    preflightStream,
  )
})
