import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDecodedRtcMessageHandler,
  publishRtcRuntimeControlMessage,
} from './session-runtime.ts'
import { createInitialRtcAgentState } from './session-state.ts'
import { memoryService } from '../memory/memory-service.ts'
import type { RtcAgentState, StartRtcSessionResponse } from './session-types.ts'

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

function createSession(): StartRtcSessionResponse {
  return {
    requestId: 'req_1',
    channelName: 'voxrtc_channel',
    graphName: 'voxflame_graph',
    userUid: 1001,
    botUid: 2001,
    appId: 'agora_app',
    token: 'rtc_token',
    rtmUserId: 'rtm-user-1',
    rtmChannelName: 'voxrtc_channel',
    rtmToken: 'rtm_token',
    timeoutSeconds: 90,
    controlServerUrl: 'http://127.0.0.1:3001',
    intent: {
      surface: 'communication_workspace',
      mode: 'communication',
      sessionStrategy: 'heavy_realtime',
      scene: 'medical',
      requestedCapabilities: ['transport_send_control'],
      grantedCapabilities: ['transport_send_control'],
      deviceContext: {
        client: 'web',
        microphone: 'unknown',
        secureContext: true,
      },
    },
    readiness: {
      canStart: true,
      blockers: [],
      warnings: [],
    },
  }
}

test('session-runtime throws when control messages are published before RTM is ready', async () => {
  await assert.rejects(
    publishRtcRuntimeControlMessage(
      {
        rtmClientRef: { current: null },
        sessionRef: { current: null },
      },
      'user_input',
      { text: '你好' },
    ),
    /RTM 会话尚未就绪/,
  )
})

test('session-runtime publishes a structured control envelope through RTM when ready', async () => {
  const publishCalls: Array<[string, string]> = []
  const session = createSession()

  await publishRtcRuntimeControlMessage(
    {
      rtmClientRef: {
        current: {
          publish: async (channelName: string, payload: string) => {
            publishCalls.push([channelName, payload])
          },
        } as never,
      },
      sessionRef: {
        current: session,
      },
    },
    'user_input',
    { input_type: 'text', text: '你好' },
  )

  assert.equal(publishCalls.length, 1)
  const [channelName, serializedPayload] = publishCalls[0]
  const payload = JSON.parse(serializedPayload) as Record<string, unknown>
  assert.equal(channelName, 'voxrtc_channel')
  assert.equal(payload.type, 'user_input')
  assert.equal(payload.client_id, '1001')
  assert.equal(payload.session_id, 'voxrtc_channel')
  assert.equal(payload.input_type, 'text')
  assert.equal(payload.text, '你好')
  assert.equal(typeof payload.timestamp, 'number')
  assert.deepEqual(payload.metadata, {
    client_id: '1001',
    session_id: 'voxrtc_channel',
    transport: 'agora_rtm',
    mode: 'communication',
    surface: 'communication_workspace',
    session_strategy: 'heavy_realtime',
  })
})

test('session-runtime updates latest transcript, memory turns, and reduced state for final user transcripts', () => {
  const harness = createStateHarness()
  const latestTranscriptRef = { current: '' }
  const addTurnCalls: Array<[string, string]> = []
  const originalAddTurn = memoryService.addTurn
  memoryService.addTurn = ((role: string, content: string) => {
    addTurnCalls.push([role, content])
    return {} as never
  }) as typeof memoryService.addTurn

  try {
    const handleMessage = createDecodedRtcMessageHandler({
      memoryOwnerId: 'user-1',
      latestUserTranscriptRef: latestTranscriptRef,
      setState: harness.setState,
    })

    handleMessage({
      type: 'transcript',
      role: 'user',
      text: '我想慢一点说',
      is_final: true,
    })
  } finally {
    memoryService.addTurn = originalAddTurn
  }

  assert.equal(latestTranscriptRef.current, '我想慢一点说')
  assert.deepEqual(addTurnCalls, [['user', '我想慢一点说']])
  assert.equal(harness.getState().messages.at(-1)?.content, '我想慢一点说')
  assert.equal(harness.getState().latestUserTranscript, '我想慢一点说')
})
