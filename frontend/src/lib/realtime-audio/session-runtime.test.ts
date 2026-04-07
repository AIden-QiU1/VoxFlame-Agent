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
    executionBackend: 'livekit',
    userUid: 1001,
    botUid: 2001,
    appId: '',
    token: 'participant_token',
    rtmUserId: 'rtm-user-1',
    rtmChannelName: 'voxrtc_channel',
    rtmToken: 'participant_token',
    timeoutSeconds: 90,
    controlServerUrl: 'ws://127.0.0.1:3000',
    transport: {
      provider: 'livekit',
      serverUrl: 'ws://127.0.0.1:3000',
      roomName: 'voxrtc_channel',
      participantIdentity: 'rtm-user-1',
      participantName: 'vox-user-1001',
      participantToken: 'participant_token',
      participantMetadata: '{}',
      participantAttributes: {},
      agentDispatch: null,
    },
    intent: {
      surface: 'communication_workspace',
      mode: 'communication',
      sessionStrategy: 'heavy_realtime',
      scene: 'medical',
      requestedCapabilities: ['transport_send_control'],
      grantedCapabilities: ['transport_send_control'],
      deviceContext: {
        secureContext: true,
        mediaDevicesSupported: true,
        microphoneStatus: 'unknown',
        networkOnline: true,
      },
    },
    readiness: {
      canStart: true,
      requestedStrategy: 'heavy_realtime',
      resolvedStrategy: 'heavy_realtime',
      recommendedStrategy: 'heavy_realtime',
      microphoneRequired: true,
      blockers: [],
      warnings: [],
      summary: {
        status: 'ready',
        label: '已经准备好',
        detail: '沟通会话可以开始。',
        nextAction: '直接连接并开始表达。',
        blockerSummary: null,
        warningSummary: null,
      },
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
    transport: 'livekit_data',
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

test('session-runtime stores training coach feedback in rtc state', () => {
  const harness = createStateHarness()
  const latestTranscriptRef = { current: '' }

  const handleMessage = createDecodedRtcMessageHandler({
    memoryOwnerId: 'user-1',
    latestUserTranscriptRef: latestTranscriptRef,
    setState: harness.setState,
  })

  handleMessage({
    type: 'training_coach_feedback',
    exercise_id: 'exercise-1',
    exercise_text: '请先听我说完',
    recognized_text: '请先听我说话',
    feedback_text: '这次最后两个字有点跑掉了，先把“说完”慢一点，再录一遍。',
    source: 'livekit_training_extension',
    model: 'qwen3.5-plus',
  })

  assert.equal(
    harness.getState().lastTrainingCoachFeedback?.feedbackText,
    '这次最后两个字有点跑掉了，先把“说完”慢一点，再录一遍。',
  )
  assert.equal(harness.getState().lastTrainingCoachFeedback?.model, 'qwen3.5-plus')
})

test('session-runtime writes audio input telemetry into current session metadata', () => {
  const harness = createStateHarness()
  const latestTranscriptRef = { current: '' }
  const metadataUpdates: Array<Record<string, unknown>> = []
  const originalUpdateCurrentSessionMetadata = memoryService.updateCurrentSessionMetadata
  memoryService.updateCurrentSessionMetadata = ((metadata: Record<string, unknown>) => {
    metadataUpdates.push(metadata)
  }) as typeof memoryService.updateCurrentSessionMetadata

  try {
    const handleMessage = createDecodedRtcMessageHandler({
      memoryOwnerId: 'user-1',
      latestUserTranscriptRef: latestTranscriptRef,
      setState: harness.setState,
    })

    handleMessage({
      type: 'audio_input_telemetry',
      reason: 'clipping_detected',
      normalized_level: 0.11,
      peak_level: 0.99,
      clipping_detected: true,
      apm_enabled: true,
    })
  } finally {
    memoryService.updateCurrentSessionMetadata = originalUpdateCurrentSessionMetadata
  }

  assert.equal(metadataUpdates.length, 1)
  assert.equal(metadataUpdates[0].lastInputTelemetryReason, 'clipping_detected')
  assert.equal(metadataUpdates[0].lastInputNormalizedLevel, 0.11)
  assert.equal(metadataUpdates[0].lastInputPeakLevel, 0.99)
  assert.equal(metadataUpdates[0].lastInputClippingDetected, true)
  assert.equal(metadataUpdates[0].lastInputApmEnabled, true)
  assert.equal(metadataUpdates[0].audioClippingEventCount, 1)
})
