/**
 * Contract for human transcription review of collected recordings.
 * ASR is retained only as a non-authoritative hint; it never becomes spoken_text.
 */

export const SPOKEN_TEXT_REVIEW_STATUSES = ['pending', 'approved', 'uncertain', 'unusable']
export const AUDIO_TEXT_ALIGNMENT_STATUSES = ['pending', 'confirmed', 'mismatch', 'unusable']
export const QUEUE_STATUS = 'optional_quality_review_not_for_training'

const FORBIDDEN_ITEM_KEYS = new Set([
  'user_id',
  'userId',
  'metadata',
  'user_agent',
  'microphone_device_id',
  'microphone_label',
  'selected_microphone_device_id',
])

function pathBasename(value) {
  return String(value ?? '').split(/[\\/]/u).pop() ?? ''
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableString(value) {
  return value === null || value === undefined || typeof value === 'string'
}

function isIsoTimestamp(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

export function normalizeReviewedMandarinText(value) {
  if (!isNonEmptyString(value)) return ''
  return value
    .normalize('NFKC')
    .replace(/[，。！？；：、,.!?;:\s\u3000“”‘’「」『』《》〈〉【】（）()]/gu, '')
    .trim()
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasForbiddenKey)
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_ITEM_KEYS.has(key) || hasForbiddenKey(nested))
}

export function isApprovedSpokenTextReview(item) {
  return item?.spoken_text_status === 'approved'
    && item?.audio_text_alignment === 'confirmed'
    && isNonEmptyString(item?.spoken_text)
    && isNonEmptyString(item?.reviewed_by)
    && isIsoTimestamp(item?.reviewed_at)
}

export function reviewEntriesFromQueue(payload) {
  if (!Array.isArray(payload?.items)) return []
  return payload.items
    .filter(isApprovedSpokenTextReview)
    .map((item) => ({
      text: item.spoken_text.trim(),
      category: item.category ?? '未分区',
      recording_id: item.recording_id,
      review_source: 'human_spoken_text_review',
    }))
}

export function summarizeSpokenTextReviewQueue(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  const counts = Object.fromEntries(SPOKEN_TEXT_REVIEW_STATUSES.map((status) => [status, 0]))
  const alignmentCounts = Object.fromEntries(AUDIO_TEXT_ALIGNMENT_STATUSES.map((status) => [status, 0]))
  for (const item of items) {
    if (Object.hasOwn(counts, item?.spoken_text_status)) counts[item.spoken_text_status] += 1
    if (Object.hasOwn(alignmentCounts, item?.audio_text_alignment)) alignmentCounts[item.audio_text_alignment] += 1
  }
  return {
    items: items.length,
    spoken_text_status_counts: counts,
    audio_text_alignment_counts: alignmentCounts,
    coverage_eligible_items: items.filter(isApprovedSpokenTextReview).length,
    training_import_allowed: false,
  }
}

