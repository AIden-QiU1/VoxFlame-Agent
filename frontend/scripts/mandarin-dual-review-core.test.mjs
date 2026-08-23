import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMandarinDualReviewQueue,
  consensusEntriesFromDualQueue,
  validateMandarinDualReviewQueue,
} from './mandarin-spoken-text-review-core.mjs'

function queue(item = {}) {
  return {
    kind: 'voxflame_mandarin_dual_spoken_text_review_queue',
    status: 'human_review_required_not_for_training',
    source_manifest_files: ['manifest.jsonl'],
    items: [{
      review_item_id: 'dual-1', recording_id: 'rec-1', audio_locator: 'rec-1',
      prompt_text: '请再说一次', category: '日常与出行',
      annotator_a: { status: 'completed', spoken_text: '请再说一次', reviewed_by: 'a', reviewed_at: '2026-08-23T10:00:00Z' },
      annotator_b: { status: 'completed', spoken_text: '请再说一次。', reviewed_by: 'b', reviewed_at: '2026-08-23T10:01:00Z' },
      agreement_status: 'agree',
      consensus: { status: 'approved', spoken_text: '请再说一次', reviewed_by: 'a+b', reviewed_at: '2026-08-23T10:02:00Z' },
      ...item,
    }],
  }
}

test('pending dual review is valid but not coverage eligible', () => {
  const payload = queue({
    annotator_a: { status: 'pending', spoken_text: null },
    annotator_b: { status: 'pending', spoken_text: null },
    agreement_status: 'pending',
    consensus: { status: 'pending', spoken_text: null },
  })
  const result = validateMandarinDualReviewQueue(payload)
  assert.equal(result.valid, true)
  assert.equal(result.summary.coverage_eligible_items, 0)
})

test('agreement normalizes punctuation but requires independent completed annotations', () => {
  const result = validateMandarinDualReviewQueue(queue())
  assert.equal(result.valid, true)
  assert.equal(result.summary.coverage_eligible_items, 1)
  assert.equal(consensusEntriesFromDualQueue(queue())[0].text, '请再说一次')
})

test('disagreement cannot silently use ASR or one annotator', () => {
  const result = validateMandarinDualReviewQueue(queue({
    annotator_b: { status: 'completed', spoken_text: '请再来一次', reviewed_by: 'b', reviewed_at: '2026-08-23T10:01:00Z' },
    agreement_status: 'disagree',
    consensus: { status: 'pending', spoken_text: null },
  }))
  assert.equal(result.valid, true)
  assert.equal(result.summary.coverage_eligible_items, 0)
  assert.deepEqual(consensusEntriesFromDualQueue(result), [])
})

test('builder omits ASR and keeps paths out of the dual review item', () => {
  const payload = buildMandarinDualReviewQueue([{
    recording_id: 'rec-1', prompt: { text: '请再说一次', category: '日常与出行' },
    audio: { path: 'account-uuid/audio/rec-1.wav', duration_ms: 1000 },
    transcript: { raw: '请再说一次' },
  }], { sourceManifestFiles: ['/secret/account/manifest.jsonl'] })
  assert.equal(payload.items.length, 1)
  assert.equal('asr_hint' in payload.items[0], false)
  assert.equal(payload.items[0].audio_locator, 'rec-1')
  assert.deepEqual(payload.source_manifest_files, ['manifest.jsonl'])
})
