import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { datasetExportService } from '../src/services/dataset-export.service'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface ScriptOptions {
  email?: string
  userId?: string
  limit: number
  includePending: boolean
  output?: string
  batchId?: string
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

    if (arg === '--output' && argv[index + 1]) {
      options.output = argv[index + 1]
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
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失，无法导出 dataset manifest。')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  let userId = options.userId || null

  if (!userId && options.email) {
    userId = await resolveUserId(supabase, options.email)
    if (!userId) {
      throw new Error(`没有找到邮箱 ${options.email} 对应的用户。`)
    }
  }

  const batchId = options.batchId || `dataset_export_${new Date().toISOString().replace(/[:.]/g, '-')}`
  const entries = await datasetExportService.buildExportManifest(batchId, {
    contributorId: userId || undefined,
    acceptedOnly: !options.includePending,
    limit: options.limit,
  })

  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve('/tmp', `${batchId}.jsonl`)
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n')
  await fs.writeFile(outputPath, content.length > 0 ? `${content}\n` : '', 'utf8')

  console.log(
    `[export_dataset_manifest] batch=${batchId} count=${entries.length} acceptedOnly=${!options.includePending} output=${outputPath}${userId ? ` user=${userId}` : ''}`,
  )
}

void main().catch((error) => {
  console.error('[export_dataset_manifest] failed:', error)
  process.exit(1)
})
