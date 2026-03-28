import { createClient } from '@supabase/supabase-js'
import { ossService } from './oss.service'

type JsonRecord = Record<string, unknown>

export interface UploadCompletePayload {
  contributorId: string
  audioPath: string
  text: string
  sentenceId?: string | null
  duration?: number | null
  source?: string
  metadata?: Record<string, unknown>
}

export interface UploadArtifactResult {
  contributionId: string | null
  recordingId: string
  manifestPath: string
  reusedContribution: boolean
  manifestAlreadySynced: boolean
}

interface ContributionRecord {
  id: string
  metadata: JsonRecord
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNumber(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readStringArray(metadata: Record<string, unknown> | undefined, key: string): string[] | undefined {
  const value = metadata?.[key]
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return items.length > 0 ? items : undefined
}

function buildRecordingManifestEntry(
  contributorId: string,
  audioPath: string,
  text: string,
  duration: number | null | undefined,
  metadata: Record<string, unknown> | undefined,
) {
  return {
    recording_id: readString(metadata, 'recording_id') || audioPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || `${Date.now()}`,
    user_id: contributorId,
    session_id: readString(metadata, 'session_id') || 'unknown-session',
    mode: readString(metadata, 'mode') || 'training',
    source_surface: readString(metadata, 'source_surface') || 'web',
    collection_mode: readString(metadata, 'collection_mode') || 'supervised',
    created_at: readString(metadata, 'timestamp') || new Date().toISOString(),
    prompt: {
      id: readString(metadata, 'exercise_id'),
      text: readString(metadata, 'exercise_text') || text,
      category: readString(metadata, 'exercise_category'),
      target_pinyin: readStringArray(metadata, 'target_pinyin'),
      target_focus: readStringArray(metadata, 'pronunciation_targets'),
      scenario_tag: [readString(metadata, 'exercise_category')].filter(Boolean),
    },
    audio: {
      path: audioPath,
      format: readString(metadata, 'audio_format') || 'audio/webm',
      sample_rate: readNumber(metadata, 'sample_rate') || 16000,
      channel_count: readNumber(metadata, 'channel_count') || 1,
      duration_ms: readNumber(metadata, 'duration_ms') || ((duration || 0) * 1000),
      file_size_bytes: readNumber(metadata, 'file_size_bytes'),
      capture_transport: readString(metadata, 'capture_transport') || 'rtc_dup_track',
    },
    transcript: {
      raw: readString(metadata, 'recognized_text') || '',
      final: text,
      source: 'rtc_asr',
      language: 'zh-CN',
    },
    evaluation: {
      clarity_signals: {
        clarity_score: readNumber(metadata, 'clarity_score'),
        feedback_status: readString(metadata, 'feedback_status'),
      },
      error_tags: [
        ...(readStringArray(metadata, 'missing_chars') || []).map((item) => `missing:${item}`),
        ...(readStringArray(metadata, 'extra_chars') || []).map((item) => `extra:${item}`),
      ],
      focus_feedback: readStringArray(metadata, 'focus_syllables'),
      evaluation_status: 'ready',
    },
    consent: {
      scope: readString(metadata, 'consent_scope') || 'training_only',
      retention_tier: 'synced_hot',
      sync_status: 'uploaded',
      visibility: 'private',
    },
    metadata: metadata || {},
  }
}

function buildUploadReceiptMetadata(
  manifestPath: string,
  audioPath: string,
  recordingId: string,
  manifestSynced: boolean,
): JsonRecord {
  return {
    recording_id: recordingId,
    audio_path: audioPath,
    manifest_path: manifestPath,
    manifest_synced: manifestSynced,
    synced_at: new Date().toISOString(),
  }
}

async function findExistingContribution(
  contributorId: string,
  audioPath: string,
): Promise<ContributionRecord | null> {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('voice_contributions')
    .select('id, metadata')
    .eq('contributor_id', contributorId)
    .eq('audio_path', audioPath)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  if (!row || typeof row.id !== 'string') {
    return null
  }

  return {
    id: row.id,
    metadata: isRecord(row.metadata) ? row.metadata : {},
  }
}

async function upsertContributionSkeleton(payload: UploadCompletePayload): Promise<ContributionRecord | null> {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('voice_contributions')
    .upsert(
      {
        contributor_id: payload.contributorId,
        audio_path: payload.audioPath,
        transcript: payload.text,
        sentence_id: payload.sentenceId || null,
        is_free_recording: payload.source !== 'guided_recording',
        duration_seconds: payload.duration,
        metadata: payload.metadata || {},
      },
      {
        onConflict: 'contributor_id,audio_path',
      },
    )
    .select('id, metadata')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!data || typeof data.id !== 'string') {
    return null
  }

  return {
    id: data.id,
    metadata: isRecord(data.metadata) ? data.metadata : {},
  }
}

async function updateContributionMetadata(
  contributionId: string,
  metadata: JsonRecord,
): Promise<void> {
  if (!supabase) {
    return
  }

  const { error } = await supabase
    .from('voice_contributions')
    .update({ metadata })
    .eq('id', contributionId)

  if (error) {
    throw new Error(error.message)
  }
}

export class UploadArtifactService {
  async persistCompletedUpload(payload: UploadCompletePayload): Promise<UploadArtifactResult> {
    const manifestPath = `dataset/${payload.contributorId}/manifest.jsonl`
    const manifestEntry = buildRecordingManifestEntry(
      payload.contributorId,
      payload.audioPath,
      payload.text,
      typeof payload.duration === 'number' ? payload.duration : null,
      payload.metadata || {},
    )

    let existing = await findExistingContribution(payload.contributorId, payload.audioPath)
    let reusedContribution = Boolean(existing)

    if (!existing) {
      existing = await upsertContributionSkeleton(payload)
    }

    const currentMetadata = existing?.metadata ?? {}
    const mergedMetadata = {
      ...currentMetadata,
      ...(payload.metadata || {}),
    }
    const existingReceipt = isRecord(currentMetadata.upload_receipt)
      ? currentMetadata.upload_receipt
      : {}
    const manifestAlreadySynced =
      existingReceipt.manifest_synced === true &&
      existingReceipt.recording_id === manifestEntry.recording_id

    if (!manifestAlreadySynced) {
      await ossService.appendTextLog(
        manifestPath,
        JSON.stringify(manifestEntry),
      )

      if (payload.source === 'guided_recording' && payload.sentenceId) {
        const fileName = payload.audioPath.split('/').pop() || `${payload.sentenceId}_${Date.now()}.wav`
        const uttId = fileName.replace(/\.[^/.]+$/, '')
        const line = `${uttId}\t${payload.audioPath}\t${payload.text}`
        await ossService.appendTextLog(`dataset/${payload.contributorId}/transcripts.txt`, line)
      }

      if (existing?.id) {
        await updateContributionMetadata(existing.id, {
          ...mergedMetadata,
          upload_receipt: buildUploadReceiptMetadata(
            manifestPath,
            payload.audioPath,
            manifestEntry.recording_id,
            true,
          ),
        })
      }
    } else if (existing?.id && Object.keys(payload.metadata || {}).length > 0) {
      await updateContributionMetadata(existing.id, mergedMetadata)
    }

    return {
      contributionId: existing?.id ?? null,
      recordingId: manifestEntry.recording_id,
      manifestPath,
      reusedContribution,
      manifestAlreadySynced,
    }
  }
}

export const uploadArtifactService = new UploadArtifactService()
