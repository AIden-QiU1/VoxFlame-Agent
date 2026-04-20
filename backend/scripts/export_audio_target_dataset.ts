import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import OSS from 'ali-oss'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface ScriptOptions {
  email?: string
  userId?: string
  limit: number
  includePending: boolean
  outputDir?: string
  batchId?: string
}

interface SpeakerProfileLabels {
  condition?: string
  etiology?: string
  severity?: string
  priority?: string
}

interface AudioTargetEntry {
  audio: string
  target: string
  speaker_profile?: SpeakerProfileLabels
}

interface VoiceContributionExportRow {
  id: string
  contributor_id: string
  audio_path: string
  transcript: string
  metadata: Record<string, unknown> | null
}

interface UserProfileExportRow {
  condition: string | null
  preferences: Record<string, unknown> | null
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    limit: 500,
    includePending: false,
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

    if (arg === '--limit' && argv[index + 1]) {
      const parsed = Number(argv[index + 1])
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed
      }
      index += 1
      continue
    }

    if (arg === '--output-dir' && argv[index + 1]) {
      options.outputDir = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--batch-id' && argv[index + 1]) {
      options.batchId = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--include-pending') {
      options.includePending = true
    }
  }

  return options
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} 缺失，无法导出 audio+target 数据集。`)
  }
  return value
}

function createOssClient(): OSS {
  return new OSS({
    region: process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou',
    accessKeyId: requireEnv('OSS_ACCESS_KEY_ID'),
    accessKeySecret: requireEnv('OSS_ACCESS_KEY_SECRET'),
    bucket: requireEnv('OSS_BUCKET'),
    secure: true,
  })
}

function buildLocalAudioFilename(recordingId: string, objectPath: string): string {
  const ext = path.extname(objectPath).trim() || '.bin'
  return `${recordingId}${ext}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeSpeakerProfileLabels(
  labels: SpeakerProfileLabels,
): SpeakerProfileLabels | undefined {
  const normalized = Object.fromEntries(
    Object.entries(labels).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  ) as SpeakerProfileLabels

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function readSpeakerProfileFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): SpeakerProfileLabels | undefined {
  const guidanceProfile = isRecord(metadata?.training_guidance_profile)
    ? metadata?.training_guidance_profile as Record<string, unknown>
    : null

  return normalizeSpeakerProfileLabels({
    etiology: readString(guidanceProfile, 'etiology') ?? undefined,
    severity: readString(guidanceProfile, 'severity') ?? undefined,
    priority: readString(guidanceProfile, 'priority') ?? undefined,
  })
}

function readSpeakerProfileFromUserProfile(
  userProfile: UserProfileExportRow | null,
): SpeakerProfileLabels | undefined {
  const preferences = isRecord(userProfile?.preferences) ? userProfile.preferences : null
  const profileMemory = isRecord(preferences?.user_profile_memory)
    ? preferences?.user_profile_memory as Record<string, unknown>
    : null
  const guidanceProfile = isRecord(preferences?.training_guidance_profile)
    ? preferences?.training_guidance_profile as Record<string, unknown>
    : null

  return normalizeSpeakerProfileLabels({
    condition: userProfile?.condition?.trim() || undefined,
    etiology:
      readString(profileMemory, 'etiology')
      ?? readString(guidanceProfile, 'etiology')
      ?? undefined,
    severity:
      readString(profileMemory, 'severity')
      ?? readString(guidanceProfile, 'severity')
      ?? undefined,
    priority: readString(guidanceProfile, 'priority') ?? undefined,
  })
}

async function resolveUserId(
  supabase: any,
  email: string,
): Promise<string | null> {
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

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim()

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY 缺失，无法导出 audio+target 数据集。')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  let userId = options.userId || null

  if (!userId && options.email) {
    userId = await resolveUserId(supabase, options.email)
    if (!userId) {
      throw new Error(`没有找到邮箱 ${options.email} 对应的用户。`)
    }
  }

  const userProfile = userId
    ? (() => supabase
      .from('user_profiles')
      .select('condition, preferences')
      .eq('id', userId)
      .maybeSingle())()
    : null

  const batchId = options.batchId || `audio_target_export_${new Date().toISOString().replace(/[:.]/g, '-')}`
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.resolve('/tmp', batchId)
  const audioDir = path.join(outputDir, 'audio')
  const manifestPath = path.join(outputDir, 'samples.jsonl')

  await fs.mkdir(audioDir, { recursive: true })

  let query = supabase
    .from('voice_contributions')
    .select('id, contributor_id, audio_path, transcript, metadata')
    .order('created_at', { ascending: false })
    .limit(options.limit)

  if (userId) {
    query = query.eq('contributor_id', userId)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  const userProfileResult = userProfile ? await userProfile : null
  if (userProfileResult?.error) {
    throw userProfileResult.error
  }
  const defaultSpeakerProfile = readSpeakerProfileFromUserProfile(
    (userProfileResult?.data ?? null) as UserProfileExportRow | null,
  )

  const entries = ((data || []) as VoiceContributionExportRow[]).map((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {}

    const targetText = typeof metadata.target_text === 'string' && metadata.target_text.trim()
      ? metadata.target_text.trim()
      : row.transcript
    const recordingId = typeof metadata.recording_id === 'string' && metadata.recording_id.trim()
      ? metadata.recording_id.trim()
      : row.audio_path.split('/').pop()?.replace(/\.[^/.]+$/, '') || row.id

    return {
      audioPath: row.audio_path,
      targetText,
      recordingId,
      speakerProfile: readSpeakerProfileFromMetadata(metadata) ?? defaultSpeakerProfile,
    }
  })

  const ossClient = createOssClient()
  const rows: AudioTargetEntry[] = []

  for (const entry of entries) {
    const objectPath = entry.audioPath
    const localFilename = buildLocalAudioFilename(entry.recordingId, objectPath)
    const localAudioPath = path.join(audioDir, localFilename)

    await ossClient.get(objectPath, localAudioPath)

    rows.push({
      audio: path.posix.join('audio', localFilename),
      target: entry.targetText,
      ...(entry.speakerProfile ? { speaker_profile: entry.speakerProfile } : {}),
    })
  }

  const content = rows.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(manifestPath, content.length > 0 ? `${content}\n` : '', 'utf8')

  console.log(
    `[export_audio_target_dataset] batch=${batchId} count=${rows.length} outputDir=${outputDir}${userId ? ` user=${userId}` : ''}`,
  )
}

void main().catch((error) => {
  console.error('[export_audio_target_dataset] failed:', error)
  process.exit(1)
})