export function validateMandarinSpokenTextReviewQueue(payload) {
  const errors = []
  if (payload?.kind !== 'voxflame_mandarin_spoken_text_review_queue') {
    errors.push('kind must be voxflame_mandarin_spoken_text_review_queue')
  }
  if (payload?.status !== QUEUE_STATUS) {
    errors.push(`queue status must remain ${QUEUE_STATUS}`)
  }
  if (!Array.isArray(payload?.source_manifest_files) || payload.source_manifest_files.length === 0) {
    errors.push('source_manifest_files must be a non-empty array')
  }
  if (!Array.isArray(payload?.items)) {
    errors.push('items must be an array')
    return { valid: false, errors, summary: null }
  }

  const ids = new Set()
  for (const [index, item] of payload.items.entries()) {
    const prefix = `items[${index}]`
    if (hasForbiddenKey(item)) errors.push(`${prefix} contains forbidden identity/device fields`)
    if (!isNonEmptyString(item?.recording_id)) errors.push(`${prefix}.recording_id is required`)
    if (ids.has(item?.recording_id)) errors.push(`${prefix}.recording_id is duplicated: ${item.recording_id}`)
    ids.add(item?.recording_id)
    if (!isNonEmptyString(item?.prompt_text)) errors.push(`${prefix}.prompt_text is required`)
    if (!isNonEmptyString(item?.audio_locator)) errors.push(`${prefix}.audio_locator is required for offline review`)
    if (/[\\/]/u.test(item?.audio_locator ?? '') || /[?&#]/u.test(item?.audio_locator ?? '')) {
      errors.push(`${prefix}.audio_locator must be an opaque locator, not a storage path or URL`)
    }
    if (!isNullableString(item?.spoken_text)) errors.push(`${prefix}.spoken_text must be a string or null`)
    if (!SPOKEN_TEXT_REVIEW_STATUSES.includes(item?.spoken_text_status)) {
      errors.push(`${prefix}.spoken_text_status must be one of ${SPOKEN_TEXT_REVIEW_STATUSES.join(', ')}`)
    }
    if (!AUDIO_TEXT_ALIGNMENT_STATUSES.includes(item?.audio_text_alignment)) {
      errors.push(`${prefix}.audio_text_alignment must be one of ${AUDIO_TEXT_ALIGNMENT_STATUSES.join(', ')}`)
    }
    if (item?.spoken_text_status === 'pending' && isNonEmptyString(item?.spoken_text)) {
      errors.push(`${prefix}.pending review cannot contain spoken_text`)
    }
    if (item?.spoken_text_status === 'approved') {
      if (!isNonEmptyString(item?.spoken_text)) errors.push(`${prefix}.approved review requires spoken_text`)
      if (item?.audio_text_alignment !== 'confirmed') errors.push(`${prefix}.approved review requires confirmed audio_text_alignment`)
      if (!isNonEmptyString(item?.reviewed_by)) errors.push(`${prefix}.approved review requires reviewed_by`)
      if (!isIsoTimestamp(item?.reviewed_at)) errors.push(`${prefix}.approved review requires reviewed_at ISO timestamp`)
      if (/<(?:UNCERTAIN|INAUDIBLE)>/u.test(item.spoken_text ?? '')) errors.push(`${prefix}.approved spoken_text cannot contain uncertainty markers`)
    }
    if (item?.audio_text_alignment === 'confirmed' && item?.spoken_text_status !== 'approved') {
      errors.push(`${prefix}.confirmed alignment requires approved spoken_text_status`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      ...summarizeSpokenTextReviewQueue(payload),
      unique_recordings: ids.size,
      production_import_allowed: false,
    },
  }
}

/**
 * Validate the browser-exported decisions against the exact queue snapshot.
 * Decisions are a sparse patch: omitted recordings remain unchanged and no
 * decision can promote ASR, alter source audio, or bypass reviewer attribution.
 */
export function validateMandarinSpokenTextDecisionExport(payload, reviewQueue) {
  const errors = []
  if (payload?.kind !== 'voxflame_mandarin_spoken_text_review_decisions') {
    errors.push('kind must be voxflame_mandarin_spoken_text_review_decisions')
  }
  if (payload?.source_generated_at !== reviewQueue?.generated_at) {
    errors.push('source_generated_at does not match the review queue')
  }
  if (!isNonEmptyString(payload?.reviewer)) errors.push('reviewer is required')
  if (!isIsoTimestamp(payload?.exported_at)) errors.push('exported_at must be an ISO timestamp')
  if (hasForbiddenKey(payload)) errors.push('decision export contains forbidden identity/device fields')
  if (!Array.isArray(payload?.items)) return { valid: false, errors: [...errors, 'items must be an array'], summary: null }

  const knownIds = new Set((reviewQueue?.items ?? []).map((item) => item.recording_id))
  const seen = new Set()
  let approved = 0
  let pending = 0
  let uncertain = 0
  let unusable = 0

  for (const [index, item] of payload.items.entries()) {
    const prefix = `items[${index}]`
    if (!isNonEmptyString(item?.recording_id)) errors.push(`${prefix}.recording_id is required`)
    if (!knownIds.has(item?.recording_id)) errors.push(`${prefix}.recording_id is not in the review queue: ${item?.recording_id}`)
    if (seen.has(item?.recording_id)) errors.push(`${prefix}.recording_id is duplicated: ${item?.recording_id}`)
    seen.add(item?.recording_id)
    if (!isNullableString(item?.spoken_text)) errors.push(`${prefix}.spoken_text must be a string or null`)
    if (!SPOKEN_TEXT_REVIEW_STATUSES.includes(item?.spoken_text_status)) {
      errors.push(`${prefix}.spoken_text_status must be one of ${SPOKEN_TEXT_REVIEW_STATUSES.join(', ')}`)
    }
    if (!AUDIO_TEXT_ALIGNMENT_STATUSES.includes(item?.audio_text_alignment)) {
      errors.push(`${prefix}.audio_text_alignment must be one of ${AUDIO_TEXT_ALIGNMENT_STATUSES.join(', ')}`)
    }
    if (!isNonEmptyString(item?.reviewed_by)) errors.push(`${prefix}.reviewed_by is required`)
    if (item?.reviewed_by !== payload?.reviewer) errors.push(`${prefix}.reviewed_by must match reviewer`)
    if (!isIsoTimestamp(item?.reviewed_at)) errors.push(`${prefix}.reviewed_at must be an ISO timestamp`)
    if (item?.spoken_text_status === 'pending' && isNonEmptyString(item?.spoken_text)) {
      errors.push(`${prefix}.pending decision cannot contain spoken_text`)
    }
    if (item?.spoken_text_status === 'approved') {
      if (!isNonEmptyString(item?.spoken_text)) errors.push(`${prefix}.approved decision requires spoken_text`)
      if (item?.audio_text_alignment !== 'confirmed') errors.push(`${prefix}.approved decision requires confirmed audio_text_alignment`)
      if (/<(?:UNCERTAIN|INAUDIBLE)>/u.test(item.spoken_text ?? '')) errors.push(`${prefix}.approved spoken_text cannot contain uncertainty markers`)
      approved += 1
    } else if (item?.spoken_text_status === 'pending') {
      pending += 1
    } else if (item?.spoken_text_status === 'uncertain') {
      uncertain += 1
    } else if (item?.spoken_text_status === 'unusable') {
      unusable += 1
    }
    if (item?.audio_text_alignment === 'confirmed' && item?.spoken_text_status !== 'approved') {
      errors.push(`${prefix}.confirmed alignment requires approved spoken_text_status`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      exported_items: payload.items.length,
      unique_items: seen.size,
      approved_items: approved,
      pending_items: pending,
      uncertain_items: uncertain,
      unusable_items: unusable,
      untouched_review_items: Math.max(0, knownIds.size - seen.size),
      training_import_allowed: false,
    },
  }
}

export function mergeMandarinSpokenTextDecisions(reviewQueue, decisions) {
  const validation = validateMandarinSpokenTextDecisionExport(decisions, reviewQueue)
  if (!validation.valid) throw new Error(`invalid spoken-text decisions:\n${validation.errors.join('\n')}`)
  const byId = new Map(decisions.items.map((item) => [item.recording_id, item]))
  return {
    ...reviewQueue,
    generated_at: new Date().toISOString(),
    status: QUEUE_STATUS,
    policy: { ...reviewQueue.policy, training_import_allowed: false },
    review_import: {
      source_generated_at: decisions.source_generated_at,
      reviewer: decisions.reviewer,
      exported_at: decisions.exported_at,
      imported_at: new Date().toISOString(),
      decision_items: decisions.items.length,
    },
    items: reviewQueue.items.map((item) => {
      const decision = byId.get(item.recording_id)
      if (!decision) return item
      return {
        ...item,
        spoken_text: decision.spoken_text ?? null,
        spoken_text_status: decision.spoken_text_status,
        audio_text_alignment: decision.audio_text_alignment,
        reviewed_by: decision.reviewed_by,
        reviewed_at: decision.reviewed_at,
        reviewer_note: decision.reviewer_note ?? null,
      }
    }),
  }
}

export function buildMandarinSpokenTextReviewQueue(rows, { sourceManifestFiles = [] } = {}) {
  const uniqueRows = new Map()
  for (const row of rows) {
    const recordingId = row.recording_id ?? row.metadata?.recording_id
    const promptText = row.prompt?.text ?? row.metadata?.target_text ?? row.metadata?.exercise_text
    const audioPath = row.audio?.path
    if (!recordingId || !promptText || !audioPath || uniqueRows.has(recordingId)) continue
    uniqueRows.set(recordingId, row)
  }

  const items = [...uniqueRows.entries()].map(([recordingId, row]) => ({
    recording_id: recordingId,
    // Keep storage paths out of the review queue: historical paths may contain
    // account UUIDs. The controlled reviewer tool resolves this opaque locator
    // through a separate local mapping that is never part of the queue export.
    audio_locator: String(recordingId),
    audio_filename: pathBasename(row.audio.path),
    prompt_text: String(row.prompt?.text ?? row.metadata?.target_text ?? row.metadata?.exercise_text).trim(),
    category: row.prompt?.category ?? row.metadata?.exercise_category ?? '未分区',
    // This is an annotator hint only. It is deliberately not named spoken_text.
    asr_hint: row.transcript?.raw ?? row.metadata?.raw_transcript ?? null,
    asr_hint_role: 'non_authoritative_hint',
    duration_ms: Number(row.audio?.duration_ms ?? row.metadata?.duration_ms ?? 0),
    quality_disposition: row.metadata?.audio_quality_disposition ?? 'missing',
    spoken_text: null,
    spoken_text_status: 'pending',
    audio_text_alignment: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    reviewer_note: null,
  }))

  return {
    kind: 'voxflame_mandarin_spoken_text_review_queue',
    status: QUEUE_STATUS,
    generated_at: new Date().toISOString(),
    source_manifest_files: sourceManifestFiles.map(pathBasename),
    policy: {
      asr_is_hint_only: true,
      human_spoken_text_required_for_coverage: false,
      audio_text_alignment_required_for_coverage: false,
      original_manifest_and_audio_are_immutable: true,
      training_import_allowed: false,
    },
    items,
  }
}
