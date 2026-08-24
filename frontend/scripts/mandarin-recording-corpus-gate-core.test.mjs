import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateMandarinRecordingCandidate } from './mandarin-recording-corpus-gate-core.mjs'

const base = {
  id: 'x',
  text: '请用筛子过滤细沙',
  category: '音系强化',
  target: 'shai1',
  coverage_targets: ['shai1'],
  prompt_type: 'short_sentence',
  source: 'VoxFlame authored candidate',
  target_carriers: [{ text: '筛子', source_pinyin: 'shai1 zi5', source: 'CC-CEDICT' }],
}

test('recording gate accepts traceable modern Chinese candidate', () => {
  assert.deepEqual(validateMandarinRecordingCandidate(base), { valid: true, errors: [] })
})

test('recording gate rejects commercial noise, unsupported text, and short sentence', () => {
  const result = validateMandarinRecordingCandidate({ ...base, text: '学习包', source: 'Tatoeba' })
  assert.equal(result.valid, false)
  assert.ok(result.errors.includes('commercial_noise'))
  assert.ok(result.errors.includes('sentence_length_out_of_range'))
})

test('recording gate does not require ASR or spoken_text fields', () => {
  const result = validateMandarinRecordingCandidate(base)
  assert.equal(result.valid, true)
})

test('recording gate checks every explicit target against whole-word or sentence reading evidence', () => {
  const result = validateMandarinRecordingCandidate({
    ...base,
    coverage_targets: ['shai1', 'jia2'],
    target: 'shai1',
    target_carriers: [{ text: '筛子', source_pinyin: 'shai1 zi5', source: 'CC-CEDICT' }],
    source_sentence_pinyin: 'shai1 zi5',
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.includes('target_reading_evidence_missing:jia2'))
})
