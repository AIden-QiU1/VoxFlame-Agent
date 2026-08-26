import assert from 'node:assert/strict'
import test from 'node:test'

import { validateMandarinEvaluationReport } from './mandarin-evaluation-gate-core.mjs'

function report(overrides = {}) {
  return {
    evaluation_id: 'eval-2026-08-23-001',
    baseline_id: 'baseline-fixed-001',
    candidate_id: 'candidate-shadow-001',
    dataset_version: 'voxflame-cdsd-shadow-v1',
    split_policy: {
      speaker_disjoint: 'true',
      frozen_test_set: 'test-speaker-disjoint-v1',
    },
    metrics: {
      overall_cer: 0.4,
      worst_speaker_cer: 0.7,
      short_utterance_cer: 0.5,
      p95_latency_ms: 900,
      user_task_success_rate: 0.7,
      user_skip_rate: 0.1,
      user_fatigue_rate: 0.1,
      severity_buckets: [{ label: 'unknown', count: 10, cer: 0.4 }],
      length_buckets: [{ label: '1-3_chars', count: 10, cer: 0.5 }],
    },
    rollback: {
      trigger: 'worst_speaker_cer or task success regresses against baseline',
      action: 'restore baseline model and disable candidate flag',
      verified: true,
    },
    decision: 'validate',
    ...overrides,
  }
}

test('evaluation gate accepts a complete shadow report', () => {
  assert.equal(validateMandarinEvaluationReport(report()).valid, true)
})

test('evaluation gate rejects missing speaker-disjoint and strata evidence', () => {
  const result = validateMandarinEvaluationReport(report({
    split_policy: { speaker_disjoint: 'false', frozen_test_set: '' },
    metrics: { overall_cer: 0.4 },
  }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('speaker_disjoint')))
  assert.ok(result.errors.some((error) => error.includes('severity_buckets')))
})

test('adopt requires verified rollback and measured user benefit', () => {
  const result = validateMandarinEvaluationReport(report({
    decision: 'adopt',
    metrics: { ...report().metrics, user_task_success_rate: 0 },
    rollback: { ...report().rollback, verified: false },
  }))
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('user_task_success_rate')))
  assert.ok(result.errors.some((error) => error.includes('rollback')))
})
