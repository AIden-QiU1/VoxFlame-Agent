import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import type OSS from 'ali-oss'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface ScriptOptions {
  objectsJsonl: string
  write: boolean
}

interface ObjectRecord {
  objectName?: unknown
}

interface DeleteResult {
  deleted: number
  missing: number
  failed: Array<{ path: string; reason: string }>
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    objectsJsonl: path.resolve(__dirname, '../../artifacts/oss-by-account-after-20260524/_objects.jsonl'),
    write: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--objects-jsonl' && argv[index + 1]) {
      options.objectsJsonl = path.resolve(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--write') {
      options.write = true
    }
  }

  return options
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} 缺失，无法删除 OSS 对象。`)
  }
  return value
}

function createOssClient(): OSS {
  const OSSClient = require('ali-oss') as typeof import('ali-oss')
  return new OSSClient({
    region: process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou',
    accessKeyId: requireEnv('OSS_ACCESS_KEY_ID'),
    accessKeySecret: requireEnv('OSS_ACCESS_KEY_SECRET'),
    bucket: requireEnv('OSS_BUCKET'),
    secure: true,
  })
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

async function readObjectNames(objectsJsonl: string): Promise<string[]> {
  const content = await fs.readFile(objectsJsonl, 'utf8')
  const names = new Set<string>()

  for (const [lineIndex, line] of content.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    let parsed: ObjectRecord
    try {
      parsed = JSON.parse(trimmed) as ObjectRecord
    } catch (error) {
      throw new Error(`第 ${lineIndex + 1} 行不是有效 JSON: ${toErrorReason(error)}`)
    }

    if (typeof parsed.objectName !== 'string' || parsed.objectName.trim().length === 0) {
      throw new Error(`第 ${lineIndex + 1} 行缺少 objectName。`)
    }

    names.add(parsed.objectName.trim())
  }

  return Array.from(names).sort()
}

async function deleteOssObjects(client: OSS, objectNames: string[]): Promise<DeleteResult> {
  const result: DeleteResult = {
    deleted: 0,
    missing: 0,
    failed: [],
  }

  for (const objectName of objectNames) {
    try {
      await client.delete(objectName)
      result.deleted += 1
    } catch (error: unknown) {
      if (isOssNotFoundError(error)) {
        result.missing += 1
        continue
      }

      result.failed.push({
        path: objectName,
        reason: toErrorReason(error),
      })
    }
  }

  return result
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const objectNames = await readObjectNames(options.objectsJsonl)
  const bucket = process.env.OSS_BUCKET?.trim() || null
  const region = process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou'

  const summary = {
    mode: options.write ? 'write' : 'dry-run',
    objectsJsonl: options.objectsJsonl,
    bucket,
    region,
    objectCount: objectNames.length,
    sampleObjects: objectNames.slice(0, 10),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (!options.write) {
    return
  }

  const client = createOssClient()
  const deletion = await deleteOssObjects(client, objectNames)

  console.log(
    JSON.stringify(
      {
        mode: 'write-result',
        deletedCount: deletion.deleted,
        missingCount: deletion.missing,
        failedCount: deletion.failed.length,
        failedObjects: deletion.failed.slice(0, 20),
      },
      null,
      2,
    ),
  )

  if (deletion.failed.length > 0) {
    process.exitCode = 1
  }
}

void main().catch((error) => {
  console.error('[delete_oss_objects_from_manifest] failed:', error)
  process.exit(1)
})
