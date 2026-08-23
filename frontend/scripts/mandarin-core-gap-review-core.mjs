import { annotateMandarinText, normalizePinyinSyllable } from './mandarin-coverage-core.mjs'
import { containsBlockedDefaultCorpusContent } from './mandarin-corpus-content-policy.mjs'

export const CORE_GAP_REVIEW_FIELDS = [
  'linguistic',
  'naturalness',
  'user_burden',
  'safety',
  'license',
  'product',
]

export const CORE_GAP_REVIEW_STATUSES = ['pending', 'approved', 'rewrite', 'rejected']

const BLOCKED_PRODUCTION_CONTENT = /蠢人|蠢蛋|蠢货/u

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function declaredReadingTargets(item) {
  const attributedCarrierTargets = new Set()
  for (const [index, carrier] of (item?.target_carriers ?? []).entries()) {
    if (!nonEmpty(carrier?.text) || !item.text.includes(carrier.text)) {
      throw new Error(`target_carriers[${index}].text must occur in candidate text`)
    }
    if (!nonEmpty(carrier?.source_pinyin) || !nonEmpty(carrier?.source)) {
      throw new Error(`target_carriers[${index}] requires source_pinyin and source`)
    }
    for (const token of carrier.source_pinyin.split(/\s+/u)) {
      const normalized = token.replaceAll('u:', 'ü').match(/^([A-Za-züê]+)([1-5])$/iu)
      if (normalized) {
        attributedCarrierTargets.add(normalizePinyinSyllable(`${normalized[1].toLowerCase()}${normalized[2] === '5' ? '0' : normalized[2]}`).syllableTone)
      }
    }
  }
  if (item?.type === 'word' && nonEmpty(item?.source_pinyin)) {
    return new Set(item.source_pinyin.split(/\s+/u).flatMap((token) => {
      const normalized = token.replaceAll('u:', 'ü').match(/^([A-Za-züê]+)([1-5])$/iu)
      if (!normalized) return []
      return [normalizePinyinSyllable(`${normalized[1].toLowerCase()}${normalized[2] === '5' ? '0' : normalized[2]}`).syllableTone]
    }))
  }
  return new Set([
    ...annotateMandarinText(item?.text ?? '').syllables.map((syllable) => syllable.syllableTone),
    ...attributedCarrierTargets,
  ])
}

export function isCoreGapItemApproved(item) {
  return CORE_GAP_REVIEW_FIELDS.every((field) => item?.reviews?.[field] === 'approved')
    && nonEmpty(item?.reviewed_by)
    && nonEmpty(item?.reviewed_at)
}

