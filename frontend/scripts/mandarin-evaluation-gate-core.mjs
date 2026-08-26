export const REQUIRED_EVALUATION_FIELDS = [
  'evaluation_id',
  'baseline_id',
  'candidate_id',
  'dataset_version',
  'split_policy',
  'metrics',
  'decision',
]

const REQUIRED_METRIC_FIELDS = [
  'overall_cer',
  'worst_speaker_cer',
  'short_utterance_cer',
  'p95_latency_ms',
  'user_task_success_rate',
  'user_skip_rate',
  'user_fatigue_rate',
]

const DECISIONS = ['adopt', 'validate', 'hold', 'reject']

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateMandarinEvaluationReport(report) {
  const errors = []
  for (const field of REQUIRED_EVALUATION_FIELDS) {
    if (report?.[field] === undefined || report[field] === null || report[field] === '') {
      errors.push(`${field} is required`)
    }
  }

  if (!isNonEmptyString(report?.split_policy?.speaker_disjoint)) {
    errors.push('split_policy.speaker_disjoint must describe a fixed speaker-disjoint split')
  }
  if (report?.split_policy?.speaker_disjoint !== 'true') {
    errors.push('split_policy.speaker_disjoint must equal true')
  }
  if (!isNonEmptyString(report?.split_policy?.frozen_test_set)) {
    errors.push('split_policy.frozen_test_set is required')
  }

  for (const field of REQUIRED_METRIC_FIELDS) {
    if (!isFiniteNumber(report?.metrics?.[field])) {
      errors.push(`metrics.${field} must be a finite number`)
    }
  }

  if (!Array.isArray(report?.metrics?.severity_buckets) || report.metrics.severity_buckets.length === 0) {
    errors.push('metrics.severity_buckets must contain measured severity strata')
  }
  if (!Array.isArray(report?.metrics?.length_buckets) || report.metrics.length_buckets.length === 0) {
    errors.push('metrics.length_buckets must contain measured utterance-length strata')
  }
  if (!isNonEmptyString(report?.rollback?.trigger)) {
    errors.push('rollback.trigger is required')
  }
  if (!isNonEmptyString(report?.rollback?.action)) {
    errors.push('rollback.action is required')
  }
  if (!DECISIONS.includes(report?.decision)) {
    errors.push(`decision must be one of ${DECISIONS.join(', ')}`)
  }
  if (report?.decision === 'adopt' && report?.metrics?.user_task_success_rate <= 0) {
    errors.push('adopt requires a positive measured user_task_success_rate')
  }
  if (report?.decision === 'adopt' && report?.rollback?.verified !== true) {
    errors.push('adopt requires a verified rollback path')
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: report?.validity_summary ?? null,
  }
}
