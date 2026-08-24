/**
 * Keep dataset metadata intentionally small. Operational fields such as the
 * recording id and audio quality are added by the upload transport; this
 * allow-list only covers caller-provided training labels and lineage.
 */
const ALLOWED_METADATA_KEYS = new Set([
  'kind',
  'sentence_id',
  'target_text',
  'spoken_text',
  'recognized_text',
  'prompt_group_key',
  'prompt_fingerprint',
  'recording_dedupe_key',
  'consent_version',
  'collection_plan_id',
  'etiology',
  'severity',
  'age_band',
  'sex',
  'exercise_id',
  'exercise_category',
  'feedback_status',
  'clarity_score',
  'alignment_score',
  'missing_chars',
  'extra_chars',
  'prepared_expression_id',
  'prepared_expression_section_id',
  'speech_patterns',
  'articulation_tips',
  'pronunciation_summary',
  'pronunciation_targets',
])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item))
}

/** Remove accidental device, browser, and arbitrary user metadata before upload. */
export function sanitizeTrainingUploadMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!ALLOWED_METADATA_KEYS.has(key)) {
      continue
    }

    if (isNonEmptyString(value) || isFiniteNumber(value) || typeof value === 'boolean') {
      sanitized[key] = typeof value === 'string' ? value.trim() : value
      continue
    }

    if (isStringArray(value)) {
      const values = value
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 32)
      if (values.length > 0) {
        sanitized[key] = values
      }
    }
  }

  return sanitized
}
