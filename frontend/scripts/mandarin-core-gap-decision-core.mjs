export const REVIEW_FIELDS = [
  'linguistic',
  'naturalness',
  'user_burden',
  'safety',
  'license',
  'product',
]

export const REVIEW_STATUSES = ['pending', 'approved', 'rewrite', 'rejected']

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateCoreGapDecisionExport(payload, reviewPack) {
  const errors = []
  const expectedKind = reviewPack?.decision_kind ?? 'voxflame_mandarin_core_gap_review_decisions'
  if (payload?.kind !== expectedKind) {
    errors.push(`kind must be ${expectedKind}`)
  }
  if (payload?.source_generated_at !== reviewPack?.generated_at) {
    errors.push('source_generated_at does not match the review pack')
  }
  if (!nonEmpty(payload?.reviewer)) errors.push('reviewer is required')
  if (!nonEmpty(payload?.exported_at) || Number.isNaN(Date.parse(payload.exported_at))) {
    errors.push('exported_at must be an ISO timestamp')
  }
  if (!Array.isArray(payload?.items)) return { valid: false, errors: [...errors, 'items must be an array'], summary: null }

  const knownIds = new Set((reviewPack?.items ?? []).map((item) => item.id))
  const seen = new Set()
  let complete = 0
  let approved = 0
  let needsAttention = 0

  for (const [index, item] of payload.items.entries()) {
    const prefix = `items[${index}]`
    if (!nonEmpty(item?.id)) errors.push(`${prefix}.id is required`)
    if (!knownIds.has(item?.id)) errors.push(`${prefix}.id is not in the review pack: ${item?.id}`)
    if (seen.has(item?.id)) errors.push(`${prefix}.id is duplicated: ${item?.id}`)
    seen.add(item?.id)

    const statuses = REVIEW_FIELDS.map((field) => item?.reviews?.[field])
    for (const [fieldIndex, status] of statuses.entries()) {
      if (!REVIEW_STATUSES.includes(status)) {
        errors.push(`${prefix}.reviews.${REVIEW_FIELDS[fieldIndex]} must be one of ${REVIEW_STATUSES.join(', ')}`)
      }
    }
    const isComplete = statuses.every((status) => status !== 'pending')
    const isApproved = statuses.every((status) => status === 'approved')
    const requiresNotes = statuses.some((status) => status === 'rewrite' || status === 'rejected')
    if (requiresNotes && !nonEmpty(item?.review_notes)) {
      errors.push(`${prefix}.review_notes is required for rewrite or rejected decisions`)
    }
    if (isComplete) complete += 1
    if (isApproved) approved += 1
    if (requiresNotes) needsAttention += 1
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      exported_items: payload.items.length,
      unique_items: seen.size,
      complete_items: complete,
      approved_items: approved,
      rewrite_or_rejected_items: needsAttention,
      untouched_review_items: Math.max(0, knownIds.size - seen.size),
    },
  }
}

export function mergeCoreGapDecisions(reviewPack, decisions) {
  const validation = validateCoreGapDecisionExport(decisions, reviewPack)
  if (!validation.valid) throw new Error(`invalid core-gap decisions:\n${validation.errors.join('\n')}`)
  const byId = new Map(decisions.items.map((item) => [item.id, item]))
  return {
    ...reviewPack,
    generated_at: new Date().toISOString(),
    status: 'human_review_required_not_for_production',
    review_import: {
      source_generated_at: decisions.source_generated_at,
      reviewer: decisions.reviewer,
      exported_at: decisions.exported_at,
      imported_at: new Date().toISOString(),
      decision_items: decisions.items.length,
    },
    items: reviewPack.items.map((item) => {
      const decision = byId.get(item.id)
      if (!decision) return item
      return {
        ...item,
        reviews: decision.reviews,
        review_notes: decision.review_notes?.trim() || undefined,
        reviewed_by: decisions.reviewer,
        reviewed_at: decisions.exported_at,
      }
    }),
  }
}
