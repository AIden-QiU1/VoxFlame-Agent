export const REVIEW_FIELDS = [
  'linguistic_review',
  'naturalness_review',
  'safety_review',
  'license_review',
  'task_review',
]

export const REVIEW_STATUSES = ['pending', 'approved', 'rewrite', 'rejected']

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateMandarinReviewQueue(payload) {
  const errors = []
  if (payload?.kind !== 'mandarin_gap_candidate_review_queue') {
    errors.push('kind must be mandarin_gap_candidate_review_queue')
  }
  if (payload?.status !== 'human_review_required_not_for_production') {
    errors.push('queue status must remain human_review_required_not_for_production')
  }
  if (!payload?.source?.export_url || !payload?.source?.license || payload?.source?.attribution_required !== true) {
    errors.push('source must include export_url, license, and attribution_required=true')
  }
  if (!Array.isArray(payload?.items)) {
    errors.push('items must be an array')
    return { valid: false, errors, summary: null }
  }

  const ids = new Set()
  let productionReadyCount = 0
  const statusCounts = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0]))
  for (const [index, item] of payload.items.entries()) {
    const prefix = `items[${index}]`
    if (!isNonEmptyString(item?.id)) errors.push(`${prefix}.id is required`)
    if (ids.has(item?.id)) errors.push(`${prefix}.id is duplicated: ${item.id}`)
    ids.add(item?.id)
    if (!isNonEmptyString(item?.text)) errors.push(`${prefix}.text is required`)
    if (!isNonEmptyString(item?.source_url)) errors.push(`${prefix}.source_url is required`)
    if (!isNonEmptyString(item?.contributor)) errors.push(`${prefix}.contributor is required for attribution`)

    const reviews = item?.reviews
    let approved = true
    for (const field of REVIEW_FIELDS) {
      const status = reviews?.[field]
      if (!REVIEW_STATUSES.includes(status)) {
        errors.push(`${prefix}.reviews.${field} must be one of ${REVIEW_STATUSES.join(', ')}`)
        approved = false
      }
      if (status !== 'approved') approved = false
      statusCounts[status] = (statusCounts[status] ?? 0) + 1
    }
    if (approved) productionReadyCount += 1
    if (approved && (!isNonEmptyString(item.reviewed_by) || !isNonEmptyString(item.reviewed_at))) {
      errors.push(`${prefix} approved reviews require reviewed_by and reviewed_at`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      items: payload.items.length,
      unique_ids: ids.size,
      production_ready_items: productionReadyCount,
      review_status_counts: statusCounts,
      production_import_allowed: false,
    },
  }
}
