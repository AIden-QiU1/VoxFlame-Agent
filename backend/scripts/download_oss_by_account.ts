import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import OSS from 'ali-oss'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface ScriptOptions {
  outputDir: string
  dryRun: boolean
  maxObjects?: number
  prefixes: string[]
  since?: Date
  sinceInput?: string
}

interface AccountInfo {
  id: string
  email: string | null
  label: string
}

interface ObjectDownloadRecord {
  accountKey: string
  accountLabel: string
  objectName: string
  localPath: string
  size: number
  lastModified: string
  skipped: boolean
}

interface AccountSummary {
  accountKey: string
  accountLabel: string
  outputDir: string
  objectCount: number
  byteCount: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    outputDir: path.resolve(__dirname, '../../artifacts/oss-by-account'),
    dryRun: false,
    prefixes: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--output-dir' && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--prefix' && argv[index + 1]) {
      options.prefixes.push(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--max-objects' && argv[index + 1]) {
      const parsed = Number(argv[index + 1])
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxObjects = parsed
      }
      index += 1
      continue
    }

    if (arg === '--since' && argv[index + 1]) {
      const parsed = new Date(argv[index + 1])
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`--since 不是有效时间: ${argv[index + 1]}`)
      }
      options.since = parsed
      options.sinceInput = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
    }
  }

  return options
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} 缺失，无法下载 OSS 数据。`)
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

function createSupabaseClient(): SupabaseClient {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim()

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY 缺失，无法解析账号标签。')
  }

  return createClient(requireEnv('SUPABASE_URL'), key)
}

function sanitizePathSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[<>:"\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')

  return normalized || 'unnamed'
}

function safeObjectRelativePath(objectName: string): string {
  const parts = objectName
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(sanitizePathSegment)

  return parts.length > 0 ? path.join(...parts) : 'unnamed-object'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

function shortKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'unknown'
}

function buildAccountLabel(accountKey: string, account: AccountInfo | undefined): string {
  if (account?.email) {
    const localPart = account.email.split('@')[0] || account.email
    return `${sanitizePathSegment(localPart)}__${shortKey(accountKey)}`
  }

  if (accountKey === 'unassigned') {
    return 'unassigned'
  }

  if (UUID_RE.test(accountKey)) {
    return `unknown_user__${shortKey(accountKey)}`
  }

  return `legacy__${sanitizePathSegment(accountKey)}`
}

function extractAccountKey(objectName: string, knownUserIds: Set<string>): string {
  const segments = objectName.split('/').filter((segment) => segment.length > 0)

  if (segments[0] === 'dataset' && segments[1]) {
    return segments[1]
  }

  if (segments[0] === 'supervised' && segments[1] === 'mandarin' && segments[3]) {
    return segments[3]
  }

  const knownUserId = segments.find((segment) => knownUserIds.has(segment))
  if (knownUserId) {
    return knownUserId
  }

  const uuidSegment = segments.find((segment) => UUID_RE.test(segment))
  if (uuidSegment) {
    return uuidSegment
  }

  return 'unassigned'
}

async function fetchAuthAccounts(supabase: SupabaseClient): Promise<Map<string, AccountInfo>> {
  const accounts = new Map<string, AccountInfo>()
  const perPage = 1000

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    for (const user of data.users) {
      accounts.set(user.id, {
        id: user.id,
        email: user.email ?? null,
        label: '',
      })
    }

    if (data.users.length < perPage) {
      break
    }
  }

  for (const [id, account] of accounts) {
    account.label = buildAccountLabel(id, account)
  }

  return accounts
}

async function listOssObjects(
  client: OSS,
  prefixes: string[],
  maxObjects: number | undefined,
): Promise<OSS.ObjectMeta[]> {
  const objects: OSS.ObjectMeta[] = []
  const activePrefixes = prefixes.length > 0 ? prefixes : ['']

  for (const prefix of activePrefixes) {
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

      if (maxObjects && objects.length >= maxObjects) {
        return objects.slice(0, maxObjects)
      }

      if (!result.isTruncated || !result.nextMarker) {
        break
      }

      marker = result.nextMarker
    }
  }

  return objects
}

function filterObjectsBySince(objects: OSS.ObjectMeta[], since: Date | undefined): OSS.ObjectMeta[] {
  if (!since) {
    return objects
  }

  const sinceMs = since.getTime()
  return objects.filter((object) => {
    const lastModifiedMs = new Date(object.lastModified).getTime()
    return Number.isFinite(lastModifiedMs) && lastModifiedMs > sinceMs
  })
}

async function fileSizeMatches(filePath: string, expectedSize: number): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath)
    return stats.size === expectedSize
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const client = createOssClient()
  const supabase = createSupabaseClient()
  const accountsById = await fetchAuthAccounts(supabase)
  const knownUserIds = new Set(accountsById.keys())
  const bucket = requireEnv('OSS_BUCKET')
  const region = process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou'

  await fs.mkdir(options.outputDir, { recursive: true })

  console.log(`[download_oss_by_account] listing bucket=${bucket} region=${region}`)
  const listedObjects = await listOssObjects(client, options.prefixes, options.maxObjects)
  const objects = filterObjectsBySince(listedObjects, options.since)

  const accountSummaries = new Map<string, AccountSummary>()
  const records: ObjectDownloadRecord[] = []

  for (const object of objects) {
    const accountKey = extractAccountKey(object.name, knownUserIds)
    const account = accountsById.get(accountKey)
    const accountLabel = account?.label || buildAccountLabel(accountKey, account)
    const accountDir = path.join(options.outputDir, accountLabel)
    const localPath = path.join(accountDir, safeObjectRelativePath(object.name))
    const summary = accountSummaries.get(accountKey) || {
      accountKey,
      accountLabel,
      outputDir: accountDir,
      objectCount: 0,
      byteCount: 0,
    }

    summary.objectCount += 1
    summary.byteCount += object.size
    accountSummaries.set(accountKey, summary)

    let skipped = false

    if (!options.dryRun) {
      await fs.mkdir(path.dirname(localPath), { recursive: true })
      skipped = await fileSizeMatches(localPath, object.size)

      if (!skipped) {
        await client.get(object.name, localPath)
      }
    }

    records.push({
      accountKey,
      accountLabel,
      objectName: object.name,
      localPath,
      size: object.size,
      lastModified: object.lastModified,
      skipped,
    })
  }

  const summaries = Array.from(accountSummaries.values())
    .sort((left, right) => left.accountLabel.localeCompare(right.accountLabel))

  const inventory = {
    generatedAt: new Date().toISOString(),
    bucket,
    region,
    outputDir: options.outputDir,
    dryRun: options.dryRun,
    prefixes: options.prefixes,
    since: options.since?.toISOString() ?? null,
    sinceInput: options.sinceInput ?? null,
    listedObjects: listedObjects.length,
    totalObjects: objects.length,
    totalBytes: objects.reduce((sum, object) => sum + object.size, 0),
    accounts: summaries,
  }

  if (!options.dryRun) {
    await writeJsonFile(path.join(options.outputDir, '_inventory.json'), inventory)
    await fs.writeFile(
      path.join(options.outputDir, '_objects.jsonl'),
      records.map((record) => JSON.stringify(record)).join('\n') + (records.length > 0 ? '\n' : ''),
      'utf8',
    )
  }

  console.log(`[download_oss_by_account] objects=${objects.length} listed=${listedObjects.length} bytes=${formatBytes(inventory.totalBytes)} outputDir=${options.outputDir} dryRun=${options.dryRun}`)

  for (const summary of summaries) {
    console.log(
      `[account] ${summary.accountLabel} objects=${summary.objectCount} bytes=${formatBytes(summary.byteCount)}`,
    )
  }
}

void main().catch((error) => {
  console.error('[download_oss_by_account] failed:', error)
  process.exit(1)
})
