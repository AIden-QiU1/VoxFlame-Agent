import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMandarinSpokenTextReviewQueue,
  mergeMandarinSpokenTextDecisions,
  reviewEntriesFromQueue,
  validateMandarinSpokenTextDecisionExport,
  validateMandarinSpokenTextReviewQueue,
} from './mandarin-spoken-text-review-core.mjs'

function baseQueue(item = {}) {
  return {
    kind: 'voxflame_mandarin_spoken_text_review_queue',
    status: 'human_review_required_not_for_training',
    source_manifest_files: ['manifest.jsonl'],
    items: [{
      recording_id: 'rec-1',
      audio_locator: 'rec-1',
      audio_filename: 'rec-1.wav',
      prompt_text: '请再说一次',
      category: '日常与出行',
      asr_hint: '请再说一次',
      asr_hint_role: 'non_authoritative_hint',
      spoken_text: null,
      spoken_text_status: 'pending',
      audio_text_alignment: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      ...item,
    }],
  }
}

test('pending queue is valid and produces no coverage entries', () => {
  const result = validateMandarinSpokenTextReviewQueue(baseQueue())
  assert.equal(result.valid, true)
  assert.equal(result.summary.coverage_eligible_items, 0)
  assert.deepEqual(reviewEntriesFromQueue(baseQueue()), [])
})

test('approved human text requires confirmed audio alignment and reviewer identity', () => {
  const approved = baseQueue({
    spoken_text: '请再说一次',
    spoken_text_status: 'approved',
    audio_text_alignment: 'confirmed',
    reviewed_by: 'reviewer-a',
    reviewed_at: '2026-08-23T10:00:00Z',
  })
  const result = validateMandarinSpokenTextReviewQueue(approved)
  assert.equal(result.valid, true)
  assert.equal(result.summary.coverage_eligible_items, 1)
  assert.deepEqual(reviewEntriesFromQueue(approved)[0], {
    text: '请再说一次',
    category: '日常与出行',
    recording_id: 'rec-1',
    review_source: 'human_spoken_text_review',
  })
})

test('ASR hint cannot be promoted by itself and identity fields are rejected', () => {
  const result = validateMandarinSpokenTextReviewQueue({
    ...baseQueue({ user_id: 'should-not-be-in-queue' }),
    items: [baseQueue().items[0]],
  })
  assert.equal(result.valid, true)
  const invalid = validateMandarinSpokenTextReviewQueue({
    ...baseQueue(),
    items: [{ ...baseQueue().items[0], metadata: { user_id: 'u1' } }],
  })
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.some((error) => error.includes('forbidden')))
})

test('storage paths and URLs cannot enter the review queue', () => {
  const result = validateMandarinSpokenTextReviewQueue({
    ...baseQueue(),
    items: [{ ...baseQueue().items[0], audio_locator: 'account/a.wav' }],
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('opaque locator')))
})

test('builder deduplicates recordings and preserves ASR only as an explicit hint', () => {
  const queue = buildMandarinSpokenTextReviewQueue([
    {
      recording_id: 'rec-1',
      prompt: { text: '请再说一次', category: '日常与出行' },
      audio: { path: 'account-uuid/audio/rec-1.wav', duration_ms: 1200 },
      transcript: { raw: '请再说一次' },
    },
    {
      recording_id: 'rec-1',
      prompt: { text: '请再说一次', category: '日常与出行' },
      audio: { path: 'account-uuid/audio/rec-1.wav', duration_ms: 1200 },
      transcript: { raw: '重复行不应产生第二条' },
    },
  ], { sourceManifestFiles: ['a.jsonl'] })
  assert.equal(queue.items.length, 1)
  assert.deepEqual(queue.source_manifest_files, ['a.jsonl'])
  assert.equal(queue.items[0].spoken_text, null)
  assert.equal(queue.items[0].asr_hint_role, 'non_authoritative_hint')
  assert.equal(queue.policy.training_import_allowed, false)
})

test('decision export requires the exact queue snapshot and reviewer attribution', () => {
  const queue = { ...baseQueue(), generated_at: '2026-08-23T09:00:00Z' }
  const decisions = {
    kind: 'voxflame_mandarin_spoken_text_review_decisions',
    source_generated_at: undefined,
    reviewer: 'reviewer@example.com',
    exported_at: '2026-08-23T10:00:00Z',
    items: [{
      recording_id: 'rec-1',
      spoken_text: '请再说一次',
      spoken_text_status: 'approved',
      audio_text_alignment: 'confirmed',
      reviewed_by: 'reviewer@example.com',
      reviewed_at: '2026-08-23T10:00:00Z',
    }],
  }
  const missingSnapshot = validateMandarinSpokenTextDecisionExport(decisions, queue)
  assert.equal(missingSnapshot.valid, false)
  assert.ok(missingSnapshot.errors.some((error) => error.includes('source_generated_at')))
})

test('decision merge is sparse and keeps pending recordings out of coverage', () => {
  const queue = { ...baseQueue(), generated_at: '2026-08-23T09:00:00Z' }
  const decisions = {
    kind: 'voxflame_mandarin_spoken_text_review_decisions',
    source_generated_at: queue.generated_at,
    reviewer: 'reviewer@example.com',
    exported_at: '2026-08-23T10:00:00Z',
    items: [{
      recording_id: 'rec-1',
      spoken_text: '请再说一次',
      spoken_text_status: 'approved',
      audio_text_alignment: 'confirmed',
      reviewed_by: 'reviewer@example.com',
      reviewed_at: '2026-08-23T10:00:00Z',
      reviewer_note: '音频清晰',
    }],
  }
  const validation = validateMandarinSpokenTextDecisionExport(decisions, queue)
  assert.equal(validation.valid, true)
  const merged = mergeMandarinSpokenTextDecisions(queue, decisions)
  assert.equal(merged.items[0].spoken_text_status, 'approved')
  assert.equal(merged.items[0].audio_text_alignment, 'confirmed')
  assert.equal(merged.items[0].reviewed_by, 'reviewer@example.com')
  assert.equal(merged.policy.training_import_allowed, false)
  assert.equal(reviewEntriesFromQueue(merged).length, 1)
})

test('decision export cannot promote ASR or partially approve audio', () => {
  const queue = { ...baseQueue(), generated_at: '2026-08-23T09:00:00Z' }
  const invalid = validateMandarinSpokenTextDecisionExport({
    kind: 'voxflame_mandarin_spoken_text_review_decisions',
    source_generated_at: queue.generated_at,
    reviewer: 'reviewer@example.com',
    exported_at: '2026-08-23T10:00:00Z',
    items: [{
      recording_id: 'rec-1',
      spoken_text: null,
      spoken_text_status: 'approved',
      audio_text_alignment: 'pending',
      reviewed_by: 'reviewer@example.com',
      reviewed_at: '2026-08-23T10:00:00Z',
    }],
  }, queue)
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.some((error) => error.includes('requires spoken_text')))
  assert.ok(invalid.errors.some((error) => error.includes('confirmed audio_text_alignment')))
})
