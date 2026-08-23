import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isReviewerEmailAllowed,
  normalizeReviewerEmail,
  parseReviewerAllowlist,
  resolveDualAnnotatorRole,
} from './reviewer-access-core.ts'

test('reviewer allowlist normalizes case and common separators', () => {
  const allowlist = parseReviewerAllowlist(' Reviewer@Example.com,second@example.com; third@example.com\n')
  assert.deepEqual([...allowlist], [
    'reviewer@example.com',
    'second@example.com',
    'third@example.com',
  ])
})

test('reviewer access is closed when the allowlist or email is missing', () => {
  assert.equal(isReviewerEmailAllowed('reviewer@example.com', ''), false)
  assert.equal(isReviewerEmailAllowed(null, 'reviewer@example.com'), false)
  assert.equal(normalizeReviewerEmail('  '), null)
})

test('reviewer access requires an exact normalized email match', () => {
  const allowlist = 'reviewer@example.com, other@example.com'
  assert.equal(isReviewerEmailAllowed('REVIEWER@example.com', allowlist), true)
  assert.equal(isReviewerEmailAllowed('reviewer+extra@example.com', allowlist), false)
})

test('dual annotator role is assigned by separate allowlists and never defaults', () => {
  assert.equal(resolveDualAnnotatorRole('a@example.com', 'a@example.com', 'b@example.com'), 'annotator_a')
  assert.equal(resolveDualAnnotatorRole('b@example.com', 'a@example.com', 'b@example.com'), 'annotator_b')
  assert.equal(resolveDualAnnotatorRole('other@example.com', 'a@example.com', 'b@example.com'), null)
  assert.equal(resolveDualAnnotatorRole('same@example.com', 'same@example.com', 'same@example.com'), null)
})
