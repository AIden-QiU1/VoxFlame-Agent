import path from 'path'
import dotenv from 'dotenv'
import OSS from 'ali-oss'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })

type JsonRecord = Record<string, unknown>

interface ScriptOptions {
  email?: string
  userId?: string
  dryRun: boolean
  skipOss: boolean
}

interface UserProfileRow {
  id: string
  hotwords: string[] | null
  preferences: JsonRecord | null
}

interface VoiceContributionRow {
  id: string
  audio_path: string
  sentence_id: string | null
  metadata: JsonRecord | null
}

interface MemoryRow {
  id: string
  metadata: JsonRecord | null
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    dryRun: false,
    skipOss: false,
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

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--skip-oss') {
      options.skipOss = true
      continue
    }
  }

  return options
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(record: JsonRecord | null | undefined, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} 缺失，无法继续执行清理。`)
  }
  return value
}

async function resolveUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw error
    }

    const matched = data.users.find((user) => user.email === email)
    if (matched) {
      return matched.id
    }

    if (data.users.length < 200) {
      return null
    }

    page += 1
  }
}

function readPreparedExpressionAsset(preferences: JsonRecord | null): JsonRecord | null {
  if (!isRecord(preferences)) {
    return null
  }

  const value = preferences.prepared_expression_asset
  return isRecord(value) ? value : null
}

function readPreparedExpressionId(asset: JsonRecord | null): string | null {
  if (!asset) {
    return null
  }

  const structured = isRecord(asset.structured) ? asset.structured : null
  const draft = isRecord(asset.draft) ? asset.draft : null

  return (
    readString(structured, 'id') ||
    readString(draft, 'id') ||
    null
  )
}

function readPreparedExpressionTitle(asset: JsonRecord | null): string | null {
  if (!asset) {
    return null
  }

  const structured = isRecord(asset.structured) ? asset.structured : null
  const draft = isRecord(asset.draft) ? asset.draft : null

  return (
    readString(draft, 'title') ||
    readString(structured, 'title') ||
    null
  )
}

function readPreparedExpressionHotwords(asset: JsonRecord | null): string[] {
  if (!asset) {
    return []
  }

  const structured = isRecord(asset.structured) ? asset.structured : null
  const rehearsalSummary = isRecord(asset.rehearsal_summary) ? asset.rehearsal_summary : null

  return uniqueStrings([
    ...readStringArray(structured?.hotwords),
    ...readStringArray(rehearsalSummary?.hotwords),
  ])
}

function isPreparedExpressionContribution(
  row: VoiceContributionRow,
  preparedExpressionId: string | null,
  preparedExpressionTitle: string | null,
): boolean {
  const metadata = isRecord(row.metadata) ? row.metadata : null
  const sentenceId = row.sentence_id?.trim() ?? ''
  const metadataPreparedId = readString(metadata, 'prepared_expression_id')

  if (preparedExpressionId && metadataPreparedId === preparedExpressionId) {
    return true
  }

  if (readString(metadata, 'prepared_expression_section_id')) {
    return true
  }

  if (
    readString(metadata, 'exercise_source') === 'prepared_expression' ||
    readString(metadata, 'practice_source') === 'prepared_expression'
  ) {
    return true
  }

  if (sentenceId.includes('-manual-input:')) {
    return true
  }

  if (preparedExpressionTitle && sentenceId.startsWith(`${preparedExpressionTitle}-manual-input:`)) {
    return true
  }

  return false
}

function isPreparedExpressionMemory(
  row: MemoryRow,
  preparedExpressionId: string | null,
): boolean {
  const metadata = isRecord(row.metadata) ? row.metadata : null
  if (!metadata) {
    return false
  }

  if (
    preparedExpressionId &&
    readString(metadata, 'prepared_expression_id') === preparedExpressionId
  ) {
    return true
  }

  if (readString(metadata, 'prepared_expression_section_id')) {
    return true
  }

  if (
    readString(metadata, 'exercise_source') === 'prepared_expression' ||
    readString(metadata, 'practice_source') === 'prepared_expression'
  ) {
    return true
  }

  return false
}

function createOssClientIfConfigured(skipOss: boolean): OSS | null {
  if (skipOss) {
    return null
  }

  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim()
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim()
  const bucket = process.env.OSS_BUCKET?.trim()
  const region = process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou'

  if (!accessKeyId || !accessKeySecret || !bucket) {
    return null
  }

  return new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true,
  })
}

async function deleteRowsById(
  supabase: SupabaseClient,
  table: 'voice_contributions' | 'memories',
  ids: string[],
): Promise<void> {
  for (const batch of chunk(ids, 200)) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in('id', batch)

    if (error) {
      throw error
    }
  }
}

async function deleteOssObjects(
  ossClient: OSS | null,
  objectPaths: string[],
): Promise<{ deleted: number; failed: number }> {
  if (!ossClient || objectPaths.length === 0) {
    return { deleted: 0, failed: 0 }
  }

  let deleted = 0
  let failed = 0

  for (const objectPath of objectPaths) {
    try {
      await ossClient.delete(objectPath)
      deleted += 1
    } catch (error: unknown) {
      const status = (error as { status?: number }).status
      const code = (error as { code?: string }).code

      if (status === 404 || code === 'NoSuchKey') {
        continue
      }

      failed += 1
      console.warn(`[cleanup_prepared_expression_data] 删除 OSS 对象失败: ${objectPath}`, error)
    }
  }

  return { deleted, failed }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || requireEnv('SUPABASE_ANON_KEY'),
  )

  let userId = options.userId?.trim() || null
  if (!userId) {
    if (!options.email) {
      throw new Error('请至少提供 --email 或 --user-id。')
    }
    userId = await resolveUserIdByEmail(supabase, options.email)
  }

  if (!userId) {
    throw new Error('没有找到对应用户。')
  }

  const { data: userProfile, error: userProfileError } = await supabase
    .from('user_profiles')
    .select('id, hotwords, preferences')
    .eq('id', userId)
    .maybeSingle<UserProfileRow>()

  if (userProfileError) {
    throw userProfileError
  }

  if (!userProfile) {
    throw new Error(`没有找到 user_profiles 记录: ${userId}`)
  }

  const existingPreferences = isRecord(userProfile.preferences)
    ? userProfile.preferences
    : {}
  const preparedExpressionAsset = readPreparedExpressionAsset(existingPreferences)
  const preparedExpressionId = readPreparedExpressionId(preparedExpressionAsset)
  const preparedExpressionTitle = readPreparedExpressionTitle(preparedExpressionAsset)
  const preparedExpressionHotwords = readPreparedExpressionHotwords(preparedExpressionAsset)

  const { data: contributionsData, error: contributionsError } = await supabase
    .from('voice_contributions')
    .select('id, audio_path, sentence_id, metadata')
    .eq('contributor_id', userId)
    .limit(5000)

  if (contributionsError) {
    throw contributionsError
  }

  const contributions = (contributionsData || []) as VoiceContributionRow[]
  const preparedContributions = contributions.filter((row) =>
    isPreparedExpressionContribution(row, preparedExpressionId, preparedExpressionTitle),
  )
  const contributionIds = preparedContributions.map((row) => row.id)
  const audioPaths = uniqueStrings(preparedContributions.map((row) => row.audio_path).filter(Boolean))

  const { data: memoriesData, error: memoriesError } = await supabase
    .from('memories')
    .select('id, metadata')
    .eq('user_id', userId)
    .limit(10000)

  if (memoriesError) {
    throw memoriesError
  }

  const memories = (memoriesData || []) as MemoryRow[]
  const preparedMemories = memories.filter((row) =>
    isPreparedExpressionMemory(row, preparedExpressionId),
  )
  const memoryIds = preparedMemories.map((row) => row.id)

  const nextPreferences: JsonRecord = {
    ...existingPreferences,
  }
  nextPreferences.prepared_expression_asset = null

  const existingHotwords = Array.isArray(userProfile.hotwords)
    ? userProfile.hotwords.filter((value): value is string => typeof value === 'string')
    : []
  const nextHotwords = existingHotwords.filter((word) => !preparedExpressionHotwords.includes(word))

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        userId,
        preparedExpressionId,
        preparedExpressionTitle,
        preparedContributionCount: contributionIds.length,
        preparedMemoryCount: memoryIds.length,
        preparedAudioObjectCount: audioPaths.length,
        preparedHotwordsCount: preparedExpressionHotwords.length,
      },
      null,
      2,
    ),
  )

  if (options.dryRun) {
    return
  }

  if (contributionIds.length > 0) {
    await deleteRowsById(supabase, 'voice_contributions', contributionIds)
  }

  if (memoryIds.length > 0) {
    await deleteRowsById(supabase, 'memories', memoryIds)
  }

  const { error: profileUpdateError } = await supabase
    .from('user_profiles')
    .update({
      preferences: nextPreferences,
      hotwords: nextHotwords,
    })
    .eq('id', userId)

  if (profileUpdateError) {
    throw profileUpdateError
  }

  const ossClient = createOssClientIfConfigured(options.skipOss)
  const ossDeletionResult = await deleteOssObjects(ossClient, audioPaths)

  const { data: afterProfileData, error: afterProfileError } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle<{ preferences: JsonRecord | null }>()

  if (afterProfileError) {
    throw afterProfileError
  }

  const afterPreparedAsset = readPreparedExpressionAsset(
    isRecord(afterProfileData?.preferences) ? afterProfileData.preferences : null,
  )

  const { count: afterContributionCount, error: afterContributionError } = await supabase
    .from('voice_contributions')
    .select('id', { count: 'exact', head: true })
    .eq('contributor_id', userId)
    .or(
      [
        'sentence_id.like.%-manual-input:%',
        'metadata->>exercise_source.eq.prepared_expression',
        'metadata->>practice_source.eq.prepared_expression',
      ].join(','),
    )

  if (afterContributionError) {
    throw afterContributionError
  }

  const { data: afterMemoriesData, error: afterMemoriesError } = await supabase
    .from('memories')
    .select('id, metadata')
    .eq('user_id', userId)
    .limit(10000)

  if (afterMemoriesError) {
    throw afterMemoriesError
  }

  const remainingPreparedMemories = ((afterMemoriesData || []) as MemoryRow[]).filter((row) =>
    isPreparedExpressionMemory(row, preparedExpressionId),
  )

  console.log(
    JSON.stringify(
      {
        userId,
        preparedExpressionCleared: !afterPreparedAsset,
        deletedContributionCount: contributionIds.length,
        deletedMemoryCount: memoryIds.length,
        remainingPreparedContributionCount: afterContributionCount ?? 0,
        remainingPreparedMemoryCount: remainingPreparedMemories.length,
        ossDeletedCount: ossDeletionResult.deleted,
        ossDeleteFailedCount: ossDeletionResult.failed,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error('[cleanup_prepared_expression_data] failed:', error)
  process.exit(1)
})

