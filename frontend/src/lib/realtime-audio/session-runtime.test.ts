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

test('session-runtime writes training feedback into current session metadata', () => {
  const harness = createStateHarness()
  const latestTranscriptRef = { current: '' }
  const metadataUpdates: Array<Record<string, unknown>> = []
  const memoryEntries: Array<Record<string, unknown>> = []
  const originalUpdateCurrentSessionMetadata = memoryService.updateCurrentSessionMetadata
  const originalAddMemoryEntry = memoryService.addMemoryEntry
  memoryService.updateCurrentSessionMetadata = ((metadata: Record<string, unknown>) => {
    metadataUpdates.push(metadata)
  }) as typeof memoryService.updateCurrentSessionMetadata
  memoryService.addMemoryEntry = ((input: Record<string, unknown>) => {
    memoryEntries.push(input)
    return null
  }) as typeof memoryService.addMemoryEntry

  try {
    const handleMessage = createDecodedRtcMessageHandler({
      memoryOwnerId: 'user-1',
      latestUserTranscriptRef: latestTranscriptRef,
      setState: harness.setState,
    })

    handleMessage({
      type: 'training_feedback',
      exercise_id: 'exercise-1',
      feedback_status: 'close',
      summary: '这次先重点看“请先听我说完”。',
      next_step: '先单独慢练 2 次，再回整句。',
      clarity_score: 0.76,
      source: 'livekit_training_feedback',
      focus_tags: ['请先听我说完'],
      focus_syllables: ['请先', '说完'],
      pronunciation_initial_pairs: ['q/j'],
      pronunciation_targets: ['请先听我说完'],
      articulation_tip: '先把关键词慢慢送出来。',
      articulation_tips: ['先把关键词慢慢送出来。'],
    })
  } finally {
    memoryService.updateCurrentSessionMetadata = originalUpdateCurrentSessionMetadata
    memoryService.addMemoryEntry = originalAddMemoryEntry
  }

  assert.equal(metadataUpdates.length, 1)
  assert.equal(memoryEntries.length, 1)
  assert.equal(memoryEntries[0].type, 'voice_profile')
  assert.equal(memoryEntries[0].content, '这次先重点看“请先听我说完”。')
  assert.equal(
    (memoryEntries[0].metadata as Record<string, unknown>).kind,
    'training_result',
  )
  assert.equal(
    (memoryEntries[0].sessionMetadata as Record<string, unknown>).kind,
    'training',
  )
  assert.equal(
    (memoryEntries[0].sessionMetadata as Record<string, unknown>).source,
    'livekit_training_feedback',
  )
  assert.equal(metadataUpdates[0].lastTrainingFeedbackSource, 'livekit_training_feedback')
  assert.equal(metadataUpdates[0].lastTrainingFeedbackStatus, 'close')
  assert.equal(metadataUpdates[0].lastTrainingExerciseId, 'exercise-1')
  assert.deepEqual(metadataUpdates[0].lastTrainingFocusSyllables, ['请先', '说完'])
  assert.deepEqual(metadataUpdates[0].lastTrainingArticulationTips, ['先把关键词慢慢送出来。'])
  assert.deepEqual(metadataUpdates[0].lastTrainingPronunciationTargets, ['请先听我说完'])
  assert.equal(metadataUpdates[0].clarity_score, 0.76)
  assert.equal(
    harness.getState().lastTrainingFeedback?.summary,
    '这次先重点看“请先听我说完”。',
  )
})
