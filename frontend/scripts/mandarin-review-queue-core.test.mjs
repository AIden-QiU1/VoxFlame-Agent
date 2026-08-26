import assert from 'node:assert/strict'
import test from 'node:test'

import { validateMandarinReviewQueue } from './mandarin-review-queue-core.mjs'

function queueWithReviews(reviews) {
  return {
    kind: 'mandarin_gap_candidate_review_queue',
    status: 'human_review_required_not_for_production',
    source: {
      export_url: 'https://example.test/export.tsv.bz2',
      license: 'CC BY 2.0 FR',
      attribution_required: true,
    },
    items: [{
      id: 'candidate-1',
      text: '请再说一次',
      source_url: 'https://tatoeba.org/en/sentences/show/1',
      contributor: 'contributor',
      reviews,
    }],
  }
}

test('pending review queue is valid but never production-ready', () => {
  const result = validateMandarinReviewQueue(queueWithReviews({
    linguistic_review: 'pending',
    naturalness_review: 'pending',
    safety_review: 'pending',
    license_review: 'pending',
    task_review: 'pending',
  }))
  assert.equal(result.valid, true)
  assert.equal(result.summary.production_ready_items, 0)
  assert.equal(result.summary.production_import_allowed, false)
})

test('approved items require reviewer identity and timestamp', () => {
  const reviews = Object.fromEntries([
    'linguistic_review', 'naturalness_review', 'safety_review', 'license_review', 'task_review',
  ].map((field) => [field, 'approved']))
  const result = validateMandarinReviewQueue(queueWithReviews(reviews))
  assert.equal(result.valid, false)
  assert.match(result.errors[0], /reviewed_by/u)
})

test('invalid status and missing attribution are rejected', () => {
  const result = validateMandarinReviewQueue({
    ...queueWithReviews({
      linguistic_review: 'maybe',
      naturalness_review: 'pending',
      safety_review: 'pending',
      license_review: 'pending',
      task_review: 'pending',
    }),
    items: [{
      ...queueWithReviews({}).items[0],
      contributor: '',
    }],
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('contributor')))
  assert.ok(result.errors.some((error) => error.includes('linguistic_review')))
})
