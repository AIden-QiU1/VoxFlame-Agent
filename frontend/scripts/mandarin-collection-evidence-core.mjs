import { auditEntries } from './mandarin-coverage-core.mjs'
import {
  reviewEntriesFromQueue,
  validateMandarinSpokenTextReviewQueue,
} from './mandarin-spoken-text-review-core.mjs'

function uniqueByRecording(entries) {
  const result = new Map()
  for (const entry of entries) {
    if (entry.recording_id && !result.has(entry.recording_id)) result.set(entry.recording_id, entry)
  }
  return [...result.values()]
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeExplicitTarget(value) {
  if (!nonEmpty(value)) return null
  const normalized = String(value).trim().toLowerCase().replaceAll('v', 'ü')
  return /^[a-züê]+[0-5]$/u.test(normalized) ? normalized : null
}

function qualityStatus(row) {
  const metadata = row?.metadata ?? {}
  const reasons = Array.isArray(metadata.audio_quality_reasons) ? metadata.audio_quality_reasons : []
  const errorTags = Array.isArray(row?.evaluation?.error_tags) ? row.evaluation.error_tags : []
  if (reasons.includes('speech_too_short_or_too_quiet') || reasons.includes('input_level_quiet')) return 'unusable_audio'
  if (reasons.includes('too_much_silence') || Number(metadata.silence_ratio ?? 0) >= 0.72) return 'long_silence'
  if (errorTags.some((tag) => String(tag).startsWith('missing:'))) return 'suspected_omission'
  if (errorTags.some((tag) => String(tag).startsWith('extra:'))) return 'suspected_misread'
  return 'valid'
}

/**
 * Collection coverage is an ingestion fact, not a transcription opinion.
 * A manifest row qualifies when it has an immutable id, target text, positive
 * audio metadata, and an explicit training consent/upload contract. Quality
 * signals are retained as dispositions and never remove the sample here.
 */
export function collectionEligibility(row) {
  const target = row?.prompt?.text ?? row?.metadata?.target_text ?? row?.metadata?.exercise_text
  const durationMs = Number(row?.audio?.duration_ms ?? row?.metadata?.duration_ms ?? 0)
  const fileSizeBytes = Number(row?.audio?.file_size_bytes ?? row?.metadata?.file_size_bytes ?? 0)
  const consentScope = row?.consent?.scope ?? row?.metadata?.consent_scope
  const syncStatus = row?.consent?.sync_status ?? row?.metadata?.sync_status
  const reasons = []
  if (!nonEmpty(row?.recording_id ?? row?.metadata?.recording_id)) reasons.push('missing_recording_id')
  if (!nonEmpty(target)) reasons.push('missing_target')
  if (durationMs <= 0) reasons.push('invalid_audio_duration')
  if (fileSizeBytes <= 0) reasons.push('invalid_audio_size')
  if (!['training_only', 'research_and_training'].includes(consentScope)) reasons.push('invalid_consent_scope')
  if (!['uploaded', 'queued', 'local_only'].includes(syncStatus)) reasons.push('invalid_upload_contract')
  return {
    eligible: reasons.length === 0,
    reasons,
    target: nonEmpty(target) ? String(target).trim() : '',
    category: row?.prompt?.category ?? row?.metadata?.exercise_category ?? '未分区',
    quality_status: qualityStatus(row),
    coverage_targets: (Array.isArray(row?.prompt?.target_focus)
      ? row.prompt.target_focus
      : Array.isArray(row?.metadata?.pronunciation_targets)
        ? row.metadata.pronunciation_targets
        : [])
      .map(normalizeExplicitTarget)
      .filter((value) => value !== null),
    recording_id: row?.recording_id ?? row?.metadata?.recording_id,
  }
}

function entriesFromManifestRows(rows) {
  return rows
    .map((row) => ({ row, eligibility: collectionEligibility(row) }))
    .filter(({ eligibility }) => eligibility.eligible)
    .map(({ eligibility }) => ({
      text: eligibility.target,
      category: eligibility.category,
      recording_id: eligibility.recording_id,
      quality_status: eligibility.quality_status,
      coverage_targets: eligibility.coverage_targets,
      recording_readiness: 'ready_for_recording',
    }))
}

/**
 * Build a diagnostic report for collected recordings. Collection coverage is
 * intentionally based on valid audio plus a non-empty target; optional
 * spoken-text diagnostics never gate recording.
 */
export function buildMandarinCollectionEvidence({
  reference,
  spokenQueue = null,
  manifestRows = [],
  generatedAt = new Date().toISOString(),
}) {
  const spokenValidation = spokenQueue ? validateMandarinSpokenTextReviewQueue(spokenQueue) : { valid: true, errors: [] }
  if (!spokenValidation.valid) throw new Error(`invalid spoken_text queue: ${spokenValidation.errors.join('; ')}`)

  const spokenEntries = spokenQueue ? uniqueByRecording(reviewEntriesFromQueue(spokenQueue)) : []
  const manifestEntries = entriesFromManifestRows(uniqueByRecording(manifestRows))
  const qualityCounts = Object.fromEntries(
    [...new Set(manifestEntries.map((entry) => entry.quality_status))].map((status) => [
      status,
      manifestEntries.filter((entry) => entry.quality_status === status).length,
    ]),
  )

  return {
    kind: 'voxflame_mandarin_collection_evidence',
    generated_at: generatedAt,
    policy: {
      valid_audio_and_non_empty_target_define_collection_coverage: true,
      human_spoken_text_is_required_for_coverage: false,
      audio_text_alignment_is_required_for_coverage: false,
      authorization_and_upload_contract_required: true,
      planned_slots_are_not_recordings: true,
      original_manifests_and_audio_are_immutable: true,
    },
    review: {
      full_queue_items: spokenQueue?.items.length ?? 0,
      full_queue_approved_items: spokenEntries.length,
      full_queue_pending_items: spokenQueue?.items.filter((item) => item.spoken_text_status === 'pending').length ?? 0,
      manifest_rows: manifestRows.length,
      manifest_collection_eligible_recordings: manifestEntries.length,
      manifest_collection_quality_statuses: qualityCounts,
      coverage_eligible_recordings: manifestEntries.length,
      training_import_allowed: false,
    },
    coverage: {
      collected_audio_with_target: auditEntries(manifestEntries, reference),
      human_spoken_text: auditEntries(spokenEntries, reference),
    },
  }
}
