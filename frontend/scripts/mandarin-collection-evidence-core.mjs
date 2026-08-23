import { auditEntries } from './mandarin-coverage-core.mjs'
import {
  consensusEntriesFromDualQueue,
  reviewEntriesFromQueue,
  validateMandarinDualReviewQueue,
  validateMandarinSpokenTextReviewQueue,
} from './mandarin-spoken-text-review-core.mjs'

function uniqueByRecording(entries) {
  const result = new Map()
  for (const entry of entries) {
    if (entry.recording_id && !result.has(entry.recording_id)) result.set(entry.recording_id, entry)
  }
  return [...result.values()]
}

function audioStatusByRecording(audioVerification) {
  return new Map((audioVerification?.results ?? []).map((item) => [item.recording_id, item.status]))
}

/**
 * Build the evidence boundary between planned prompts and recordings that may
 * legitimately count toward phonological coverage. This report never mutates
 * manifests or promotes reviewed text into training data.
 */
export function buildMandarinCollectionEvidence({
  reference,
  spokenQueue,
  dualQueue,
  audioVerification,
  generatedAt = new Date().toISOString(),
}) {
  const spokenValidation = validateMandarinSpokenTextReviewQueue(spokenQueue)
  if (!spokenValidation.valid) throw new Error(`invalid spoken_text queue: ${spokenValidation.errors.join('; ')}`)
  const dualValidation = validateMandarinDualReviewQueue(dualQueue)
  if (!dualValidation.valid) throw new Error(`invalid dual review queue: ${dualValidation.errors.join('; ')}`)

  const spokenEntries = uniqueByRecording(reviewEntriesFromQueue(spokenQueue))
  const audioStatuses = audioStatusByRecording(audioVerification)
  const consensusEntries = uniqueByRecording(consensusEntriesFromDualQueue(dualQueue))
  const audioVerifiedConsensusEntries = consensusEntries.filter((entry) => audioStatuses.get(entry.recording_id) === 'ok')
  const audioIntegrityGatePassed = audioVerification?.audio_integrity_gate_passed === true

  return {
    kind: 'voxflame_mandarin_collection_evidence',
    generated_at: generatedAt,
    policy: {
      human_spoken_text_is_required_for_coverage: true,
      audio_text_alignment_is_required_for_coverage: true,
      dual_review_consensus_is_quality_evidence_not_a_training_import: true,
      audio_integrity_failure_blocks_dual_sample_coverage_claims: true,
      planned_slots_are_not_recordings: true,
      original_manifests_and_audio_are_immutable: true,
    },
    review: {
      full_queue_items: spokenQueue.items.length,
      full_queue_approved_items: spokenEntries.length,
      full_queue_pending_items: spokenQueue.items.filter((item) => item.spoken_text_status === 'pending').length,
      dual_sample_items: dualQueue.items.length,
      dual_consensus_items: consensusEntries.length,
      dual_audio_verified_consensus_items: audioVerifiedConsensusEntries.length,
      audio_integrity_gate_passed: audioIntegrityGatePassed,
      audio_status_counts: audioVerification?.status_counts ?? {},
      coverage_eligible_recordings: spokenEntries.length,
      training_import_allowed: false,
    },
    coverage: {
      human_spoken_text: auditEntries(spokenEntries, reference),
      dual_consensus_audio_verified: auditEntries(
        audioIntegrityGatePassed ? audioVerifiedConsensusEntries : [],
        reference,
      ),
    },
  }
}
