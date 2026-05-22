import path from 'path'
import dotenv from 'dotenv'
import OSS from 'ali-oss'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface ScriptOptions {
  email?: string
  userId?: string
  write: boolean
  skipOss: boolean
}

interface VoiceContributionRow {
  id: string
  audio_path: string | null
  created_at: string
  is_free_recording: boolean | null
}

interface DeleteResult {
  deleted: number
  missing: number
  failed: Array<{ path: string; reason: string }>
}

const SUPERVISED_MANDARIN_PREFIX = 'supervised/mandarin/'

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    write: false,
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

    if (arg === '--write') {
      options.write = true
      continue
    }

    if (arg === '--skip-oss') {
      options.skipOss = true
      continue
    }
  }

  return options
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} 缺失，无法继续执行上传语料清理。`)
  }
  return value
}

function createSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || requireEnv('SUPABASE_ANON_KEY'),
  )
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

async function resolveUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const perPage = 200

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    const matched = data.users.find((user) => user.email === email)
    if (matched) {
      return matched.id
    }

    if (data.users.length < perPage) {
      return null
    }
  }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? '')
        .filter((value) => value.length > 0),
    ),
  )
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

async function listAllObjects(client: OSS, prefix: string): Promise<OSS.ObjectMeta[]> {
  const objects: OSS.ObjectMeta[] = []
  let marker: string | undefined

  for (;;) {
    const result = await client.list(
      {
        prefix,
        marker,
        'max-keys': 1000,
      },
      {},
    )

    objects.push(...(result.objects || []))

    if (!result.isTruncated || !result.nextMarker) {
      break
    }

    marker = result.nextMarker
  }

  return objects
}

function isSupervisedMandarinObjectForUser(objectName: string, userId: string): boolean {
  const segments = objectName.split('/').filter((segment) => segment.length > 0)
  return segments[0] === 'supervised' && segments[1] === 'mandarin' && segments[3] === userId
}

async function listUserOssObjects(ossClient: OSS | null, userId: string): Promise<string[]> {
  if (!ossClient) {
    return []
  }

  const datasetObjects = await listAllObjects(ossClient, `dataset/${userId}/`)
  const supervisedObjects = await listAllObjects(ossClient, SUPERVISED_MANDARIN_PREFIX)

  return uniqueStrings([
    ...datasetObjects.map((object) => object.name),
    ...supervisedObjects
      .filter((object) => isSupervisedMandarinObjectForUser(object.name, userId))
      .map((object) => object.name),
  ])
}

async function fetchUserContributions(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoiceContributionRow[]> {
  const rows: VoiceContributionRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('voice_contributions')
      .select('id, audio_path, created_at, is_free_recording')
      .eq('contributor_id', userId)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    const batch = (data || []) as VoiceContributionRow[]
    rows.push(...batch)

    if (batch.length < pageSize) {
      break
    }
  }

  return rows
}

function toErrorReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code
    const status = (error as { status?: unknown }).status
    return [status, code].filter(Boolean).join(':') || 'unknown_error'
  }

  return 'unknown_error'
}

function isOssNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const status = (error as { status?: unknown }).status
  const code = (error as { code?: unknown }).code
  return status === 404 || code === 'NoSuchKey'
}

async function deleteOssObjects(ossClient: OSS | null, objectPaths: string[]): Promise<DeleteResult> {
  const result: DeleteResult = {
    deleted: 0,
    missing: 0,
    failed: [],
  }

  if (!ossClient) {
    return result
  }

  for (const objectPath of objectPaths) {
    try {
      await ossClient.delete(objectPath)
      result.deleted += 1
    } catch (error: unknown) {
      if (isOssNotFoundError(error)) {
        result.missing += 1
        continue
      }

      result.failed.push({
        path: objectPath,
        reason: toErrorReason(error),
      })
    }
  }

  return result
}

async function deleteContributionRows(
  supabase: SupabaseClient,
  userId: string,
  contributionIds: string[],
): Promise<void> {
  for (const batch of chunk(contributionIds, 200)) {
    const { error } = await supabase
      .from('voice_contributions')
      .delete()
      .eq('contributor_id', userId)
      .in('id', batch)

    if (error) {
      throw error
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const supabase = createSupabaseClient()

  let userId = options.userId?.trim() || null
  if (!userId) {
    if (!options.email) {
      throw new Error('请提供 --email 或 --user-id。')
    }
    userId = await resolveUserIdByEmail(supabase, options.email)
  }

  if (!userId) {
    throw new Error(`没有找到邮箱 ${options.email ?? ''} 对应的用户。`)
  }

  const ossClient = createOssClientIfConfigured(options.skipOss)
  const contributions = await fetchUserContributions(supabase, userId)
  const contributionIds = contributions.map((row) => row.id)
  const audioPathsFromDb = uniqueStrings(contributions.map((row) => row.audio_path))
  const userOssObjects = await listUserOssObjects(ossClient, userId)
  const ossObjectsToDelete = uniqueStrings([
    ...audioPathsFromDb,
    ...userOssObjects,
  ]).sort()

  const summary = {
    mode: options.write ? 'write' : 'dry-run',
    userId,
    email: options.email ?? null,
    voiceContributionCount: contributions.length,
    guidedContributionCount: contributions.filter((row) => row.is_free_recording !== true).length,
    freeRecordingContributionCount: contributions.filter((row) => row.is_free_recording === true).length,
    dbAudioPathCount: audioPathsFromDb.length,
    ossObjectCount: userOssObjects.length,
    totalOssObjectsToDelete: ossObjectsToDelete.length,
    firstContributionCreatedAt: contributions[0]?.created_at ?? null,
    lastContributionCreatedAt: contributions[contributions.length - 1]?.created_at ?? null,
    sampleOssObjects: ossObjectsToDelete.slice(0, 10),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (!options.write) {
    return
  }

  if (contributionIds.length > 0) {
    await deleteContributionRows(supabase, userId, contributionIds)
  }

  const ossDeletion = await deleteOssObjects(ossClient, ossObjectsToDelete)
  const remainingContributions = await fetchUserContributions(supabase, userId)
  const remainingOssObjects = await listUserOssObjects(ossClient, userId)

  console.log(
    JSON.stringify(
      {
        mode: 'write-result',
        userId,
        deletedContributionCount: contributionIds.length,
        remainingContributionCount: remainingContributions.length,
        ossDeletedCount: ossDeletion.deleted,
        ossMissingCount: ossDeletion.missing,
        ossDeleteFailedCount: ossDeletion.failed.length,
        remainingOssObjectCount: remainingOssObjects.length,
        failedOssObjects: ossDeletion.failed.slice(0, 20),
      },
      null,
      2,
    ),
  )

  if (ossDeletion.failed.length > 0 || remainingContributions.length > 0 || remainingOssObjects.length > 0) {
    process.exitCode = 1
  }
}

void main().catch((error) => {
  console.error('[clear_uploaded_training_corpus] failed:', error)
  process.exit(1)
})