export function validateCoreGapReviewPack(payload) {
  const errors = []
  const allowedKinds = new Set([
    'voxflame_mandarin_core_gap_phase1_review_pack',
    'voxflame_mandarin_reinforcement_context_review_pack',
  ])
  if (!allowedKinds.has(payload?.kind)) errors.push(`kind must be one of ${[...allowedKinds].join(', ')}`)
  if (payload?.status !== 'human_review_required_not_for_production') errors.push('status must remain human_review_required_not_for_production')
  if (!Array.isArray(payload?.items)) return { valid: false, errors: [...errors, 'items must be an array'], summary: null }
  if (!Array.isArray(payload?.target_status)) errors.push('target_status must be an array')

  const ids = new Set()
  let approvedItems = 0
  for (const [index, item] of payload.items.entries()) {
    const prefix = `items[${index}]`
    if (!nonEmpty(item?.id)) errors.push(`${prefix}.id is required`)
    if (ids.has(item?.id)) errors.push(`${prefix}.id is duplicated: ${item.id}`)
    ids.add(item?.id)
    if (!['word', 'short_sentence'].includes(item?.type)) errors.push(`${prefix}.type must be word or short_sentence`)
    if (!nonEmpty(item?.text)) errors.push(`${prefix}.text is required`)
    if (containsBlockedDefaultCorpusContent(item?.text) || BLOCKED_PRODUCTION_CONTENT.test(item?.text ?? '')) {
      errors.push(`${prefix}.text contains blocked production content`)
    }
    if (!Array.isArray(item?.coverage_targets) || item.coverage_targets.length === 0) errors.push(`${prefix}.coverage_targets must be non-empty`)
    if (payload?.kind === 'voxflame_mandarin_reinforcement_context_review_pack') {
      if (item?.proposed_task_id !== 'targeted_gap') errors.push(`${prefix}.proposed_task_id must be targeted_gap`)
      if (!['functional_speech', 'connected_reading'].includes(item?.discourse_style)) {
        errors.push(`${prefix}.discourse_style must be functional_speech or connected_reading`)
      }
    }

    let actualTargets = new Set()
    try {
      actualTargets = declaredReadingTargets(item)
    } catch (error) {
      errors.push(`${prefix}.${error instanceof Error ? error.message : String(error)}`)
    }
    for (const target of item?.coverage_targets ?? []) {
      if (!actualTargets.has(target)) errors.push(`${prefix} does not realize declared target ${target}`)
    }
    for (const field of CORE_GAP_REVIEW_FIELDS) {
      if (!CORE_GAP_REVIEW_STATUSES.includes(item?.reviews?.[field])) {
        errors.push(`${prefix}.reviews.${field} must be one of ${CORE_GAP_REVIEW_STATUSES.join(', ')}`)
      }
    }
    if (CORE_GAP_REVIEW_FIELDS.every((field) => item?.reviews?.[field] === 'approved')) {
      if (!nonEmpty(item.reviewed_by) || !nonEmpty(item.reviewed_at)) errors.push(`${prefix} approved reviews require reviewed_by and reviewed_at`)
      else approvedItems += 1
    }
  }

  const targetIds = new Set(payload.target_status?.map((target) => target.syllable_tone) ?? [])
  for (const [index, item] of payload.items.entries()) {
    for (const target of item.coverage_targets ?? []) {
      if (!targetIds.has(target)) errors.push(`items[${index}] target ${target} is missing from target_status`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      items: payload.items.length,
      unique_ids: ids.size,
      approved_items: approvedItems,
      production_export_items: approvedItems,
      pending_or_rejected_items: payload.items.length - approvedItems,
      declared_targets: targetIds.size,
    },
  }
}

export function buildApprovedCoreGapCorpus(payload) {
  if (payload?.kind !== 'voxflame_mandarin_core_gap_phase1_review_pack') {
    throw new Error('approved core-gap corpus can only be built from the core gap phase-one review pack')
  }
  const validation = validateCoreGapReviewPack(payload)
  if (!validation.valid) throw new Error(`invalid core gap review pack:\n${validation.errors.join('\n')}`)
  const approved = payload.items.filter(isCoreGapItemApproved)
  return {
    kind: 'voxflame_approved_mandarin_core_gap_corpus',
    generated_at: new Date().toISOString(),
    generated_from: 'mandarin-core-gap-phase1-review.json',
    policy: {
      core_targets_only: true,
      all_six_reviews_approved: true,
      edge_and_disputed_targets_excluded: true,
      existing_prompt_or_recording_removed: false,
    },
    summary: {
      approved_items: approved.length,
      approved_targets: new Set(approved.flatMap((item) => item.coverage_targets)).size,
    },
    items: approved.map((item) => ({
      id: `coverage-gap-${item.id}`,
      text: item.text,
      category: '音系强化',
      coverage_targets: item.coverage_targets,
      prompt_type: item.type,
      source: item.source,
      source_sentence_id: item.source_sentence_id,
      contributor: item.contributor,
      source_url: item.source_url,
      target_carriers: item.target_carriers,
      reviewed_by: item.reviewed_by,
      reviewed_at: item.reviewed_at,
    })),
  }
}
