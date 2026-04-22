import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })

type JsonRecord = Record<string, unknown>

interface ScriptOptions {
  email?: string
  userId?: string
  outputDir?: string
  limit: number
}

interface VoiceContributionRow {
  id: string
  created_at: string
  transcript: string
  audio_path: string
  duration_seconds: number | null
  metadata: JsonRecord | null
}

type ReviewDisposition = 'likely_reasonable' | 'needs_manual_review' | 'metadata_incomplete'
type ReviewSeverity = 'high' | 'medium' | 'low'

interface ReviewRow {
  id: string
  createdAt: string
  audioPath: string
  targetText: string
  recognizedText: string
  durationMs: number | null
  confidence: number | null
  coverageRatio: number | null
  alignmentScore: number | null
  alignmentStatus: string | null
  alignmentTier: string | null
  reviewQueue: string | null
  reviewPriority: string | null
  reviewReasonTags: string[]
  disposition: ReviewDisposition
  severity: ReviewSeverity
  reasons: string[]
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    limit: 500,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--email' && argv[index + 1]) {
      options.email = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--user-id' && argv[index + 1]) {
      options.userId = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--output-dir' && argv[index + 1]) {
      options.outputDir = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--limit' && argv[index + 1]) {
      const parsed = Number(argv[index + 1])
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed
      }
      index += 1
    }
  }

  return options
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} missing`)
  }
  return value
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: JsonRecord | null | undefined, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(record: JsonRecord | null | undefined, key: string): number | null {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readStringArray(record: JsonRecord | null | undefined, key: string): string[] {
  const value = record?.[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

function calculateCharacterMatchRatio(target: string, recognized: string): number | null {
  const normalizedTarget = normalizeForCompare(target)
  const normalizedRecognized = normalizeForCompare(recognized)

  if (!normalizedTarget) {
    return null
  }

  const minLength = Math.min(normalizedTarget.length, normalizedRecognized.length)
  let matchCount = 0

  for (let index = 0; index < minLength; index += 1) {
    if (normalizedTarget[index] === normalizedRecognized[index]) {
      matchCount += 1
    }
  }

  return Math.round((matchCount / normalizedTarget.length) * 100) / 100
}

function classifyReview(row: VoiceContributionRow): ReviewRow {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const targetText =
    readString(metadata, 'target_text') ||
    readString(metadata, 'prompt_aligned_transcript') ||
    readString(metadata, 'exercise_text') ||
    row.transcript.trim()
  const recognizedText =
    readString(metadata, 'recognized_text') ||
    readString(metadata, 'raw_transcript') ||
    row.transcript.trim()

  const durationMs =
    readNumber(metadata, 'duration_ms') ||
    (typeof row.duration_seconds === 'number' && Number.isFinite(row.duration_seconds)
      ? Math.round(row.duration_seconds * 1000)
      : null)
  const confidence = readNumber(metadata, 'confidence')
  const coverageRatio = readNumber(metadata, 'transcript_coverage_ratio')
  const alignmentScore = readNumber(metadata, 'alignment_score')
  const alignmentStatus = readString(metadata, 'alignment_status')
  const alignmentTier = readString(metadata, 'alignment_tier')
  const reviewQueue = readString(metadata, 'review_queue')
  const reviewPriority = readString(metadata, 'review_priority')
  const reviewReasonTags = readStringArray(metadata, 'review_reason_tags')
  const reasons: string[] = []

  let disposition: ReviewDisposition = 'likely_reasonable'
  let severity: ReviewSeverity = 'low'

  if (!targetText) {
    disposition = 'metadata_incomplete'
    severity = 'high'
    reasons.push('missing_target_text')
  }

  if (!recognizedText) {
    disposition = disposition === 'metadata_incomplete' ? disposition : 'needs_manual_review'
    severity = 'high'
    reasons.push('missing_recognized_text')
  }

  const normalizedTarget = normalizeForCompare(targetText)
  const normalizedRecognized = normalizeForCompare(recognizedText)
  const exactMatch = normalizedTarget.length > 0 && normalizedTarget === normalizedRecognized
  const charMatchRatio = calculateCharacterMatchRatio(targetText, recognizedText)

  if (!exactMatch && disposition === 'likely_reasonable') {
    if ((coverageRatio !== null && coverageRatio < 0.75) || (charMatchRatio !== null && charMatchRatio < 0.65)) {
      disposition = 'needs_manual_review'
      severity = 'medium'
      reasons.push('target_recognized_gap_large')
    }
  }

  if (alignmentStatus === 'retry_recommended') {
    disposition = 'needs_manual_review'
    severity = 'high'
    reasons.push('alignment_retry_recommended')
  }

  if (alignmentTier === 'review' || alignmentTier === 'retry') {
    disposition = 'needs_manual_review'
    severity = alignmentTier === 'retry' ? 'high' : severity
    reasons.push(`alignment_tier_${alignmentTier}`)
  }

  if (typeof coverageRatio === 'number' && coverageRatio < 0.45) {
    disposition = 'needs_manual_review'
    severity = 'high'
    reasons.push('coverage_ratio_very_low')
  } else if (typeof coverageRatio === 'number' && coverageRatio < 0.75 && disposition === 'likely_reasonable') {
    disposition = 'needs_manual_review'
    severity = 'medium'
    reasons.push('coverage_ratio_low')
  }

  if (typeof confidence === 'number' && confidence < 0.55) {
    disposition = 'needs_manual_review'
    severity = severity === 'high' ? 'high' : 'medium'
    reasons.push('confidence_low')
  }

  if (typeof durationMs === 'number' && durationMs < 900) {
    disposition = 'needs_manual_review'
    severity = severity === 'high' ? 'high' : 'medium'
    reasons.push('duration_too_short')
  }

  if (reviewQueue) {
    disposition = 'needs_manual_review'
    severity = reviewPriority === 'high' ? 'high' : severity
    reasons.push(`review_queue_${reviewQueue}`)
  }

  for (const tag of reviewReasonTags) {
    reasons.push(`review_tag_${tag}`)
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    audioPath: row.audio_path,
    targetText,
    recognizedText,
    durationMs,
    confidence,
    coverageRatio,
    alignmentScore,
    alignmentStatus,
    alignmentTier,
    reviewQueue,
    reviewPriority,
    reviewReasonTags,
    disposition,
    severity,
    reasons: Array.from(new Set(reasons)),
  }
}

async function resolveUserId(supabase: any, email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })

  if (error) {
    throw error
  }

  const matched = data.users.find((user: { email?: string; id: string }) => user.email === email)
  return matched?.id ?? null
}

function toCsvValue(value: string | number | null | string[]): string {
  if (Array.isArray(value)) {
    return `"${value.join('|').replace(/"/g, '""')}"`
  }

  if (value === null) {
    return ''
  }

  return `"${String(value).replace(/"/g, '""')}"`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || requireEnv('SUPABASE_ANON_KEY'),
  )

  let userId = options.userId || null
  if (!userId && options.email) {
    userId = await resolveUserId(supabase, options.email)
  }

  if (!userId) {
    throw new Error('email or user-id required')
  }

  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.resolve('/tmp', `dataset-review-${userId}`)
  await fs.mkdir(outputDir, { recursive: true })

  const { data, error } = await supabase
    .from('voice_contributions')
    .select('id, created_at, transcript, audio_path, duration_seconds, metadata')
    .eq('contributor_id', userId)
    .order('created_at', { ascending: false })
    .limit(options.limit)

  if (error) {
    throw error
  }

  const rows = ((data || []) as VoiceContributionRow[]).map(classifyReview)
  const flagged = rows.filter((row) => row.disposition !== 'likely_reasonable')
  const highRisk = flagged.filter((row) => row.severity === 'high')
  const mediumRisk = flagged.filter((row) => row.severity === 'medium')
  const incomplete = rows.filter((row) => row.disposition === 'metadata_incomplete')

  const summary = {
    userId,
    email: options.email ?? null,
    generatedAt: new Date().toISOString(),
    totalSamples: rows.length,
    likelyReasonable: rows.filter((row) => row.disposition === 'likely_reasonable').length,
    needsManualReview: rows.filter((row) => row.disposition === 'needs_manual_review').length,
    metadataIncomplete: incomplete.length,
    highRisk: highRisk.length,
    mediumRisk: mediumRisk.length,
    lowRisk: flagged.filter((row) => row.severity === 'low').length,
  }

  await fs.writeFile(
    path.join(outputDir, 'label-review-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  )

  const csvHeader = [
    'id',
    'created_at',
    'audio_path',
    'target_text',
    'recognized_text',
    'disposition',
    'severity',
    'duration_ms',
    'confidence',
    'coverage_ratio',
    'alignment_score',
    'alignment_status',
    'alignment_tier',
    'review_queue',
    'review_priority',
    'review_reason_tags',
    'reasons',
  ]
  const csvLines = [
    csvHeader.join(','),
    ...rows.map((row) => [
      row.id,
      row.createdAt,
      row.audioPath,
      row.targetText,
      row.recognizedText,
      row.disposition,
      row.severity,
      row.durationMs,
      row.confidence,
      row.coverageRatio,
      row.alignmentScore,
      row.alignmentStatus,
      row.alignmentTier,
      row.reviewQueue,
      row.reviewPriority,
      row.reviewReasonTags,
      row.reasons,
    ].map(toCsvValue).join(',')),
  ]
  await fs.writeFile(path.join(outputDir, 'label-review.csv'), `${csvLines.join('\n')}\n`, 'utf8')

  await fs.writeFile(
    path.join(outputDir, 'label-review.jsonl'),
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  )

  const markdownLines = [
    '# Dataset Label Review',
    '',
    `- user_id: ${userId}`,
    `- email: ${options.email ?? 'n/a'}`,
    `- generated_at: ${summary.generatedAt}`,
    `- total_samples: ${summary.totalSamples}`,
    `- likely_reasonable: ${summary.likelyReasonable}`,
    `- needs_manual_review: ${summary.needsManualReview}`,
    `- metadata_incomplete: ${summary.metadataIncomplete}`,
    `- high_risk: ${summary.highRisk}`,
    `- medium_risk: ${summary.mediumRisk}`,
    '',
    '## Top flagged samples',
    '',
  ]

  const topFlagged = [...highRisk, ...mediumRisk].slice(0, 30)
  if (topFlagged.length === 0) {
    markdownLines.push('- none')
  } else {
    for (const row of topFlagged) {
      markdownLines.push(`- ${path.basename(row.audioPath)} | ${row.disposition} | ${row.severity} | target="${row.targetText}" | recognized="${row.recognizedText}" | reasons=${row.reasons.join('|')}`)
    }
  }

  await fs.writeFile(path.join(outputDir, 'label-review.md'), `${markdownLines.join('\n')}\n`, 'utf8')

  console.log(
    `[export_dataset_review_report] user=${userId} total=${summary.totalSamples} flagged=${flagged.length} high=${summary.highRisk} outputDir=${outputDir}`,
  )
}

void main().catch((error) => {
  console.error('[export_dataset_review_report] failed:', error)
  process.exit(1)
})
