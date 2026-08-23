import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mergeCoreGapDecisions, validateCoreGapDecisionExport } from './mandarin-core-gap-decision-core.mjs'

const reviewPack = {
  generated_at: '2026-08-23T00:00:00Z',
  items: [{ id: 'a', reviews: { linguistic: 'pending', naturalness: 'pending', user_burden: 'pending', safety: 'pending', license: 'pending', product: 'pending' } }],
}

function decisions(reviews, notes = '') {
  return {
    kind: 'voxflame_mandarin_core_gap_review_decisions',
    source_generated_at: reviewPack.generated_at,
    reviewer: 'reviewer@example.com',
    exported_at: '2026-08-23T01:00:00Z',
    items: [{ id: 'a', reviews, review_notes: notes }],
  }
}

test('complete approved decisions merge with reviewer attribution', () => {
  const approved = Object.fromEntries(['linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product'].map((field) => [field, 'approved']))
  const merged = mergeCoreGapDecisions(reviewPack, decisions(approved))
  assert.equal(merged.items[0].reviewed_by, 'reviewer@example.com')
  assert.equal(merged.items[0].reviews.product, 'approved')
})

test('rewrite and rejection decisions require notes', () => {
  const reviews = { linguistic: 'approved', naturalness: 'rewrite', user_burden: 'approved', safety: 'approved', license: 'approved', product: 'rewrite' }
  assert.equal(validateCoreGapDecisionExport(decisions(reviews), reviewPack).valid, false)
  assert.equal(validateCoreGapDecisionExport(decisions(reviews, '改成更自然的日常句。'), reviewPack).valid, true)
})

test('stale source snapshots and unknown ids are rejected', () => {
  const approved = Object.fromEntries(['linguistic', 'naturalness', 'user_burden', 'safety', 'license', 'product'].map((field) => [field, 'approved']))
  const payload = decisions(approved)
  payload.source_generated_at = 'older'
  payload.items[0].id = 'unknown'
  const result = validateCoreGapDecisionExport(payload, reviewPack)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('source_generated_at')))
  assert.ok(result.errors.some((error) => error.includes('not in the review pack')))
})

test('reinforcement workspaces require their own decision kind', () => {
  const reinforcementReviewPack = {
    ...reviewPack,
    generated_at: 'snapshot',
    decision_kind: 'voxflame_mandarin_reinforcement_review_decisions',
  }
  const wrong = {
    kind: 'voxflame_mandarin_core_gap_review_decisions',
    source_generated_at: 'snapshot',
    reviewer: 'reviewer@example.com',
    exported_at: '2026-08-23T00:00:00Z',
    items: [],
  }
  assert.equal(validateCoreGapDecisionExport(wrong, reinforcementReviewPack).valid, false)
  assert.match(validateCoreGapDecisionExport(wrong, reinforcementReviewPack).errors[0], /reinforcement_review_decisions/)
  assert.equal(validateCoreGapDecisionExport({
    ...wrong,
    kind: 'voxflame_mandarin_reinforcement_review_decisions',
  }, reinforcementReviewPack).valid, true)
})
