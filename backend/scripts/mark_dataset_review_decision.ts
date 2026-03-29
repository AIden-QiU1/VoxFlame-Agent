import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  datasetReviewService,
  type DatasetEvaluationStatus,
  type DatasetReviewPriority,
  type DatasetReviewQueue,
} from '../src/services/dataset-review.service'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface ScriptOptions {
  contributionId?: string
  email?: string
  userId?: string
  acceptForExport?: boolean
  evaluationStatus?: DatasetEvaluationStatus
  reviewQueue?: DatasetReviewQueue
  reviewPriority?: DatasetReviewPriority
  reviewSummary?: string
  rejectionReason?: string
  reviewer?: string
  write: boolean
  help: boolean
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    write: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--write') {
      options.write = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg === '--contribution-id' && argv[index + 1]) {
      options.contributionId = argv[index + 1]
      index += 1
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

    if (arg === '--evaluation-status' && argv[index + 1]) {
      const value = argv[index + 1] as DatasetEvaluationStatus
      if (value === 'ready' || value === 'sampled_for_review' || value === 'retry_recommended') {
        options.evaluationStatus = value
      }
      index += 1
      continue
    }

    if (arg === '--review-queue' && argv[index + 1]) {
      const value = argv[index + 1] as DatasetReviewQueue
      if (value === 'auto_accept' || value === 'manual_review' || value === 'retry_recommended') {
        options.reviewQueue = value
      }
      index += 1
      continue
    }

    if (arg === '--review-priority' && argv[index + 1]) {
      const value = argv[index + 1] as DatasetReviewPriority
      if (value === 'low' || value === 'medium' || value === 'high') {
        options.reviewPriority = value
      }
      index += 1
      continue
    }

    if (arg === '--review-summary' && argv[index + 1]) {
      options.reviewSummary = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--rejection-reason' && argv[index + 1]) {
      options.rejectionReason = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--reviewer' && argv[index + 1]) {
      options.reviewer = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--accept-for-export') {
      options.acceptForExport = true
      continue
    }

    if (arg === '--reject-for-export') {
      options.acceptForExport = false
    }
  }

  return options
}

function printHelp(): void {
  console.log('Usage:')
  console.log('  npm run review:mark -- --contribution-id <id> --user-id <userId> [options]')
  console.log('')
  console.log('Options:')
  console.log('  --email <email>                  Resolve contributor by email')
  console.log('  --evaluation-status <status>     ready | sampled_for_review | retry_recommended')
  console.log('  --review-queue <queue>           auto_accept | manual_review | retry_recommended')
  console.log('  --review-priority <priority>     low | medium | high')
  console.log('  --review-summary <text>          Override review summary')
  console.log('  --accept-for-export              Mark sample accepted for export')
  console.log('  --reject-for-export              Mark sample rejected for export')
  console.log('  --rejection-reason <text>        Rejection reason for export stage')
  console.log('  --reviewer <name>                Reviewer marker, defaults to dataset_review_script')
  console.log('  --write                          Persist changes; default is dry-run only')
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
  if (options.help) {
    printHelp()
    return
  }
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失，无法更新 dataset review decision。')
  }

  if (!options.contributionId) {
    throw new Error('请提供 --contribution-id。')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  let contributorId = options.userId || null

  if (!contributorId && options.email) {
    contributorId = await resolveUserId(supabase, options.email)
    if (!contributorId) {
      throw new Error(`没有找到邮箱 ${options.email} 对应的用户。`)
    }
  }

  if (!contributorId) {
    throw new Error('请提供 --user-id 或 --email。')
  }

  const current = await datasetReviewService.getItem(options.contributionId, contributorId)
  if (!current) {
    throw new Error(`没有找到 contribution ${options.contributionId}。`)
  }

  const payload = {
    contributionId: options.contributionId,
    contributorId,
    evaluationStatus: options.evaluationStatus,
    reviewQueue: options.reviewQueue,
    reviewPriority: options.reviewPriority,
    reviewRequired:
      options.evaluationStatus === 'sampled_for_review'
        ? true
        : options.evaluationStatus === 'ready' || options.evaluationStatus === 'retry_recommended'
          ? false
          : undefined,
    reviewSummary: options.reviewSummary,
    acceptedForExport:
      typeof options.acceptForExport === 'boolean'
        ? options.acceptForExport
        : undefined,
    rejectionReason: options.rejectionReason,
    reviewer: options.reviewer || 'dataset_review_script',
  }

  console.log('[mark_dataset_review_decision] current=')
  console.log(JSON.stringify(current, null, 2))
  console.log('[mark_dataset_review_decision] payload=')
  console.log(JSON.stringify(payload, null, 2))

  if (!options.write) {
    console.log('[mark_dataset_review_decision] dry-run only. Re-run with --write to persist.')
    return
  }

  const updated = await datasetReviewService.updateDecision(payload)
  console.log('[mark_dataset_review_decision] updated=')
  console.log(JSON.stringify(updated, null, 2))
}

void main().catch((error) => {
  console.error('[mark_dataset_review_decision] failed:', error)
  process.exit(1)
})
