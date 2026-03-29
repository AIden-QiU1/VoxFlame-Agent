import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })

type JsonRecord = Record<string, unknown>
type ReviewStatusFilter = 'all' | 'sampled_for_review' | 'retry_recommended'

interface VoiceContributionRow {
  id: string
  contributor_id: string
  audio_path: string
  transcript: string
  created_at: string
  metadata: JsonRecord | null
}

interface ScriptOptions {
  email?: string
  userId?: string
  limit: number
  status: ReviewStatusFilter
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(metadata: JsonRecord | null | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStringArray(metadata: JsonRecord | null | undefined, key: string): string[] {
  const value = metadata?.[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    limit: 20,
    status: 'all',
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

    if (arg === '--status' && argv[index + 1]) {
      const rawValue = argv[index + 1]
      const value = rawValue === 'rejected'
        ? 'retry_recommended'
        : rawValue as ReviewStatusFilter
      if (value === 'all' || value === 'sampled_for_review' || value === 'retry_recommended') {
        options.status = value
      }
      index += 1
    }
  }

  return options
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

function getEvaluationStatus(metadata: JsonRecord | null): string | null {
  const value = readString(metadata, 'evaluation_status') || null
  return value === 'rejected' ? 'retry_recommended' : value
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失，无法读取 review queue。')
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
    .select('id, contributor_id, audio_path, transcript, created_at, metadata')
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
  const filtered = rows.filter((row) => {
    const evaluationStatus = getEvaluationStatus(row.metadata)

    if (!evaluationStatus) {
      return false
    }

    if (options.status === 'all') {
      return evaluationStatus === 'sampled_for_review' || evaluationStatus === 'retry_recommended'
    }

    return evaluationStatus === options.status
  }).slice(0, options.limit)

  console.log(
    `[dataset_review_queue] scanned=${rows.length} queued=${filtered.length} filter=${options.status}${userId ? ` user=${userId}` : ''}`,
  )

  for (const row of filtered) {
    const metadata = isRecord(row.metadata) ? row.metadata : {}
    console.log(JSON.stringify({
      id: row.id,
      contributorId: row.contributor_id,
      createdAt: row.created_at,
      audioPath: row.audio_path,
      targetText: row.transcript,
      evaluationStatus: readString(metadata, 'evaluation_status') || null,
      reviewQueue: readString(metadata, 'review_queue') || null,
      reviewPriority: readString(metadata, 'review_priority') || null,
      reviewSummary: readString(metadata, 'review_summary') || null,
      reviewReasonTags: readStringArray(metadata, 'review_reason_tags'),
      sampleQualityTier: readString(metadata, 'sample_quality_tier') || null,
    }, null, 2))
  }
}

void main().catch((error) => {
  console.error('[dataset_review_queue] failed:', error)
  process.exit(1)
})
