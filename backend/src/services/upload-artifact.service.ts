import { createClient } from '@supabase/supabase-js'
import { ossService } from './oss.service'

type JsonRecord = Record<string, unknown>

export interface UploadCompletePayload {
  contributorId: string
  audioPath: string
  text: string
  recognizedText?: string | null
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
  transcriptAlreadySynced: boolean | null
}

export interface DiscardUploadPayload {
  contributorId: string
  contributionId?: string | null
  audioPath?: string | null
  recordingId?: string | null
}

export interface DiscardUploadResult {
  contributionId: string | null
  audioPath: string | null
  recordingId: string | null
  manifestPath: string
  removedContribution: boolean
  removedAudioObject: boolean
  removedManifestEntry: boolean
  removedTranscriptEntry: boolean
}

interface ContributionRecord {
  id: string
  metadata: JsonRecord
  audio_path?: string | null
  sentence_id?: string | null
}

interface UploadReceiptMetadata extends JsonRecord {
  recording_id?: string
  audio_path?: string
  manifest_path?: string
  manifest_synced?: boolean
  synced_at?: string
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

function readBoolean(metadata: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = metadata?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function readStringArray(metadata: Record<string, unknown> | undefined, key: string): string[] | undefined {
  const value = metadata?.[key]
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return items.length > 0 ? items : undefined
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'unknown_error'
}

function buildRecordingManifestEntry(
  contributorId: string,
  audioPath: string,
  text: string,
  recognizedText: string | null | undefined,
  duration: number | null | undefined,
  metadata: Record<string, unknown> | undefined,
) {
  const targetText = readString(metadata, 'target_text') || text
  const alignedTranscript =
    readString(metadata, 'prompt_aligned_transcript') ||
    targetText
  const recognizedTranscript =
    recognizedText ||
    readString(metadata, 'recognized_text') ||
    readString(metadata, 'raw_transcript') ||
    ''
  const promptGroupKey =
    readString(metadata, 'prompt_group_key') ||
    readString(metadata, 'exercise_id') ||
    targetText
  const promptFingerprint =
    readString(metadata, 'prompt_fingerprint') ||
    targetText.replace(/\s+/g, '')
  const recordingDedupeKey =
    readString(metadata, 'recording_dedupe_key') ||
    readString(metadata, 'recording_id') ||
    audioPath
  const duplicatePolicy =
    readString(metadata, 'duplicate_policy') ||
    'exact_recording_retry_only'
  const repeatedPromptStrategy =
    readString(metadata, 'repeated_prompt_strategy') ||
    'keep_multiple_attempts'

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
      text: readString(metadata, 'exercise_text') || targetText,
      category: readString(metadata, 'exercise_category'),
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
      raw: recognizedTranscript,
      final: targetText,
      aligned: alignedTranscript,
      source: 'rtc_asr',
      confidence: readNumber(metadata, 'confidence') ?? undefined,
      latency_ms: readNumber(metadata, 'latency_ms') ?? undefined,
      language: 'zh-CN',
    },
    evaluation: {
      clarity_signals: {
        clarity_score: readNumber(metadata, 'clarity_score'),
        feedback_status: readString(metadata, 'feedback_status'),
        alignment_score: readNumber(metadata, 'alignment_score'),
        alignment_tier: readString(metadata, 'alignment_tier'),
        alignment_status: readString(metadata, 'alignment_status'),
        transcript_coverage_ratio: readNumber(metadata, 'transcript_coverage_ratio'),
        confidence_source: readString(metadata, 'confidence_source'),
        latency_ms: readNumber(metadata, 'latency_ms'),
      },
      error_tags: [
        ...(readStringArray(metadata, 'missing_chars') || []).map((item) => `missing:${item}`),
        ...(readStringArray(metadata, 'extra_chars') || []).map((item) => `extra:${item}`),
      ],
      focus_feedback: readStringArray(metadata, 'speech_patterns'),
      alignment_summary: readString(metadata, 'alignment_summary'),
      alignment_reasons: readStringArray(metadata, 'alignment_reasons'),
    },
    consent: {
      scope: readString(metadata, 'consent_scope') || 'training_only',
      retention_tier: 'synced_hot',
      sync_status: 'uploaded',
      visibility: 'private',
    },
    lineage: {
      prompt_group_key: promptGroupKey,
      prompt_fingerprint: promptFingerprint,
      recording_dedupe_key: recordingDedupeKey,
      duplicate_policy: duplicatePolicy,
      repeated_prompt_strategy: repeatedPromptStrategy,
    },
    metadata: metadata || {},
  }
}

