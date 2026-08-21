import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COLLECTION_PLANS,
  isCollectionPreflightReady,
} from './collection-protocol'

test('collection plans cover baseline, anchor, reading, and natural speech', () => {
  assert.deepEqual(
    COLLECTION_PLANS.map((plan) => plan.id),
    ['baseline', 'anchor', 'reading', 'natural_speech'],
  )
})

test('recording is blocked until the three preflight checks are complete', () => {
  assert.equal(isCollectionPreflightReady({
    environmentReady: true,
    distanceReady: true,
    understandsConsent: true,
  }), true)
  assert.equal(isCollectionPreflightReady({
    environmentReady: true,
    distanceReady: false,
    understandsConsent: true,
  }), false)
})
