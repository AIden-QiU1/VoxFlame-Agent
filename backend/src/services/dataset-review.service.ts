import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

export type DatasetEvaluationStatus =
  | 'ready'
  | 'sampled_for_review'
  | 'retry_recommended'

export type DatasetReviewQueue =
  | 'auto_accept'
  | 'manual_review'
  | 'retry_recommended'

export type DatasetReviewPriority = 'low' | 'medium' | 'high'
export type DatasetExportReviewStatus = 'pending' | 'accepted' | 'rejected'

interface VoiceContributionReviewRow {
  id: string
  contributor_id: string
  audio_path: string
  transcript: string
  created_at: string
  metadata: JsonRecord | null
}

export interface DatasetReviewQueueItem {
  id: string
  contributorId: string
  audioPath: string
  targetText: string
  recognizedText: string | null
  createdAt: string
  evaluationStatus: DatasetEvaluationStatus
  reviewQueue: DatasetReviewQueue
  reviewPriority: DatasetReviewPriority
  reviewRequired: boolean
  reviewSummary: string | null
  reviewReasonTags: string[]
  sampleQualityTier: string | null
  sampleQualityScore: number | null
  confidence: number | null
  latencyMs: number | null
  acceptedForExport: boolean | null
  exportReviewStatus: DatasetExportReviewStatus
  rejectionReason: string | null
  reviewer: string | null
  reviewedAt: string | null
  uploadReceipt: {
    recordingId: string | null
    manifestPath: string | null
    manifestSynced: boolean
  }
}

export interface DatasetReviewQueueFilters {
  contributorId: string
  evaluationStatus?: DatasetEvaluationStatus | 'all'
  exportReviewStatus?: DatasetExportReviewStatus | 'all'
  limit?: number
}

