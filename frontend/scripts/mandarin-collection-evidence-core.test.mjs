import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildMandarinCollectionEvidence } from './mandarin-collection-evidence-core.mjs'

const reference = {
  source: { id: 'fixture' },
  syllables: ['ni'],
  syllable_tones: ['ni3'],
}

const pendingItem = {
  recording_id: 'r1', prompt_text: '你', audio_locator: 'r1',
  spoken_text: null, spoken_text_status: 'pending', audio_text_alignment: 'pending',
}

const baseSpokenQueue = {
  kind: 'voxflame_mandarin_spoken_text_review_queue',
  status: 'human_review_required_not_for_training',
  source_manifest_files: ['manifest.jsonl'],
  items: [pendingItem],
}

const baseDualQueue = {
  kind: 'voxflame_mandarin_dual_spoken_text_review_queue',
  status: 'human_review_required_not_for_training',
  source_manifest_files: ['manifest.jsonl'],
  items: [{
    review_item_id: 'd1', recording_id: 'r1', audio_locator: 'r1', prompt_text: '你',
    annotator_a: { status: 'pending', spoken_text: null, reviewed_by: null, reviewed_at: null },
    annotator_b: { status: 'pending', spoken_text: null, reviewed_by: null, reviewed_at: null },
    agreement_status: 'pending', consensus: { status: 'pending', spoken_text: null, reviewed_by: null, reviewed_at: null },
  }],
}

test('collection evidence keeps pending recordings out of coverage', () => {
  const evidence = buildMandarinCollectionEvidence({
    reference,
    spokenQueue: baseSpokenQueue,
    dualQueue: baseDualQueue,
    audioVerification: { audio_integrity_gate_passed: false, status_counts: { audio_missing: 1 }, results: [{ recording_id: 'r1', status: 'audio_missing' }] },
  })
  assert.equal(evidence.review.coverage_eligible_recordings, 0)
  assert.equal(evidence.coverage.human_spoken_text.summary.entries, 0)
  assert.equal(evidence.coverage.dual_consensus_audio_verified.summary.entries, 0)
})

test('approved spoken text counts only after confirmed alignment', () => {
  const spokenQueue = structuredClone(baseSpokenQueue)
  spokenQueue.items[0] = {
    ...pendingItem,
    spoken_text: '你', spoken_text_status: 'approved', audio_text_alignment: 'confirmed',
    reviewed_by: 'linguist@example.com', reviewed_at: '2026-08-23T00:00:00Z',
  }
  const evidence = buildMandarinCollectionEvidence({
    reference,
    spokenQueue,
    dualQueue: baseDualQueue,
    audioVerification: { audio_integrity_gate_passed: false, status_counts: { ok: 1 }, results: [{ recording_id: 'r1', status: 'ok' }] },
  })
  assert.equal(evidence.review.coverage_eligible_recordings, 1)
  assert.equal(evidence.coverage.human_spoken_text.summary.entries, 1)
})