function buildUploadReceiptMetadata(
  manifestPath: string,
  audioPath: string,
  recordingId: string,
  manifestSynced: boolean,
): UploadReceiptMetadata {
  return {
    recording_id: recordingId,
    audio_path: audioPath,
    manifest_path: manifestPath,
    manifest_synced: manifestSynced,
    synced_at: new Date().toISOString(),
  }
}

function readUploadReceipt(metadata: JsonRecord): UploadReceiptMetadata {
  return isRecord(metadata.upload_receipt)
    ? metadata.upload_receipt as UploadReceiptMetadata
    : {}
}

function hasManifestReceipt(
  receipt: UploadReceiptMetadata,
  recordingId: string,
  manifestPath: string,
): boolean {
  return (
    receipt.manifest_synced === true &&
    receipt.recording_id === recordingId &&
    receipt.manifest_path === manifestPath
  )
}

function buildTranscriptExportLine(
  contributorId: string,
  audioPath: string,
  text: string,
  sentenceId?: string | null,
): { path: string; line: string; uttId: string } | null {
  if (!sentenceId) {
    return null
  }

  const fileName = audioPath.split('/').pop() || `${sentenceId}_${Date.now()}.wav`
  const uttId = fileName.replace(/\.[^/.]+$/, '')

  return {
    path: `dataset/${contributorId}/transcripts.txt`,
    line: `${uttId}\t${audioPath}\t${text}`,
    uttId,
  }
}

async function manifestContainsEntry(
  manifestPath: string,
  recordingId: string,
  audioPath: string,
): Promise<boolean> {
  const content = await ossService.getTextObject(manifestPath)
  if (!content) {
    return false
  }

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .some((line) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>
        const audio = isRecord(parsed.audio) ? parsed.audio : {}
        return parsed.recording_id === recordingId || audio.path === audioPath
      } catch {
        return line.includes(audioPath) || line.includes(`"recording_id":"${recordingId}"`)
      }
    })
}

async function transcriptExportContainsLine(
  transcriptsPath: string,
  expectedLine: string,
  audioPath: string,
  uttId: string,
): Promise<boolean> {
  const content = await ossService.getTextObject(transcriptsPath)
  if (!content) {
    return false
  }

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .some((line) => (
      line === expectedLine ||
      line.includes(`\t${audioPath}\t`) ||
      line.startsWith(`${uttId}\t${audioPath}\t`)
    ))
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
    .select('id, metadata, audio_path, sentence_id')
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
    audio_path: typeof row.audio_path === 'string' ? row.audio_path : null,
    sentence_id: typeof row.sentence_id === 'string' ? row.sentence_id : null,
  }
}

async function findContributionForDiscard(payload: DiscardUploadPayload): Promise<ContributionRecord | null> {
  if (!supabase) {
    return null
  }

  let query = supabase
    .from('voice_contributions')
    .select('id, metadata, audio_path, sentence_id')
    .eq('contributor_id', payload.contributorId)

  if (payload.contributionId) {
    query = query.eq('id', payload.contributionId)
  } else if (payload.audioPath) {
    query = query.eq('audio_path', payload.audioPath)
  } else {
    return null
  }

  const { data, error } = await query.limit(1)

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
    audio_path: typeof row.audio_path === 'string' ? row.audio_path : null,
    sentence_id: typeof row.sentence_id === 'string' ? row.sentence_id : null,
  }
}