export interface UpdateDatasetReviewDecisionInput {
  contributionId: string
  contributorId: string
  evaluationStatus?: DatasetEvaluationStatus
  reviewQueue?: DatasetReviewQueue
  reviewPriority?: DatasetReviewPriority
  reviewRequired?: boolean
  reviewSummary?: string | null
  reviewReasonTags?: string[]
  acceptedForExport?: boolean | null
  rejectionReason?: string | null
  reviewer?: string | null
  reviewedAt?: string | null
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(metadata: JsonRecord | null | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readBoolean(metadata: JsonRecord | null | undefined, key: string): boolean | undefined {
  const value = metadata?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function readNumber(metadata: JsonRecord | null | undefined, key: string): number | undefined {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readStringArray(metadata: JsonRecord | null | undefined, key: string): string[] {
  const value = metadata?.[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeEvaluationStatus(
  value: string | undefined,
): DatasetEvaluationStatus {
  if (value === 'sampled_for_review') {
    return 'sampled_for_review'
  }

  if (value === 'retry_recommended' || value === 'rejected') {
    return 'retry_recommended'
  }

  return 'ready'
}

function normalizeReviewQueue(
  value: string | undefined,
): DatasetReviewQueue {
  if (value === 'manual_review') {
    return 'manual_review'
  }

  if (value === 'retry_recommended') {
    return 'retry_recommended'
  }

  return 'auto_accept'
}

function normalizeReviewPriority(
  value: string | undefined,
): DatasetReviewPriority {
  if (value === 'medium' || value === 'high') {
    return value
  }

  return 'low'
}

function getExportReviewStatus(metadata: JsonRecord | null | undefined): DatasetExportReviewStatus {
  const acceptedForExport = readBoolean(metadata, 'accepted_for_export')
  if (acceptedForExport === true) {
    return 'accepted'
  }

  if (acceptedForExport === false || readString(metadata, 'rejection_reason')) {
    return 'rejected'
  }

  return 'pending'
}

function normalizeQueueItem(row: VoiceContributionReviewRow): DatasetReviewQueueItem {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const uploadReceipt = isRecord(metadata.upload_receipt) ? metadata.upload_receipt : {}

  return {
    id: row.id,
    contributorId: row.contributor_id,
    audioPath: row.audio_path,
    targetText: readString(metadata, 'target_text') || row.transcript,
    recognizedText:
      readString(metadata, 'recognized_text') ||
      readString(metadata, 'raw_transcript') ||
      null,
    createdAt: row.created_at,
    evaluationStatus: normalizeEvaluationStatus(readString(metadata, 'evaluation_status')),
    reviewQueue: normalizeReviewQueue(readString(metadata, 'review_queue')),
    reviewPriority: normalizeReviewPriority(readString(metadata, 'review_priority')),
    reviewRequired: readBoolean(metadata, 'review_required') ?? false,
    reviewSummary: readString(metadata, 'review_summary') || null,
    reviewReasonTags: readStringArray(metadata, 'review_reason_tags'),
    sampleQualityTier: readString(metadata, 'sample_quality_tier') || null,
    sampleQualityScore: readNumber(metadata, 'sample_quality_score') ?? null,
    confidence: readNumber(metadata, 'confidence') ?? null,
    latencyMs: readNumber(metadata, 'latency_ms') ?? null,
    acceptedForExport: readBoolean(metadata, 'accepted_for_export') ?? null,
    exportReviewStatus: getExportReviewStatus(metadata),
    rejectionReason: readString(metadata, 'rejection_reason') || null,
    reviewer: readString(metadata, 'reviewer') || null,
    reviewedAt: readString(metadata, 'reviewed_at') || null,
    uploadReceipt: {
      recordingId: readString(uploadReceipt, 'recording_id') || null,
      manifestPath: readString(uploadReceipt, 'manifest_path') || null,
      manifestSynced: readBoolean(uploadReceipt, 'manifest_synced') === true,
    },
  }
}

async function getContributionRow(
  contributionId: string,
  contributorId: string,
): Promise<VoiceContributionReviewRow | null> {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('voice_contributions')
    .select('id, contributor_id, audio_path, transcript, created_at, metadata')
    .eq('id', contributionId)
    .eq('contributor_id', contributorId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as VoiceContributionReviewRow | null
}

export class DatasetReviewService {
  async getItem(
    contributionId: string,
    contributorId: string,
  ): Promise<DatasetReviewQueueItem | null> {
    const row = await getContributionRow(contributionId, contributorId)
    return row ? normalizeQueueItem(row) : null
  }

  async listQueue(filters: DatasetReviewQueueFilters): Promise<DatasetReviewQueueItem[]> {
    if (!supabase) {
      return []
    }

    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100))
    const { data, error } = await supabase
      .from('voice_contributions')
      .select('id, contributor_id, audio_path, transcript, created_at, metadata')
      .eq('contributor_id', filters.contributorId)
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 5, 50))

    if (error) {
      throw new Error(error.message)
    }

    return ((data || []) as VoiceContributionReviewRow[])
      .map(normalizeQueueItem)
      .filter((item) => {
        if (
          filters.evaluationStatus &&
          filters.evaluationStatus !== 'all' &&
          item.evaluationStatus !== filters.evaluationStatus
        ) {
          return false
        }

        if (
          filters.exportReviewStatus &&
          filters.exportReviewStatus !== 'all' &&
          item.exportReviewStatus !== filters.exportReviewStatus
        ) {
          return false
        }

        return true
      })
      .slice(0, limit)
  }

  async updateDecision(
    input: UpdateDatasetReviewDecisionInput,
  ): Promise<DatasetReviewQueueItem | null> {
    if (!supabase) {
      return null
    }

    const existing = await getContributionRow(input.contributionId, input.contributorId)
    if (!existing) {
      return null
    }

    const existingMetadata = isRecord(existing.metadata) ? existing.metadata : {}
    const acceptedForExport = input.acceptedForExport ?? null
    const nextMetadata: JsonRecord = {
      ...existingMetadata,
      ...(input.evaluationStatus ? { evaluation_status: input.evaluationStatus } : {}),
      ...(input.reviewQueue ? { review_queue: input.reviewQueue } : {}),
      ...(input.reviewPriority ? { review_priority: input.reviewPriority } : {}),
      ...(typeof input.reviewRequired === 'boolean' ? { review_required: input.reviewRequired } : {}),
      ...(typeof input.reviewSummary !== 'undefined' ? { review_summary: input.reviewSummary } : {}),
      ...(Array.isArray(input.reviewReasonTags) ? { review_reason_tags: input.reviewReasonTags } : {}),
      reviewed_at: input.reviewedAt || new Date().toISOString(),
      reviewer: input.reviewer || input.contributorId,
      accepted_for_export: acceptedForExport,
      rejection_reason:
        acceptedForExport === false
          ? (input.rejectionReason || existingMetadata.rejection_reason || 'not_selected_for_export')
          : input.rejectionReason ?? null,
    }

    if (acceptedForExport === true) {
      nextMetadata.rejection_reason = null
    }

    const { error } = await supabase
      .from('voice_contributions')
      .update({ metadata: nextMetadata })
      .eq('id', input.contributionId)
      .eq('contributor_id', input.contributorId)

    if (error) {
      throw new Error(error.message)
    }

    const updated = await getContributionRow(input.contributionId, input.contributorId)
    return updated ? normalizeQueueItem(updated) : null
  }
}

export const datasetReviewService = new DatasetReviewService()
