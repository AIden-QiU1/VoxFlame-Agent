import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  type UploadCompletePayload,
  uploadArtifactService,
} from '../src/services/upload-artifact.service'

dotenv.config({ path: path.join(__dirname, '../.env') })

type JsonRecord = Record<string, unknown>

interface VoiceContributionRow {
  id: string
  contributor_id: string
  audio_path: string
  transcript: string
  sentence_id: string | null
  is_free_recording: boolean | null
  duration_seconds: number | null
  created_at: string
  metadata: JsonRecord | null
}

interface ScriptOptions {
  email?: string
  userId?: string
  limit: number
  write: boolean
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    limit: 20,
    write: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--write') {
      options.write = true
      continue
    }

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
    }
  }

  return options
}

function needsArtifactReconcile(metadata: JsonRecord | null): boolean {
  if (!isRecord(metadata)) {
    return true
  }

  const receipt = isRecord(metadata.upload_receipt)
    ? metadata.upload_receipt
    : null

  return !receipt || receipt.manifest_synced !== true || typeof receipt.manifest_path !== 'string'
}

function buildPayload(row: VoiceContributionRow): UploadCompletePayload {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const sourceFromMetadata = typeof metadata.source === 'string' ? metadata.source : null

  return {
    contributorId: row.contributor_id,
    audioPath: row.audio_path,
    text: row.transcript,
    recognizedText:
      typeof metadata.recognized_text === 'string'
        ? metadata.recognized_text
        : null,
    sentenceId: row.sentence_id,
    duration: row.duration_seconds,
    source:
      sourceFromMetadata ||
      (row.is_free_recording ? 'free_recording' : 'guided_recording'),
    metadata,
  }
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
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失，无法执行训练资产对账。')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  let userId = options.userId || null

  if (!userId && options.email) {
    userId = await resolveUserId(supabase, options.email)
    if (!userId) {
      throw new Error(`没有找到邮箱 ${options.email} 对应的用户。`)
    }
  }

  let query = supabase
    .from('voice_contributions')
    .select('id, contributor_id, audio_path, transcript, sentence_id, is_free_recording, duration_seconds, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(Math.max(options.limit * 5, 50))

  if (userId) {
    query = query.eq('contributor_id', userId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rows = (data || []) as VoiceContributionRow[]
  const pending = rows
    .filter((row) => needsArtifactReconcile(row.metadata))
    .slice(0, options.limit)

  console.log(`[reconcile_upload_artifacts] scanned=${rows.length} pending=${pending.length} write=${options.write}`)

  if (pending.length === 0) {
    return
  }

  for (const row of pending) {
    if (!options.write) {
      console.log(
        `[dry-run] ${row.id} ${row.audio_path} created_at=${row.created_at}`,
      )
      continue
    }

    const result = await uploadArtifactService.persistCompletedUpload(buildPayload(row))
    console.log(
      `[reconciled] ${row.id} contribution=${result.contributionId ?? 'none'} manifest=${result.manifestPath} alreadySynced=${result.manifestAlreadySynced}`,
    )
  }
}

void main().catch((error) => {
  console.error('[reconcile_upload_artifacts] failed:', error)
  process.exit(1)
})