async function upsertContributionSkeleton(payload: UploadCompletePayload): Promise<ContributionRecord | null> {
  if (!supabase) {
    return null
  }

  const row = {
    contributor_id: payload.contributorId,
    audio_path: payload.audioPath,
    transcript: payload.text,
    sentence_id: payload.sentenceId || null,
    is_free_recording: payload.source !== 'guided_recording',
    duration_seconds: payload.duration,
    metadata: payload.metadata || {},
  }

  const { data, error } = await supabase
    .from('voice_contributions')
    .insert(row)
    .select('id, metadata')
    .single()

  if (error) {
    const existing = await findExistingContribution(payload.contributorId, payload.audioPath)
    if (existing) {
      return existing
    }

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

function lineMatchesRecording(line: string, recordingId: string | null, audioPath: string | null): boolean {
  if (!line.trim()) {
    return false
  }

  try {
    const parsed = JSON.parse(line) as Record<string, unknown>
    const audio = isRecord(parsed.audio) ? parsed.audio : {}
    return (
      (Boolean(recordingId) && parsed.recording_id === recordingId) ||
      (Boolean(audioPath) && audio.path === audioPath)
    )
  } catch {
    return (
      (Boolean(audioPath) && line.includes(audioPath ?? '')) ||
      (Boolean(recordingId) && line.includes(`"recording_id":"${recordingId}"`))
    )
  }
}

async function removeRecordingFromManifest(
  manifestPath: string,
  recordingId: string | null,
  audioPath: string | null,
): Promise<boolean> {
  const content = await ossService.getTextObject(manifestPath)
  if (!content) {
    return false
  }

  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  const remaining = lines.filter((line) => !lineMatchesRecording(line, recordingId, audioPath))

  if (remaining.length === lines.length) {
    return false
  }

  await ossService.replaceTextLog(manifestPath, remaining)
  return true
}

async function removeRecordingFromTranscriptExport(
  transcriptsPath: string,
  audioPath: string | null,
  recordingId: string | null,
): Promise<boolean> {
  const content = await ossService.getTextObject(transcriptsPath)
  if (!content) {
    return false
  }

  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  const remaining = lines.filter((line) => {
    if (audioPath && line.includes(`\t${audioPath}\t`)) {
      return false
    }

    if (recordingId && line.startsWith(`${recordingId}\t`)) {
      return false
    }

    return true
  })

  if (remaining.length === lines.length) {
    return false
  }

  await ossService.replaceTextLog(transcriptsPath, remaining)
  return true
}

async function deleteContribution(contributorId: string, contributionId: string): Promise<boolean> {
  if (!supabase) {
    return false
  }

  const { error } = await supabase
    .from('voice_contributions')
    .delete()
    .eq('id', contributionId)
    .eq('contributor_id', contributorId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export class UploadArtifactService {
  async persistCompletedUpload(payload: UploadCompletePayload): Promise<UploadArtifactResult> {
    const manifestPath = `dataset/${payload.contributorId}/manifest.jsonl`
    const manifestEntry = buildRecordingManifestEntry(
      payload.contributorId,
      payload.audioPath,
      payload.text,
      payload.recognizedText,
      typeof payload.duration === 'number' ? payload.duration : null,
      payload.metadata || {},
    )

    let existing: ContributionRecord | null = null
    let reusedContribution = false

    try {
      existing = await findExistingContribution(payload.contributorId, payload.audioPath)
      reusedContribution = Boolean(existing)

      if (!existing) {
        existing = await upsertContributionSkeleton(payload)
      }
    } catch (error) {
      console.warn(
        `[UploadArtifactService] contribution persistence skipped for ${payload.audioPath}: ${toErrorMessage(error)}`,
      )
    }

    const currentMetadata = existing?.metadata ?? {}
    const mergedMetadata = {
      ...currentMetadata,
      ...(payload.metadata || {}),
    }
    const existingReceipt = readUploadReceipt(currentMetadata)
    let manifestAlreadySynced = hasManifestReceipt(
      existingReceipt,
      manifestEntry.recording_id,
      manifestPath,
    )

    if (!manifestAlreadySynced) {
      manifestAlreadySynced = await manifestContainsEntry(
        manifestPath,
        manifestEntry.recording_id,
        payload.audioPath,
      )
    }

    if (!manifestAlreadySynced) {
      await ossService.appendTextLog(
        manifestPath,
        JSON.stringify(manifestEntry),
      )
    }

    const transcriptExport = payload.source === 'guided_recording'
      ? buildTranscriptExportLine(
        payload.contributorId,
        payload.audioPath,
        payload.text,
        payload.sentenceId,
      )
      : null

    let transcriptAlreadySynced: boolean | null = null

    if (transcriptExport) {
      transcriptAlreadySynced = await transcriptExportContainsLine(
        transcriptExport.path,
        transcriptExport.line,
        payload.audioPath,
        transcriptExport.uttId,
      )

      if (!transcriptAlreadySynced) {
        await ossService.appendTextLog(transcriptExport.path, transcriptExport.line)
      }
    }

    if (existing?.id) {
      const nextReceipt = hasManifestReceipt(existingReceipt, manifestEntry.recording_id, manifestPath)
        ? {
          ...existingReceipt,
          audio_path: payload.audioPath,
          manifest_path: manifestPath,
          manifest_synced: true,
        }
        : buildUploadReceiptMetadata(
          manifestPath,
          payload.audioPath,
          manifestEntry.recording_id,
          true,
        )

      try {
        await updateContributionMetadata(existing.id, {
          ...mergedMetadata,
          upload_receipt: nextReceipt,
        })
      } catch (error) {
        console.warn(
          `[UploadArtifactService] upload receipt update skipped for ${payload.audioPath}: ${toErrorMessage(error)}`,
        )
      }
    }

    return {
      contributionId: existing?.id ?? null,
      recordingId: manifestEntry.recording_id,
      manifestPath,
      reusedContribution,
      manifestAlreadySynced,
      transcriptAlreadySynced,
    }
  }

  async discardCompletedUpload(payload: DiscardUploadPayload): Promise<DiscardUploadResult> {
    const manifestPath = `dataset/${payload.contributorId}/manifest.jsonl`
    const existing = await findContributionForDiscard(payload)
    const metadata = existing?.metadata ?? {}
    const receipt = readUploadReceipt(metadata)
    const audioPath =
      existing?.audio_path ||
      payload.audioPath ||
      receipt.audio_path ||
      null
    const recordingId =
      payload.recordingId ||
      receipt.recording_id ||
      readString(metadata, 'recording_id') ||
      (audioPath ? audioPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || null : null)
    const contributionId = existing?.id ?? payload.contributionId ?? null

    const removedContribution = contributionId
      ? await deleteContribution(payload.contributorId, contributionId)
      : false
    const removedManifestEntry = await removeRecordingFromManifest(
      manifestPath,
      recordingId,
      audioPath,
    )
    const removedTranscriptEntry = await removeRecordingFromTranscriptExport(
      `dataset/${payload.contributorId}/transcripts.txt`,
      audioPath,
      recordingId,
    )

    let removedAudioObject = false
    if (audioPath) {
      await ossService.deleteObject(audioPath)
      removedAudioObject = true
    }

    return {
      contributionId,
      audioPath,
      recordingId,
      manifestPath,
      removedContribution,
      removedAudioObject,
      removedManifestEntry,
      removedTranscriptEntry,
    }
  }
}

export const uploadArtifactService = new UploadArtifactService()
