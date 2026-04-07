import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSessionCompactionMemoryInput,
  type Session,
} from './memory-service.ts'

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    userId: 'user-1',
    startTime: 1_710_000_000_000,
    endTime: 1_710_000_060_000,
    turns: [
      {
        id: 'turn-1',
        role: 'user',
        content: '我说话会慢一点，请先听我说完。',
        timestamp: 1_710_000_010_000,
        sessionId: 'session-1',
      },
    ],
    metadata: {
      kind: 'communication',
      source: 'rtc_agent',
      scene: 'medical',
      latestCorrectionOriginal: '请先听我说完',
      latestCorrectionText: '我说话会慢一点，请先听我说完。',
      lastTrainingFeedbackNextStep: '先把开场白和补救句练稳。',
      lastTrainingSpeechPatterns: ['请先', '说完'],
      lastTrainingArticulationTips: ['先把关键词慢慢送出来。'],
      lastTrainingPronunciationTargets: ['请先听我说完'],
      clarity_score: 0.72,
      interruptionCount: 2,
      bargeInCount: 1,
      lastInputTelemetryReason: 'clipping_detected',
      lastInputNormalizedLevel: 0.03,
      lastInputPeakLevel: 0.99,
      lastInputClippingDetected: true,
      lastInputApmEnabled: true,
      audioClippingEventCount: 2,
    },
    ...overrides,
  }
}

test('buildSessionCompactionMemoryInput compresses session signals into a semantic memory', () => {
  const input = buildSessionCompactionMemoryInput(createSession())

  assert.ok(input)
  assert.equal(input?.type, 'semantic')
  assert.match(input?.content ?? '', /更稳的表达是/)
  assert.equal(input?.metadata.kind, 'session_compaction')
  assert.deepEqual(input?.metadata.hotwords, ['请先听我说完'])
  assert.deepEqual(input?.metadata.risky_terms, ['请先听我说完'])
  assert.deepEqual(input?.metadata.fallback_phrases, ['我说话会慢一点，请先听我说完。'])
  assert.deepEqual(input?.metadata.pronunciation_patterns, ['请先', '说完', '先把关键词慢慢送出来。'])
  assert.equal(input?.metadata.interruption_count, 2)
  assert.equal(input?.metadata.barge_in_count, 1)
  assert.equal(input?.metadata.last_input_telemetry_reason, 'clipping_detected')
  assert.equal(input?.metadata.last_input_normalized_level, 0.03)
  assert.equal(input?.metadata.last_input_peak_level, 0.99)
  assert.equal(input?.metadata.last_input_clipping_detected, true)
  assert.equal(input?.metadata.last_input_apm_enabled, true)
  assert.equal(input?.metadata.audio_clipping_event_count, 2)
  assert.equal(input?.metadata.next_step, '先把开场白和补救句练稳。')
  assert.match(input?.content ?? '', /更稳的表达是/)
  assert.ok(
    (input?.metadata.support_strategies as string[]).some((item) => item.includes('麦克风')),
  )
})

test('buildSessionCompactionMemoryInput returns null when the session has no compressible signal', () => {
  const input = buildSessionCompactionMemoryInput(createSession({
    turns: [],
    metadata: {
      kind: 'communication',
      source: 'rtc_agent',
    },
  }))

  assert.equal(input, null)
})
