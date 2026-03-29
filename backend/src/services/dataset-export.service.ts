import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

interface VoiceContributionExportRow {
  id: string
  contributor_id: string
  audio_path: string
  transcript: string
  sentence_id: string | null
  duration_seconds: number | null
  created_at: string
  metadata: JsonRecord | null
}

export interface DatasetExportManifestEntry {
  export_batch_id: string
  exported_at: string
  contribution_id: string
  recording_id: string
  user_id: string
  session_id: string | null
  prompt: {
    id: string | null
    text: string
    category: string | null
  }
  audio: {
    path: string
    duration_ms: number | null
    sample_rate: number | null
    channel_count: number | null
    format: string | null
  }
  transcript: {
    target_text: string
    recognized_text: string | null
    aligned_text: string | null
    confidence: number | null
    latency_ms: number | null
  }
  evaluation: {
    status: string
    queue: string | null
    priority: string | null
    sample_quality_tier: string | null
    sample_quality_score: number | null
    review_reason_tags: string[]
    review_summary: string | null
  }
  review: {
    accepted_for_export: boolean
    reviewer: string | null
    reviewed_at: string | null
    rejection_reason: string | null
  }
  lineage: {
    prompt_group_key: string | null
    prompt_fingerprint: string | null
    recording_dedupe_key: string | null
  }
  upload_receipt: {
    manifest_path: string | null
    manifest_synced: boolean
  }
}

export interface DatasetExportFilters {
  contributorId?: string
  acceptedOnly?: boolean
  limit?: number
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(metadata: JsonRecord | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(metadata: JsonRecord | null | undefined, key: string): number | null {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(metadata: JsonRecord | null | undefined, key: string): boolean | null {
  const value = metadata?.[key]
  return typeof value === 'boolean' ? value : null
}

function readStringArray(metadata: JsonRecord | null | undefined, key: string): string[] {
  const value = metadata?.[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeAcceptedForExport(metadata: JsonRecord | null | undefined): boolean {
  return readBoolean(metadata, 'accepted_for_export') === true
}

function buildExportEntry(
  row: VoiceContributionExportRow,
  exportBatchId: string,
  exportedAt: string,
): DatasetExportManifestEntry {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const uploadReceipt = isRecord(metadata.upload_receipt) ? metadata.upload_receipt : {}
  const targetText = readString(metadata, 'target_text') || row.transcript
  const recordingId =
    readString(metadata, 'recording_id') ||
    row.audio_path.split('/').pop()?.replace(/\.[^/.]+$/, '') ||
    row.id

  return {
    export_batch_id: exportBatchId,
    exported_at: exportedAt,
    contribution_id: row.id,
    recording_id: recordingId,
    user_id: row.contributor_id,
    session_id: readString(metadata, 'session_id'),
    prompt: {
      id: readString(metadata, 'exercise_id') || row.sentence_id,
      text: targetText,
      category: readString(metadata, 'exercise_category'),
    },
    audio: {
      path: row.audio_path,
      duration_ms: readNumber(metadata, 'duration_ms') ?? (
        typeof row.duration_seconds === 'number' ? Math.round(row.duration_seconds * 1000) : null
      ),
      sample_rate: readNumber(metadata, 'sample_rate'),
      channel_count: readNumber(metadata, 'channel_count'),
      format: readString(metadata, 'audio_format'),
    },
    transcript: {
      target_text: targetText,
      recognized_text: readString(metadata, 'recognized_text') || readString(metadata, 'raw_transcript'),
      aligned_text: readString(metadata, 'prompt_aligned_transcript'),
      confidence: readNumber(metadata, 'confidence'),
      latency_ms: readNumber(metadata, 'latency_ms'),
    },
    evaluation: {
      status: readString(metadata, 'evaluation_status') || 'ready',
      queue: readString(metadata, 'review_queue'),
      priority: readString(metadata, 'review_priority'),
      sample_quality_tier: readString(metadata, 'sample_quality_tier'),
      sample_quality_score: readNumber(metadata, 'sample_quality_score'),
      review_reason_tags: readStringArray(metadata, 'review_reason_tags'),
      review_summary: readString(metadata, 'review_summary'),
    },
    review: {
      accepted_for_export: normalizeAcceptedForExport(metadata),
      reviewer: readString(metadata, 'reviewer'),
      reviewed_at: readString(metadata, 'reviewed_at'),
      rejection_reason: readString(metadata, 'rejection_reason'),
    },
    lineage: {
      prompt_group_key: readString(metadata, 'prompt_group_key'),
      prompt_fingerprint: readString(metadata, 'prompt_fingerprint'),
      recording_dedupe_key: readString(metadata, 'recording_dedupe_key'),
    },
    upload_receipt: {
      manifest_path: readString(uploadReceipt, 'manifest_path'),
      manifest_synced: readBoolean(uploadReceipt, 'manifest_synced') === true,
    },
  }
}

export class DatasetExportService {
  async listExportCandidates(
    filters: DatasetExportFilters = {},
  ): Promise<VoiceContributionExportRow[]> {
    if (!supabase) {
      return []
    }

    const limit = Math.max(1, Math.min(filters.limit ?? 500, 5000))
    let query = supabase
      .from('voice_contributions')
      .select('id, contributor_id, audio_path, transcript, sentence_id, duration_seconds, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters.contributorId) {
      query = query.eq('contributor_id', filters.contributorId)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    return ((data || []) as VoiceContributionExportRow[]).filter((row) => {
      const metadata = isRecord(row.metadata) ? row.metadata : {}
      if (filters.acceptedOnly === false) {
        return true
      }

      return normalizeAcceptedForExport(metadata)
    })
  }

  async buildExportManifest(
    exportBatchId: string,
    filters: DatasetExportFilters = {},
  ): Promise<DatasetExportManifestEntry[]> {
    const exportedAt = new Date().toISOString()
    const rows = await this.listExportCandidates(filters)
    return rows.map((row) => buildExportEntry(row, exportBatchId, exportedAt))
  }
}

export const datasetExportService = new DatasetExportService()
