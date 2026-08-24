import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMandarinSpeakerDisjointSplit } from './mandarin-speaker-disjoint-split-core.mjs'

function row(id, speaker, text) {
  return {
    recording_id: id,
    user_id: speaker,
    prompt: { text, category: '音系强化' },
    audio: { duration_ms: 1000, file_size_bytes: 100, sample_rate: 16000 },
    consent: { scope: 'training_only', sync_status: 'uploaded' },
    metadata: { audio_quality_reasons: [] },
  }
}

test('speaker-disjoint split is deterministic and has no speaker overlap', () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, index) => row(`a-${index}`, 'speaker-a', `甲${index}`)),
    ...Array.from({ length: 4 }, (_, index) => row(`b-${index}`, 'speaker-b', `乙${index}`)),
    ...Array.from({ length: 3 }, (_, index) => row(`c-${index}`, 'speaker-c', `丙${index}`)),
    ...Array.from({ length: 2 }, (_, index) => row(`d-${index}`, 'speaker-d', `丁${index}`)),
  ]
  const first = buildMandarinSpeakerDisjointSplit({ rows, seed: 'test-seed' })
  const second = buildMandarinSpeakerDisjointSplit({ rows, seed: 'test-seed' })
  assert.deepEqual(first.split_summary, second.split_summary)
  assert.deepEqual(first.speaker_overlap, [])
  assert.equal(first.policy.selection_uses_model_output_or_cer, false)
  assert.equal(first.input.eligible_rows, rows.length)
  assert.equal(first.split_summary.train.speakers > 0, true)
  assert.equal(first.split_summary.validation.speakers > 0, true)
  assert.equal(first.split_summary.test.speakers > 0, true)
})

test('split excludes rows without speaker identity but does not alter collection eligibility', () => {
  const result = buildMandarinSpeakerDisjointSplit({ rows: [
    row('a', 'speaker-a', '甲乙'),
    row('b', 'speaker-b', '丙丁'),
    row('c', 'speaker-c', '戊己'),
    { ...row('missing', 'speaker-d', '庚辛'), user_id: undefined },
  ] })
  assert.equal(result.input.missing_speaker_identity_rows, 1)
  assert.equal(result.input.eligible_rows, 3)
})

