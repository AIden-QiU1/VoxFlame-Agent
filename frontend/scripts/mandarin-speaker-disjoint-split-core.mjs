import crypto from 'node:crypto'

import { collectionEligibility } from './mandarin-collection-evidence-core.mjs'

const SPLITS = ['train', 'validation', 'test']
const TARGET_RATIOS = { train: 0.6, validation: 0.2, test: 0.2 }

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function lengthBucket(text) {
  const length = [...String(text).match(/\p{Script=Han}/gu) ?? []].length
  if (length <= 3) return '1-3_chars'
  if (length <= 6) return '4-6_chars'
  if (length <= 10) return '7-10_chars'
  if (length <= 18) return '11-18_chars'
  return '19+_chars'
}

function uniqueRows(rows) {
  const byRecording = new Map()
  for (const row of rows) {
    const recordingId = row?.recording_id ?? row?.metadata?.recording_id
    if (typeof recordingId === 'string' && recordingId.trim() && !byRecording.has(recordingId)) {
      byRecording.set(recordingId, row)
    }
  }
  return [...byRecording.values()]
}

function speakerValue(row) {
  return row?.user_id ?? row?.metadata?.user_id ?? null
}

function stableSpeakerOrder(left, right) {
  return left.orderKey.localeCompare(right.orderKey)
}

function chooseSplit(stats) {
  return SPLITS
    .slice()
    .sort((left, right) => {
      const leftRatio = stats[left].rows / TARGET_RATIOS[left]
      const rightRatio = stats[right].rows / TARGET_RATIOS[right]
      return leftRatio - rightRatio || SPLITS.indexOf(left) - SPLITS.indexOf(right)
    })[0]
}

function countBy(values) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]))
}

/**
 * Build a deterministic speaker-disjoint split without exposing user IDs or paths.
 * Model output, CER and ASR results are intentionally not read by this function.
 */
export function buildMandarinSpeakerDisjointSplit({ rows, seed = 'voxflame-mandarin-speaker-disjoint-v1', generatedAt = new Date().toISOString() }) {
  const deduplicated = uniqueRows(rows)
  const eligible = deduplicated
    .map((row) => ({ row, eligibility: collectionEligibility(row) }))
    .filter(({ row, eligibility }) => eligibility.eligible && typeof speakerValue(row) === 'string' && speakerValue(row).trim() !== '')
  const missingSpeaker = deduplicated.filter((row) => !speakerValue(row))
  const speakerGroups = new Map()
  for (const { row, eligibility } of eligible) {
    const rawSpeaker = speakerValue(row)
    const speakerKey = hash(`${seed}\0speaker\0${rawSpeaker}`)
    const group = speakerGroups.get(speakerKey) ?? {
      speakerKey,
      orderKey: hash(`${seed}\0order\0${rawSpeaker}`),
      rows: [],
    }
    group.rows.push({
      recording_key: hash(`${seed}\0recording\0${eligibility.recording_id}`),
      speaker_key: speakerKey,
      target: eligibility.target,
      category: eligibility.category,
      quality_status: eligibility.quality_status,
      length_bucket: lengthBucket(eligibility.target),
      duration_ms: Number(row?.audio?.duration_ms ?? row?.metadata?.duration_ms ?? 0),
    })
    speakerGroups.set(speakerKey, group)
  }

  const groups = [...speakerGroups.values()].sort((left, right) => right.rows.length - left.rows.length || stableSpeakerOrder(left, right))
  if (groups.length < 3) throw new Error(`speaker-disjoint split requires at least 3 speakers; got ${groups.length}`)

  const splitStats = Object.fromEntries(SPLITS.map((split) => [split, { rows: 0, speakers: [] }]))
  const assignments = new Map()
  for (const [index, group] of groups.entries()) {
    const split = index < SPLITS.length ? SPLITS[index] : chooseSplit(splitStats)
    assignments.set(group.speakerKey, split)
    splitStats[split].rows += group.rows.length
    splitStats[split].speakers.push(group.speakerKey)
  }

  const splitRows = Object.fromEntries(SPLITS.map((split) => [split, []]))
  for (const group of groups) {
    splitRows[assignments.get(group.speakerKey)].push(...group.rows)
  }
  for (const split of SPLITS) splitRows[split].sort((left, right) => left.recording_key.localeCompare(right.recording_key))

  const splitSpeakerSets = Object.fromEntries(SPLITS.map((split) => [split, new Set(splitStats[split].speakers)]))
  const overlap = []
  for (let left = 0; left < SPLITS.length; left += 1) {
    for (let right = left + 1; right < SPLITS.length; right += 1) {
      for (const speaker of splitSpeakerSets[SPLITS[left]]) {
        if (splitSpeakerSets[SPLITS[right]].has(speaker)) overlap.push(`${SPLITS[left]}:${SPLITS[right]}:${speaker}`)
      }
    }
  }
  if (overlap.length > 0) throw new Error(`speaker split overlap: ${overlap.join(',')}`)

  const splitSummary = Object.fromEntries(SPLITS.map((split) => [split, {
    rows: splitRows[split].length,
    speakers: splitStats[split].speakers.length,
    unique_targets: new Set(splitRows[split].map((row) => row.target)).size,
    quality_statuses: countBy(splitRows[split].map((row) => row.quality_status)),
    length_buckets: countBy(splitRows[split].map((row) => row.length_bucket)),
    categories: countBy(splitRows[split].map((row) => row.category)),
  }]))

  return {
    kind: 'voxflame_mandarin_speaker_disjoint_split_evidence',
    generated_at: generatedAt,
    seed,
    policy: {
      speaker_disjoint: true,
      deterministic: true,
      selection_uses_model_output_or_cer: false,
      user_ids_and_audio_paths_are_not_emitted: true,
      quality_anomalies_are_retained_as_strata: true,
      collection_eligibility_is_valid_audio_target_consent_upload: true,
      model_evaluation_results_not_included: true,
    },
    input: {
      input_rows: rows.length,
      deduplicated_rows: deduplicated.length,
      eligible_rows: eligible.length,
      excluded_rows: deduplicated.length - eligible.length,
      missing_speaker_identity_rows: missingSpeaker.length,
      speakers: groups.length,
    },
    split_policy: {
      speaker_disjoint: 'true',
      frozen_test_set: 'mandarin-app-speaker-disjoint-test-v1',
      target_ratios: TARGET_RATIOS,
    },
    split_summary: splitSummary,
    speaker_overlap: overlap,
    split_rows: splitRows,
    evaluation_status: 'split_ready_model_results_pending',
  }
}
