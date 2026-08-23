import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCoverageProductStatus } from './mandarin-coverage-product-status-core.mjs'

function sources() {
  return {
    reference: { sha256: 'reference' },
    character_readings: { sha256: 'characters' },
    lexical_carriers: { sha256: 'words' },
    external_sentences: { sha256: 'sentences' },
    current_prompt_corpus: { item_count: 10 },
  }
}

function fixtures() {
  return {
    ledger: {
      sources: sources(),
      summary: { coverage_status_counts: { robust: 1 } },
      targets: [
        { syllable_tone: 'shuan1', coverage_status: 'missing', tier: 'core' },
        { syllable_tone: 'n2', coverage_status: 'missing', tier: 'edge' },
        { syllable_tone: 'zhuai1', coverage_status: 'missing', tier: 'disputed' },
      ],
    },
    review: {
      sources: sources(),
      summary: { core_missing_targets: 1, targets_with_sufficient_candidates: 1, selected_items: 3 },
      target_status: [{ syllable_tone: 'shuan1' }],
    },
    approved: { summary: { approved_items: 0, approved_targets: 0 }, items: [] },
    reinforcement: {
      summary: {
        below_minimum_targets: 0,
        default_planned_targets: 0,
        selected_prompts: 0,
        planned_recording_slots: 0,
        status_counts: {},
        disputed_held_targets: 0,
      },
      source: { current_prompt_items: 10 },
      targets: [],
    },
  }
}

test('status is built only from synchronized ledger and review targets', () => {
  const payload = buildCoverageProductStatus({ ...fixtures(), generatedAt: '2026-08-23T00:00:00Z' })
  assert.equal(payload.core_gap_phase1.targets, 1)
  assert.equal(payload.held_targets.edge_missing, 1)
  assert.equal(payload.below_minimum_reinforcement.actual_confirmed_recording_hits, null)
  assert.equal(payload.actual_collection_evidence.status, 'evidence_not_loaded')
})

test('stale review targets fail instead of reaching the product UI', () => {
  const input = fixtures()
  input.review.target_status = []
  assert.throws(() => buildCoverageProductStatus(input), /review is stale/)
})

test('source drift fails even when target counts happen to match', () => {
  const input = fixtures()
  input.review.sources.lexical_carriers.sha256 = 'older-words'
  assert.throws(() => buildCoverageProductStatus(input), /source fingerprint/)
})

test('stale reinforcement target sets fail before reaching the product UI', () => {
  const input = fixtures()
  input.ledger.targets.push({ syllable_tone: 'ai2', coverage_status: 'below_minimum', tier: 'core' })
  assert.throws(() => buildCoverageProductStatus(input), /reinforcement plan is stale/)
})

test('actual collection evidence remains separate from planned reinforcement', () => {
  const payload = buildCoverageProductStatus({
    ...fixtures(),
    collectionEvidence: {
      review: {
        full_queue_items: 1185,
        full_queue_approved_items: 0,
        coverage_eligible_recordings: 0,
        dual_sample_items: 60,
        dual_consensus_items: 0,
        dual_audio_verified_consensus_items: 0,
        audio_integrity_gate_passed: false,
        audio_status_counts: { audio_missing: 11, ok: 49 },
      },
    },
  })
  assert.equal(payload.below_minimum_reinforcement.planned_recording_slots, 0)
  assert.equal(payload.actual_collection_evidence.coverage_eligible_recordings, 0)
  assert.equal(payload.actual_collection_evidence.audio_integrity_gate_passed, false)
})
