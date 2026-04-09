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

interface AudioTargetEntry {
  audio: string
  target: string
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
  const { datasetExportService } = require('../src/services/dataset-export.service') as typeof import('../src/services/dataset-export.service')
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

  const batchId = options.batchId || `audio_target_export_${new Date().toISOString().replace(/[:.]/g, '-')}`
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.resolve('/tmp', batchId)
  const audioDir = path.join(outputDir, 'audio')
  const manifestPath = path.join(outputDir, 'samples.jsonl')

  await fs.mkdir(audioDir, { recursive: true })

  const entries = await datasetExportService.buildExportManifest(batchId, {
    contributorId: userId || undefined,
    acceptedOnly: !options.includePending,
    limit: options.limit,
  })

  const ossClient = createOssClient()
  const rows: AudioTargetEntry[] = []

  for (const entry of entries) {
    const objectPath = entry.audio.path
    const localFilename = buildLocalAudioFilename(entry.recording_id, objectPath)
    const localAudioPath = path.join(audioDir, localFilename)

    await ossClient.get(objectPath, localAudioPath)

    rows.push({
      audio: path.posix.join('audio', localFilename),
      target: entry.transcript.target_text,
    })
  }

  const content = rows.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(manifestPath, content.length > 0 ? `${content}\n` : '', 'utf8')

  console.log(
    `[export_audio_target_dataset] batch=${batchId} count=${rows.length} acceptedOnly=${!options.includePending} outputDir=${outputDir}${userId ? ` user=${userId}` : ''}`,
  )
}

void main().catch((error) => {
  console.error('[export_audio_target_dataset] failed:', error)
  process.exit(1)
})
