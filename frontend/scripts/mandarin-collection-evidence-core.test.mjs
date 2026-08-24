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
  status: 'optional_quality_review_not_for_training',
  source_manifest_files: ['manifest.jsonl'],
  items: [pendingItem],
}

const baseManifestRow = {
  recording_id: 'r1',
  prompt: { text: '你', category: '日常与出行', target_focus: ['ni3'] },
  audio: { duration_ms: 1000, file_size_bytes: 100, path: 'r1.wav' },
  consent: { scope: 'training_only', sync_status: 'uploaded' },
}

test('collection evidence keeps pending recordings out of coverage', () => {
  const evidence = buildMandarinCollectionEvidence({
    reference,
    spokenQueue: baseSpokenQueue,
    manifestRows: [{ ...baseManifestRow, audio: { ...baseManifestRow.audio, file_size_bytes: 0 } }],
  })
  assert.equal(evidence.review.coverage_eligible_recordings, 0)
  assert.equal(evidence.coverage.human_spoken_text.summary.entries, 0)
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
    manifestRows: [baseManifestRow],
  })
  assert.equal(evidence.review.coverage_eligible_recordings, 1)
  assert.equal(evidence.coverage.collected_audio_with_target.summary.entries, 1)
  assert.equal(evidence.coverage.human_spoken_text.summary.entries, 1)
})

test('collection coverage keeps quality anomalies as dispositions', () => {
  const evidence = buildMandarinCollectionEvidence({
    reference,
    spokenQueue: baseSpokenQueue,
    manifestRows: [{
      ...baseManifestRow,
      metadata: { audio_quality_reasons: ['too_much_silence'], silence_ratio: 0.9 },
    }],
  })
  assert.equal(evidence.review.coverage_eligible_recordings, 1)
  assert.equal(evidence.review.manifest_collection_quality_statuses.long_silence, 1)
})

test('collection coverage can be built without the optional spoken-text queue', () => {
  const evidence = buildMandarinCollectionEvidence({
    reference,
    spokenQueue: null,
    manifestRows: [baseManifestRow],
  })
  assert.equal(evidence.review.full_queue_items, 0)
  assert.equal(evidence.review.coverage_eligible_recordings, 1)
  assert.equal(evidence.coverage.collected_audio_with_target.summary.entries, 1)
})

test('collection coverage preserves explicit prompt targets without requiring spoken text', () => {
  const evidence = buildMandarinCollectionEvidence({
    reference: { ...reference, syllable_tones: ['ni3'] },
    spokenQueue: null,
    manifestRows: [baseManifestRow],
  })
  assert.equal(evidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.present, 1)
  assert.deepEqual(evidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.missing, [])
})

test('collection coverage ignores non-phonological feedback labels as explicit targets', () => {
  const evidence = buildMandarinCollectionEvidence({
    reference,
    spokenQueue: null,
    manifestRows: [{
      ...baseManifestRow,
      prompt: { ...baseManifestRow.prompt, target_focus: ['补稳“你”', 'ni3'] },
    }],
  })
  assert.equal(evidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.present, 1)
  assert.deepEqual(evidence.coverage.collected_audio_with_target.coverage.explicit_recording_targets.missing, [])
})
