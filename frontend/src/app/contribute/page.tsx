'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Mic,
  PlayCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { MicrophoneInputFeedback } from '@/components/runtime/MicrophoneInputFeedback'
import { useAuth } from '@/hooks/useAuth'
import { useMandarinTrainingSession } from '@/hooks/useMandarinTrainingSession'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import { type UploadReceipt, useVoiceUpload } from '@/hooks/useVoiceUpload'
import { saveWorkspaceUserProfileMemory } from '@/lib/memory/workspace-client'
import {
  LEGAL_CONSENT_VERSION,
  hasRequiredLegalConsent,
} from '@/lib/auth/legal-consent'
import {
  MANDARIN_TRAINING_CATEGORIES,
  MANDARIN_TRAINING_CATEGORY_META,
  type MandarinTrainingExercise,
  getExercisesByCategory,
} from '@/lib/corpus/mandarin-training'
import { cn } from '@/lib/utils'
import type {
  VoxFlameConsentScope,
  VoxFlameRecordingEnvelope,
} from '@/lib/recording/recording-contract'
import {
  COLLECTION_PLANS,
  isCollectionPreflightReady,
  type CollectionPlanId,
} from '@/lib/recording/collection-protocol'
import {
  type MandarinTrainingFeedback,
  analyzeMandarinAttempt,
} from '@/lib/training/mandarin-feedback'
import {
  appendUploadedTrainingRecord,
  getUploadedTrainingExerciseIds,
  removeUploadedTrainingRecord,
} from '@/lib/training/training-profile'
import {
  buildPreparedExpressionPracticeExercises,
  type PreparedExpressionPracticeExercise,
} from '@/lib/training/prepared-expression-practice'
import {
  getTrainingTopicHref,
  getTrainingTopicIdForCategory,
  resolveTrainingTopicSelection,
  type TrainingTopicId,
} from '@/lib/training/training-topic-route'
import {
  assessTrainingSampleQuality,
  type TrainingSampleQuality,
} from '@/lib/training/training-sample-quality'
import {
  calculateCharacterEditDistance,
  summarizeAssessmentAttempts,
} from '@/lib/training/training-assessment'
import { buildSpeechPerformanceReport } from '@/lib/training/speech-performance-report'
import {
  DEFAULT_TRAINING_GUIDANCE_PROFILE,
  TRAINING_ETIOLOGY_OPTIONS,
  type TrainingEtiology,
  type TrainingSeverity,
} from '@/lib/training/training-guidance-profile'
import { buildTrainingSampleLineage } from '@/lib/training/training-sample-lineage'
import { selectTrainingExercises } from '@/lib/training/training-exercise-selection'
import {
  PHONOLOGY_GROUPS,
  filterExercisesByPhonologyGroup,
  getPhonologyExerciseTargets,
  getPhonologyFocusForGroup,
  getPhonologyGroupMeta,
  type PhonologyGroupId,
} from '@/lib/training/phonology-groups'
import type { WorkspaceMemorySnapshot } from '@/lib/memory/workspace-snapshot'

type AttemptUploadStatus =
  | 'idle'
  | 'saving'
  | 'uploaded'
  | 'retrying'
  | 'auth_required'
  | 'failed'
  | 'discarding'
  | 'discarded'

type AttemptSaveTrigger = 'auto' | 'manual'
type CollectionFlowStep = 'prepare' | 'record' | 'review'

type PracticeSourceMode = 'prepared_content' | 'sentence_corpus'
type PracticeExercise = MandarinTrainingExercise | PreparedExpressionPracticeExercise

interface TrainingUploadLabels {
  etiology?: TrainingEtiology
  severity?: TrainingSeverity
  ageBand?: string
  sex?: 'male' | 'female' | 'other' | 'unspecified'
}

const COLLECTION_AGE_BANDS = ['unspecified', '18–39', '40–59', '60–69', '70–79', '80+'] as const
const COLLECTION_SEX_OPTIONS = [
  { value: 'unspecified', label: '不愿说明' },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
  { value: 'other', label: '其他' },
] as const

interface PracticeAttempt {
  createdAt: number
  clientCaptureId: string
  exercise: PracticeExercise
  transcript: string
  transcriptLatencyMs: number
  feedback: MandarinTrainingFeedback
  sampleQuality: TrainingSampleQuality
  recording: VoxFlameRecordingEnvelope | null
  uploadStatus: AttemptUploadStatus
  uploadReceipt: UploadReceipt | null
}

interface NoticeState {
  tone: 'info' | 'success' | 'error'
  message: string
}

interface TrainingSummaryWindowView {
  summary: string
  sampleCount: number
  mismatchPairs: Array<{
    target: string
    heard: string
    occurrenceCount: number
  }>
  nextFocus: string[]
  stableWins: string[]
  pronunciationPatterns: string[]
  supportStrategies: string[]
  generatedAt: string
}

interface TrainingReportsView {
  dailySummary: TrainingSummaryWindowView | null
  weeklySummary: TrainingSummaryWindowView | null
}

type TrainingActivitySnapshot = WorkspaceMemorySnapshot['training_activity']

const DEFAULT_VISIBLE_SENTENCES = 60
const SEARCH_VISIBLE_SENTENCES = 80

const UPLOAD_STATUS_LABELS: Record<AttemptUploadStatus, string> = {
  idle: '这条录音还没进入保存流程',
  saving: '正在自动保存',
  uploaded: '已写入训练语料',
  retrying: '正在后台自动补登',
  auth_required: '需要重新登录恢复自动保存',
  failed: '保存失败',
  discarding: '正在撤回收录',
  discarded: '已不收录',
}

function dedupeStrings(values: Array<string | null | undefined>, limit?: number): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  values.forEach((value) => {
    if (typeof value !== 'string') {
      return
    }

    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    results.push(normalized)
  })

  return typeof limit === 'number' ? results.slice(0, limit) : results
}

function isPreparedExpressionExercise(
  exercise: PracticeExercise | null | undefined,
): exercise is PreparedExpressionPracticeExercise {
  return Boolean(
    exercise &&
    'practiceSource' in exercise &&
    exercise.practiceSource === 'prepared_expression',
  )
}

function getClarityScore(status: MandarinTrainingFeedback['status']): number {
  if (status === 'excellent') {
    return 0.95
  }

  if (status === 'close') {
    return 0.78
  }

  if (status === 'retry') {
    return 0.48
  }

  return 0.2
}

function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function usesGuidedCollectionFlow(isAssessmentTopic: boolean): boolean {
  return !isAssessmentTopic
}

function buildUploadMetadata(
  exercise: PracticeExercise,
  recording: VoxFlameRecordingEnvelope,
  transcript: string,
  feedback: MandarinTrainingFeedback,
  sampleQuality: TrainingSampleQuality,
  uploadLabels?: TrainingUploadLabels | null,
  collectionPlanId?: CollectionPlanId,
): Record<string, unknown> {
  const lineage = buildTrainingSampleLineage(exercise, recording)
  const metadata: Record<string, unknown> = {
    kind: 'training_result',
    // The model-facing labels stay deliberately small. These lineage fields
    // only support exact retry de-duplication and are not training features.
    sentence_id: exercise.id,
    exercise_id: exercise.id,
    exercise_category: exercise.category,
    target_text: exercise.text,
    spoken_text: transcript,
    feedback_status: feedback.status,
    clarity_score: getClarityScore(feedback.status),
    alignment_score: sampleQuality.score,
    missing_chars: feedback.missingChars,
    extra_chars: feedback.extraChars,
    speech_patterns: feedback.speechPatterns,
    articulation_tips: feedback.articulationTips,
    pronunciation_summary: feedback.pronunciationSummary,
    prompt_group_key: lineage.promptGroupKey,
    prompt_fingerprint: lineage.promptFingerprint,
    recording_dedupe_key: lineage.recordingDedupeKey,
    consent_version: LEGAL_CONSENT_VERSION,
    collection_plan_id: collectionPlanId,
  }

  if (uploadLabels?.etiology && uploadLabels.etiology !== DEFAULT_TRAINING_GUIDANCE_PROFILE.etiology) {
    metadata.etiology = uploadLabels.etiology
  }

  if (uploadLabels?.severity && uploadLabels.severity !== DEFAULT_TRAINING_GUIDANCE_PROFILE.severity) {
    metadata.severity = uploadLabels.severity
  }
  if (uploadLabels?.ageBand && uploadLabels.ageBand !== 'unspecified') {
    metadata.age_band = uploadLabels.ageBand
  }
  if (uploadLabels?.sex && uploadLabels.sex !== 'unspecified') {
    metadata.sex = uploadLabels.sex
  }

  for (const key of Object.keys(metadata)) {
    const value = metadata[key]
    if (Array.isArray(value) && value.length === 0) {
      delete metadata[key]
      continue
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      delete metadata[key]
    }
  }

  return metadata
}

function buildUploadedTrainingRecord(attempt: PracticeAttempt) {
  if (!attempt.recording) {
    return null
  }

  return {
    id: attempt.recording.recordingId,
    createdAt: new Date(attempt.recording.createdAt).getTime(),
    exerciseId: attempt.exercise.id,
    exerciseCategory: attempt.exercise.category,
    exerciseText: attempt.exercise.text,
    status: attempt.feedback.status,
    clarityScore: getClarityScore(attempt.feedback.status),
    durationSeconds: attempt.recording.audio.durationSeconds,
    focusTags: isPreparedExpressionExercise(attempt.exercise)
      ? [attempt.exercise.preparedExpressionSectionTitle, attempt.exercise.category]
      : [attempt.exercise.category],
    speechPatterns: attempt.feedback.speechPatterns,
    articulationTips: attempt.feedback.articulationTips,
    keywords: isPreparedExpressionExercise(attempt.exercise)
      ? attempt.exercise.preparedExpressionKeywords
      : undefined,
    pronunciationSummary: attempt.feedback.pronunciationSummary,
  }
}

function getRecorderStatusCopy(
  status: ReturnType<typeof useMandarinTrainingSession>['status'],
  sessionError: string | null,
  isAssessmentTopic: boolean = false,
): { label: string; description: string } {
  if (status === 'recording') {
    return {
      label: '正在录音',
      description: isAssessmentTopic
        ? '把当前词说完整，尾音稍微留半拍。'
        : '按正常节奏读完这句，然后点击停止。',
    }
  }

  if (status === 'processing') {
    return {
      label: '正在收结果',
      description: '正在整理这次录音。',
    }
  }

  if (status === 'ready') {
    return {
      label: '可以开始',
      description: isAssessmentTopic ? '点一次录音，读完当前词就停。' : '选好主题后，点一次录音就行。',
    }
  }

  if (status === 'connecting') {
    return {
      label: '正在连接',
      description: '正在准备麦克风。',
    }
  }

  if (status === 'error') {
    return {
      label: '需要处理',
      description: sessionError || '暂时无法开始，请重试。',
    }
  }

  return {
    label: '等待开始',
    description: isAssessmentTopic
      ? '准备好后直接从当前筛查词开始。'
      : '先选一个训练主题，系统会给出当前要练的句子。',
  }
}

function getAssessmentTranscriptNotice(
  transcript: string,
  hasRecording: boolean,
): {
  heardText: string
  helperText: string
  tone: 'sky' | 'amber'
} {
  if (transcript.trim()) {
    return {
      heardText: transcript,
      helperText: '识别完成，可以查看准确度。',
      tone: 'sky',
    }
  }

  if (hasRecording) {
    return {
      heardText: '录音已保存，但识别结果不完整。',
      helperText: '这不等于没录到声音。把词说慢一点，尾音留完整，再录一次更稳。',
      tone: 'amber',
    }
  }

  return {
    heardText: '这次还没有拿到可用录音。',
    helperText: '先确认浏览器麦克风权限，再重新录一遍。',
    tone: 'amber',
  }
}

function renderChips(
  items: string[],
  tone: 'stone' | 'amber' | 'sky' | 'emerald' = 'stone',
) {
  const toneClasses: Record<typeof tone, string> = {
    stone: 'bg-stone-100 text-stone-700',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-800',
    emerald: 'bg-emerald-100 text-emerald-800',
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-full px-3 py-1 text-xs font-medium ${toneClasses[tone]}`}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function renderYesterdayTopContributors(activity: TrainingActivitySnapshot | null | undefined) {
  const topContributors = activity?.yesterday.top_contributors ?? []

  if (!topContributors.length) {
    return (
      <p className="text-sm leading-6 text-gray-600">
        昨天还没有可展示的训练记录。
      </p>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {topContributors.map((item) => (
        <div
          key={item.rank}
          className="rounded-[18px] bg-white px-4 py-3 ring-1 ring-stone-200"
        >
          <p className="text-sm font-medium text-gray-900">第 {item.rank} 名</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{item.recording_count} 句</p>
        </div>
      ))}
    </div>
  )
}

function mapTrainingReports(
  reports: {
    daily_summary: {
      summary: string
      sampleCount?: number
      sample_count?: number
      mismatchPairs?: Array<{ target: string; heard: string; occurrenceCount: number }>
      mismatch_pairs?: Array<{ target: string; heard: string; occurrenceCount: number }>
      nextFocus?: string[]
      next_focus?: string[]
      stableWins?: string[]
      stable_wins?: string[]
      pronunciationPatterns?: string[]
      pronunciation_patterns?: string[]
      supportStrategies?: string[]
      support_strategies?: string[]
      generated_at: string
    } | null
    weekly_summary: {
      summary: string
      sampleCount?: number
      sample_count?: number
      mismatchPairs?: Array<{ target: string; heard: string; occurrenceCount: number }>
      mismatch_pairs?: Array<{ target: string; heard: string; occurrenceCount: number }>
      nextFocus?: string[]
      next_focus?: string[]
      stableWins?: string[]
      stable_wins?: string[]
      pronunciationPatterns?: string[]
      pronunciation_patterns?: string[]
      supportStrategies?: string[]
      support_strategies?: string[]
      generated_at: string
    } | null
  } | null | undefined,
): TrainingReportsView | null {
  if (!reports) {
    return null
  }

  const mapWindow = (
    windowSummary: {
      summary: string
      sampleCount?: number
      sample_count?: number
      mismatchPairs?: Array<{ target: string; heard: string; occurrenceCount: number }>
      mismatch_pairs?: Array<{ target: string; heard: string; occurrenceCount: number }>
      nextFocus?: string[]
      next_focus?: string[]
      stableWins?: string[]
      stable_wins?: string[]
      pronunciationPatterns?: string[]
      pronunciation_patterns?: string[]
      supportStrategies?: string[]
      support_strategies?: string[]
      generated_at: string
    } | null,
  ): TrainingSummaryWindowView | null => {
    if (!windowSummary) {
      return null
    }

    return {
      summary: windowSummary.summary,
      sampleCount: windowSummary.sampleCount ?? windowSummary.sample_count ?? 0,
      mismatchPairs: windowSummary.mismatchPairs ?? windowSummary.mismatch_pairs ?? [],
      nextFocus: windowSummary.nextFocus ?? windowSummary.next_focus ?? [],
      stableWins: windowSummary.stableWins ?? windowSummary.stable_wins ?? [],
      pronunciationPatterns:
        windowSummary.pronunciationPatterns ?? windowSummary.pronunciation_patterns ?? [],
      supportStrategies:
        windowSummary.supportStrategies ?? windowSummary.support_strategies ?? [],
      generatedAt: windowSummary.generated_at,
    }
  }

  return {
    dailySummary: mapWindow(reports.daily_summary),
    weeklySummary: mapWindow(reports.weekly_summary),
  }
}

export default function ContributePage() {
  const { user, userId, isLoading, isAuthenticated } = useAuth({
    redirectToLogin: true,
    nextPath: '/contribute',
  })
  const { snapshot: workspaceSnapshot } = useWorkspaceMemorySnapshot({
    userId,
    isAuthenticated,
  })

  const preparedExpression = workspaceSnapshot?.prepared_expression ?? null
  const preparedExpressionExercises = useMemo(
    () => buildPreparedExpressionPracticeExercises(preparedExpression),
    [preparedExpression],
  )
  const trainingReports = useMemo(
    () => mapTrainingReports(workspaceSnapshot?.prepared_expression?.training_reports),
    [workspaceSnapshot?.prepared_expression?.training_reports],
  )
  const trainingActivity = workspaceSnapshot?.training_activity ?? null
  const dailyPracticeSlogan = trainingActivity?.slogan ?? '每天先练 20 句'

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在准备训练页...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const collectionCategories = MANDARIN_TRAINING_CATEGORIES.filter(
    (category) => category !== '评估筛查',
  )
  const recommendedCategory = collectionCategories.find((category) => category === '日常与出行')
    ?? collectionCategories[0]
  const additionalCategories = collectionCategories.filter((category) => category !== recommendedCategory)

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href="/practice" className="inline-flex min-h-11 items-center text-sm font-medium text-amber-700 hover:text-amber-800">
              ← 返回练习选择
            </Link>
            <h1 className="text-balance text-2xl font-semibold text-gray-900">训练与数据录入</h1>
            <p className="mt-1 text-sm text-gray-600 text-pretty">
              选择一个主题，再进入只保留目标句、录音和反馈的专注工作台。
            </p>
          </div>
          <div className="hidden rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700 sm:block">
            当前账号：{user?.email || '已登录用户'}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8">
        <section id="training-topics" className="scroll-mt-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-orange-700">数据录入主题</p>
              <h2 className="mt-2 text-balance text-2xl font-semibold text-gray-900">选一个现在会用到的场景</h2>
              <p className="mt-2 max-w-3xl text-pretty text-sm leading-6 text-gray-600">
                进入后页面只保留当前句、录音和本次结果；录稳一条会自动切到下一句。
              </p>
            </div>
            <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              今天目标：{dailyPracticeSlogan}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recommendedCategory ? (() => {
              const meta = MANDARIN_TRAINING_CATEGORY_META[recommendedCategory]
              return (
                <Link
                  href={getTrainingTopicHref(getTrainingTopicIdForCategory(recommendedCategory))}
                  className="block rounded-[22px] border border-amber-300 bg-amber-50 px-5 py-5 text-left shadow-sm transition-colors duration-150 hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                      <p className="mt-2 text-pretty text-sm leading-6 text-gray-600">{meta.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">推荐</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-amber-900">从常用表达开始 →</p>
                </Link>
              )
            })() : null}

            {preparedExpression ? (
              <Link
                href={getTrainingTopicHref('custom-material')}
                className="block rounded-[22px] border border-stone-200 bg-white px-5 py-5 text-left transition-colors duration-150 hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">自定义训练</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {preparedExpression.title}
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                    {preparedExpressionExercises.length} 句
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-700">
                  直接围绕当前加载材料切句训练。
                </p>
              </Link>
            ) : (
              <Link
                href="/memory#memory-custom-material-editor"
                className="block rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-5 py-5 text-left transition-colors duration-150 hover:border-amber-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <p className="text-sm font-semibold text-gray-900">自定义训练</p>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  还没有当前加载材料。先去记忆页选一份材料，再回来练。
                </p>
              </Link>
            )}

          </div>

          <details className="mt-4 rounded-2xl border border-stone-200 bg-stone-50">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500">
              <span>查看更多录入主题</span>
              <span className="text-xs font-normal text-stone-500">{additionalCategories.length} 类</span>
            </summary>
            <div className="space-y-2 border-t border-stone-200 p-4">
              {additionalCategories.map((category) => {
                const meta = MANDARIN_TRAINING_CATEGORY_META[category]
                return (
                  <Link
                    key={category}
                    href={getTrainingTopicHref(getTrainingTopicIdForCategory(category))}
                    className="block rounded-2xl border border-stone-200 bg-white px-4 py-4 text-left transition-colors duration-150 hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                  >
                    <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                    <p className="mt-2 line-clamp-2 text-pretty text-sm leading-6 text-gray-600">{meta.description}</p>
                    <p className="mt-3 text-xs text-stone-500">{meta.corpusCount} 条 · {meta.shortLabel}</p>
                  </Link>
                )
              })}
            </div>
          </details>
        </section>

        <details className="rounded-2xl border border-stone-200 bg-white">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
            <span>训练回顾</span>
            <span className="text-xs font-normal text-stone-500">今日、7 天与匿名活动</span>
          </summary>
          <div className="space-y-4 border-t border-stone-200 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl bg-amber-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-amber-950">今日总结</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
                    {trainingReports?.dailySummary ? `${trainingReports.dailySummary.sampleCount} 条` : '待生成'}
                  </span>
                </div>
                <p className="mt-3 text-pretty text-sm leading-7 text-stone-700">
                  {trainingReports?.dailySummary?.summary ?? '今天还没有总结，先选一个主题录第一句。'}
                </p>
              </section>
              <section className="rounded-2xl bg-stone-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-stone-950">最近 7 天</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700">
                    {trainingReports?.weeklySummary ? `${trainingReports.weeklySummary.sampleCount} 条` : '待生成'}
                  </span>
                </div>
                <p className="mt-3 text-pretty text-sm leading-7 text-stone-700">
                  {trainingReports?.weeklySummary?.summary ?? '最近 7 天的稳定规律会在训练积累后自动更新。'}
                </p>
              </section>
            </div>
            <section className="rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-stone-950">昨日匿名活动</h3>
                  <p className="mt-1 text-pretty text-sm text-stone-600">只展示匿名名次和录音条数，不展示账号信息。</p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                  昨天共 {trainingActivity?.yesterday.total_recordings ?? 0} 句
                </span>
              </div>
              <div className="mt-4">{renderYesterdayTopContributors(trainingActivity)}</div>
            </section>
          </div>
        </details>
      </main>
    </div>
  )
}

export function TrainingRecorderPage({ topicId }: { topicId: TrainingTopicId }) {
  const topicSelection = useMemo(
    () => resolveTrainingTopicSelection(topicId),
    [topicId],
  )
  const returnHref = topicId === 'assessment-screening' ? '/practice' : '/contribute'
  const returnLabel = topicId === 'assessment-screening' ? '返回练习选择' : '返回主题选择'
  const { user, userId, session, isLoading, isAuthenticated } = useAuth({
    redirectToLogin: true,
    nextPath: getTrainingTopicHref(topicId),
  })
  const {
    status,
    interimText,
    error: sessionError,
    isRecording,
    isProcessing,
    analyser,
    startRecording,
    stopRecording,
    disconnect,
  } = useMandarinTrainingSession({
    userId: userId ?? undefined,
    accessToken: session?.access_token,
    shortUtteranceMode: topicSelection.category === '评估筛查',
  })
  const {
    uploadRecording,
    discardUploadedRecording,
    refreshLocalQueueCount,
    isUploading,
    localQueueItems,
  } = useVoiceUpload()
  const {
    snapshot: workspaceSnapshot,
    refresh: refreshWorkspaceSnapshot,
  } = useWorkspaceMemorySnapshot({
    userId,
    isAuthenticated,
  })

  const [selectedExerciseId, setSelectedExerciseId] = useState(
    '',
  )
  const [selectedPhonologyGroupId, setSelectedPhonologyGroupId] = useState<PhonologyGroupId>('all')
  const [exerciseQuery, setExerciseQuery] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sessionPracticedExerciseIds, setSessionPracticedExerciseIds] = useState<string[]>([])
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [assessmentAttemptsByExercise, setAssessmentAttemptsByExercise] = useState<
    Record<string, PracticeAttempt>
  >({})
  const [trainingEtiology, setTrainingEtiology] = useState<TrainingEtiology>('unknown')
  const [isSavingTrainingLabels, setIsSavingTrainingLabels] = useState(false)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [isPreparedPreviewOpen, setIsPreparedPreviewOpen] = useState(false)
  const [attemptPlaybackUrl, setAttemptPlaybackUrl] = useState<string | null>(null)
  const [collectionPlanId, setCollectionPlanId] = useState<CollectionPlanId>('baseline')
  const [environmentReady, setEnvironmentReady] = useState(false)
  const [distanceReady, setDistanceReady] = useState(false)
  const [ageBand, setAgeBand] = useState<string>('unspecified')
  const [sex, setSex] = useState<TrainingUploadLabels['sex']>('unspecified')
  const [collectionFlowStep, setCollectionFlowStep] = useState<CollectionFlowStep>('prepare')

  const disconnectRef = useRef(disconnect)
  disconnectRef.current = disconnect
  const discardedAttemptIdsRef = useRef<Set<number>>(new Set())
  const recordingExerciseRef = useRef<PracticeExercise | null>(null)

  const canSaveTrainingSample = hasRequiredLegalConsent(user)
  const collectionPreflightReady = isCollectionPreflightReady({
    environmentReady,
    distanceReady,
    understandsConsent: canSaveTrainingSample,
  })
  const preparedExpression = workspaceSnapshot?.prepared_expression ?? null
  const preparedExpressionExercises = useMemo(
    () => buildPreparedExpressionPracticeExercises(preparedExpression),
    [preparedExpression],
  )
  const hasPreparedContent = preparedExpressionExercises.length > 0
  const preparedExpressionTrainingCount = preparedExpression?.rehearsal_count ?? 0
  const preparedExpressionDocument = preparedExpression?.document_content.trim() ?? ''
  const preparedExpressionPreview = useMemo(() => {
    if (preparedExpression?.summary?.trim()) {
      return preparedExpression.summary.trim()
    }

    if (!preparedExpressionDocument) {
      return '当前还没有同步到记忆区的参考材料。先去记忆区保存一份材料，再回来切句训练。'
    }

    return preparedExpressionDocument.length > 140
      ? `${preparedExpressionDocument.slice(0, 140)}…`
      : preparedExpressionDocument
  }, [preparedExpression?.summary, preparedExpressionDocument])
  const selectedCategory = topicSelection.category ?? MANDARIN_TRAINING_CATEGORIES[0]
  const practiceMode: PracticeSourceMode = topicSelection.practiceMode
  const isAssessmentTopic =
    practiceMode === 'sentence_corpus' && selectedCategory === '评估筛查'
  const isPhonologyTopic =
    practiceMode === 'sentence_corpus' && selectedCategory === '音系强化'

  const baseCategoryExercises = useMemo(
    () => (
      practiceMode === 'prepared_content'
        ? preparedExpressionExercises
        : getExercisesByCategory(selectedCategory)
    ),
    [practiceMode, preparedExpressionExercises, selectedCategory],
  )
  const categoryExercises = useMemo(
    () => (
      isPhonologyTopic
        ? filterExercisesByPhonologyGroup(
            baseCategoryExercises as MandarinTrainingExercise[],
            selectedPhonologyGroupId,
          )
        : baseCategoryExercises
    ),
    [baseCategoryExercises, isPhonologyTopic, selectedPhonologyGroupId],
  )
  const phonologyGroupOptions = useMemo(
    () => (
      isPhonologyTopic
        ? PHONOLOGY_GROUPS.map((group) => ({
            ...group,
            count: filterExercisesByPhonologyGroup(
              baseCategoryExercises as MandarinTrainingExercise[],
              group.id,
            ).length,
          }))
        : []
    ),
    [baseCategoryExercises, isPhonologyTopic],
  )
  const activePhonologyGroup = getPhonologyGroupMeta(selectedPhonologyGroupId)

  const recordedExerciseIds = useMemo(() => {
    const persistedExerciseIds = userId ? getUploadedTrainingExerciseIds(userId) : []
    const queuedExerciseIds = localQueueItems
      .map((item) => (typeof item.sentenceId === 'string' ? item.sentenceId.trim() : ''))
      .filter((item) => item.length > 0)

    return [...persistedExerciseIds, ...queuedExerciseIds]
  }, [localQueueItems, userId])

  const selectableExerciseState = useMemo(
    () => selectTrainingExercises({
      exercises: categoryExercises,
      recordedExerciseIds,
      sessionExerciseIds: sessionPracticedExerciseIds,
    }),
    [categoryExercises, recordedExerciseIds, sessionPracticedExerciseIds],
  )

  const normalizedQuery = exerciseQuery.trim().toLowerCase()
  const matchingExercises = useMemo(() => {
    if (!normalizedQuery) {
      return selectableExerciseState.exercises
    }

    return selectableExerciseState.exercises.filter((exercise) => (
      exercise.text.toLowerCase().includes(normalizedQuery)
    ))
  }, [normalizedQuery, selectableExerciseState.exercises])

  const visibleExercises = useMemo(
    () => matchingExercises.slice(0, normalizedQuery ? SEARCH_VISIBLE_SENTENCES : DEFAULT_VISIBLE_SENTENCES),
    [matchingExercises, normalizedQuery],
  )

  const currentExercise = useMemo(
    () => (
      selectableExerciseState.exercises.find((exercise) => exercise.id === selectedExerciseId) ??
      visibleExercises[0] ??
      selectableExerciseState.exercises[0] ??
      categoryExercises.find((exercise) => exercise.id === selectedExerciseId) ??
      categoryExercises[0] ??
      null
    ),
    [categoryExercises, selectableExerciseState.exercises, selectedExerciseId, visibleExercises],
  )

  const currentPreparedAnchorLine = useMemo(
    () => (
      isPreparedExpressionExercise(currentExercise)
        ? currentExercise.preparedExpressionAnchorLine
        : null
    ),
    [currentExercise],
  )
  const currentPhonologyTarget = useMemo(() => {
    if (!isPhonologyTopic || !currentExercise) {
      return null
    }

    const targets = getPhonologyExerciseTargets(currentExercise.id)
    return selectedPhonologyGroupId === 'all'
      ? targets[0] ?? null
      : targets.find((target) => target.id === selectedPhonologyGroupId) ?? null
  }, [currentExercise, isPhonologyTopic, selectedPhonologyGroupId])
  const currentPhonologyTargetMeta = currentPhonologyTarget
    ? getPhonologyGroupMeta(currentPhonologyTarget.id)
    : null

  const currentExerciseTags = useMemo(
    () => dedupeStrings(
      isPreparedExpressionExercise(currentExercise)
        ? [
            currentExercise.preparedExpressionSectionTitle,
            ...currentExercise.preparedExpressionKeywords,
            ...currentExercise.preparedExpressionHighRiskPhrases,
          ]
        : isAssessmentTopic
          ? [currentExercise?.category ?? null, '筛查词表']
          : isPhonologyTopic && currentExercise
            ? [
                currentPhonologyTargetMeta?.label ?? activePhonologyGroup.label,
                currentPhonologyTarget?.focus ?? getPhonologyFocusForGroup(currentExercise.id, selectedPhonologyGroupId),
              ]
            : [currentExercise?.category ?? null],
      8,
    ),
    [activePhonologyGroup.label, currentExercise, currentPhonologyTarget?.focus, currentPhonologyTargetMeta?.label, isAssessmentTopic, isPhonologyTopic, selectedPhonologyGroupId],
  )

  const trainingReports = useMemo(
    () => mapTrainingReports(workspaceSnapshot?.prepared_expression?.training_reports),
    [workspaceSnapshot?.prepared_expression?.training_reports],
  )
  const trainingActivity = workspaceSnapshot?.training_activity ?? null
  const dailyPracticeSlogan = trainingActivity?.slogan ?? '每天先练 20 句'
  const assessmentSummary = useMemo(
    () => (
      isAssessmentTopic
        ? summarizeAssessmentAttempts(
            Object.values(assessmentAttemptsByExercise).map((savedAttempt) => ({
              exerciseId: savedAttempt.exercise.id,
              targetText: savedAttempt.exercise.text,
              heardText: savedAttempt.transcript,
              normalizedTarget: savedAttempt.feedback.normalizedTarget,
              normalizedHeard: savedAttempt.feedback.normalizedHeard,
            })),
            categoryExercises.length,
          )
        : null
    ),
    [assessmentAttemptsByExercise, categoryExercises.length, isAssessmentTopic],
  )
  const speechPerformanceReport = useMemo(
    () => (
      isAssessmentTopic
        ? buildSpeechPerformanceReport(
            Object.values(assessmentAttemptsByExercise).map((savedAttempt) => ({
              exerciseId: savedAttempt.exercise.id,
              targetText: savedAttempt.exercise.text,
              heardText: savedAttempt.transcript,
              normalizedTarget: savedAttempt.feedback.normalizedTarget,
              normalizedHeard: savedAttempt.feedback.normalizedHeard,
              missingChars: savedAttempt.feedback.missingChars,
              extraChars: savedAttempt.feedback.extraChars,
              durationMs: savedAttempt.recording?.audio.durationMs,
              speechDurationMs: savedAttempt.recording?.audio.quality?.speechDurationMs,
              silenceRatio: savedAttempt.recording?.audio.quality?.silenceRatio,
              inputLevelRms: savedAttempt.recording?.audio.quality?.inputLevelRms,
              inputLevelPeak: savedAttempt.recording?.audio.quality?.inputLevelPeak,
              qualityDisposition: savedAttempt.recording?.audio.quality?.disposition,
            })),
          )
        : null
    ),
    [assessmentAttemptsByExercise, isAssessmentTopic],
  )
  const trainingUploadLabels = useMemo<TrainingUploadLabels>(() => {
    return {
      etiology: trainingEtiology,
      severity: isAssessmentTopic
        ? undefined
        : workspaceSnapshot?.user_profile_memory?.severity as TrainingSeverity | undefined,
      ageBand,
      sex,
    }
  }, [ageBand, isAssessmentTopic, sex, trainingEtiology, workspaceSnapshot?.user_profile_memory?.severity])
  const recorderStatus = getRecorderStatusCopy(status, sessionError, isAssessmentTopic)
  const currentAttemptCharacterAccuracy = useMemo(() => {
    if (!attempt || !isAssessmentTopic || attempt.feedback.normalizedTarget.length === 0) {
      return null
    }

    return Math.max(
      0,
      (attempt.feedback.normalizedTarget.length - calculateCharacterEditDistance(
        attempt.feedback.normalizedTarget,
        attempt.feedback.normalizedHeard,
      ))
      / attempt.feedback.normalizedTarget.length,
    )
  }, [attempt, isAssessmentTopic])
  const assessmentTranscriptNotice = useMemo(
    () => (
      isAssessmentTopic && attempt
        ? getAssessmentTranscriptNotice(attempt.transcript, Boolean(attempt.recording))
        : null
    ),
    [attempt, isAssessmentTopic],
  )

  const exerciseSelectionHint = useMemo(() => {
    if (isAssessmentTopic) {
      return '固定 20 条筛查词，按顺序录就行。'
    }

    if (selectableExerciseState.stage === 'unrecorded') {
      return `当前优先展示还没录过的句子，还剩 ${selectableExerciseState.unrecordedCount} 句。`
    }

    if (selectableExerciseState.stage === 'unrepeated') {
      return '这一组之前都录过了，当前先避开这轮已经练过的句子。'
    }

    return '这一组这轮都练过了，现在允许回看前面的句子继续复练。'
  }, [isAssessmentTopic, selectableExerciseState])

  const currentGoalHeadline = useMemo(() => {
    if (isAssessmentTopic && assessmentSummary) {
      return assessmentSummary.completedCount > 0
        ? `当前训练支持：${assessmentSummary.severityLabel}`
        : '先把 20 条筛查词录完一遍'
    }

    if (trainingReports?.dailySummary?.nextFocus[0]) {
      return `这一轮先盯住“${trainingReports.dailySummary.nextFocus[0]}”`
    }

    return dailyPracticeSlogan
  }, [assessmentSummary, dailyPracticeSlogan, isAssessmentTopic, trainingReports])

  const currentGoalSupport = useMemo(() => {
    if (isAssessmentTopic && assessmentSummary) {
      return assessmentSummary.severitySummary
    }

    if (attempt?.sampleQuality.summary) {
      return attempt.sampleQuality.summary
    }

    if (trainingReports?.weeklySummary?.summary) {
      return trainingReports.weeklySummary.summary
    }

    return '这里只保留最少反馈：准备状态、当前目标和这一句是否建议马上重录。'
  }, [assessmentSummary, attempt?.sampleQuality.summary, isAssessmentTopic, trainingReports])

  const currentProgressStats = useMemo(() => {
    if (isAssessmentTopic) {
      return [
        {
          label: '已测词条',
          value: assessmentSummary
            ? `${assessmentSummary.completedCount}/${assessmentSummary.totalExerciseCount}`
            : `0/${categoryExercises.length}`,
          detail: '先整组录完。',
        },
        {
          label: '当前字准率',
          value: assessmentSummary ? formatPercent(assessmentSummary.accuracyRatio) : '--',
          detail: '按正确字数算。',
        },
        {
          label: '训练支持',
          value: assessmentSummary?.severityLabel ?? '待开始',
          detail: '训练分层用。',
        },
      ]
    }

    return [
      {
        label: '本轮已练',
        value: `${sessionPracticedExerciseIds.length} 句`,
        detail: '只算这一轮已经真正录过的句子。',
      },
      {
        label: '待补登',
        value: `${localQueueItems.length} 条`,
        detail: localQueueItems.length > 0 ? '这些录音会在后台自动补登。' : '当前没有待补登录音。',
      },
      {
        label: '可练句数',
        value: practiceMode === 'prepared_content'
          ? `${preparedExpressionExercises.length} 句`
          : `${matchingExercises.length} 句`,
        detail: practiceMode === 'prepared_content' ? '从当前准备内容里提取。' : '来自当前通用句库筛选结果。',
      },
    ]
  }, [
    assessmentSummary,
    categoryExercises.length,
    isAssessmentTopic,
    localQueueItems.length,
    matchingExercises.length,
    practiceMode,
    preparedExpressionExercises.length,
    sessionPracticedExerciseIds.length,
  ])

  useEffect(() => {
    if (!userId) {
      return
    }

    setSessionPracticedExerciseIds([])
    setAssessmentAttemptsByExercise({})
    setSelectedPhonologyGroupId('all')
    setAttempt(null)
    setCollectionFlowStep('prepare')
    void refreshLocalQueueCount()
  }, [refreshLocalQueueCount, topicId, userId])

  useEffect(() => {
    const etiology = workspaceSnapshot?.user_profile_memory?.etiology
    setTrainingEtiology(
      TRAINING_ETIOLOGY_OPTIONS.some((option) => option.value === etiology)
        ? (etiology as TrainingEtiology)
        : 'unknown',
    )
  }, [workspaceSnapshot?.user_profile_memory?.etiology])

  useEffect(() => {
    return () => {
      disconnectRef.current()
    }
  }, [])

  useEffect(() => {
    if (!visibleExercises.length) {
      return
    }

    const stillVisible = visibleExercises.some((exercise) => exercise.id === selectedExerciseId)
    if (!stillVisible) {
      setSelectedExerciseId(visibleExercises[0].id)
    }
  }, [selectedExerciseId, visibleExercises])

  useEffect(() => {
    if (!isRecording) {
      return
    }

    setRecordingSeconds(0)
    const timer = window.setInterval(() => {
      setRecordingSeconds((current) => current + 1)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isRecording])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(() => {
      setNotice(null)
    }, 4000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    const blob = attempt?.recording?.audio.blob
    if (!blob) {
      setAttemptPlaybackUrl(null)
      return
    }

    const playbackUrl = URL.createObjectURL(blob)
    setAttemptPlaybackUrl(playbackUrl)

    return () => {
      URL.revokeObjectURL(playbackUrl)
    }
  }, [attempt?.recording?.audio.blob])

  const moveExercise = useCallback((offset: number) => {
    if (isRecording || isProcessing || !visibleExercises.length || !currentExercise) {
      return
    }

    const currentIndex = visibleExercises.findIndex((exercise) => exercise.id === currentExercise.id)
    if (currentIndex < 0) {
      return
    }

    const nextIndex = (currentIndex + offset + visibleExercises.length) % visibleExercises.length
    setSelectedExerciseId(visibleExercises[nextIndex].id)
    setAttempt(null)
  }, [currentExercise, isProcessing, isRecording, visibleExercises])

  const handleSelectExercise = useCallback((exerciseId: string) => {
    if (isRecording || isProcessing) {
      return
    }
    setSelectedExerciseId(exerciseId)
    setAttempt(null)
  }, [isProcessing, isRecording])

  const handleSelectPhonologyGroup = useCallback((groupId: PhonologyGroupId) => {
    if (isRecording || isProcessing || groupId === selectedPhonologyGroupId) {
      return
    }

    setSelectedPhonologyGroupId(groupId)
    setSelectedExerciseId('')
    setExerciseQuery('')
    setAttempt(null)
  }, [isProcessing, isRecording, selectedPhonologyGroupId])

  const handleStartRecording = useCallback(async () => {
    if (!currentExercise || isUploading || isProcessing) {
      return
    }

    if (!collectionPreflightReady) {
      setNotice({
        tone: 'info',
        message: '先完成采集前确认：环境、距离和数据授权。',
      })
      return
    }

    setAttempt(null)
    setNotice(null)
    setCollectionFlowStep('record')
    recordingExerciseRef.current = currentExercise

    try {
      await startRecording()
    } catch (error) {
      recordingExerciseRef.current = null
      console.error('[contribute] start recording failed:', error)
      setNotice({
        tone: 'error',
        message: '录音失败，请重试。',
      })
    }
  }, [collectionPreflightReady, currentExercise, isProcessing, isUploading, startRecording])

  const handleRetryCurrentExercise = useCallback(async () => {
    if (isRecording || isProcessing || isUploading) {
      return
    }

    const exerciseToRetry = attempt?.exercise ?? currentExercise
    if (!exerciseToRetry) {
      return
    }

    if (!collectionPreflightReady) {
      setCollectionFlowStep('prepare')
      setNotice({
        tone: 'info',
        message: '先完成采集前确认：环境、距离和数据授权。',
      })
      return
    }

    setSelectedExerciseId(exerciseToRetry.id)
    setAttempt(null)
    setNotice(null)
    setCollectionFlowStep('record')
    recordingExerciseRef.current = exerciseToRetry

    try {
      await startRecording()
    } catch (error) {
      recordingExerciseRef.current = null
      console.error('[contribute] retry recording failed:', error)
      setNotice({
        tone: 'error',
        message: '录音失败，请重试。',
      })
    }
  }, [
    attempt?.exercise,
    collectionPreflightReady,
    currentExercise,
    isProcessing,
    isRecording,
    isUploading,
    startRecording,
  ])

  const handleContinueAfterAttempt = useCallback(() => {
    setAttempt(null)
    setNotice(null)
    setCollectionFlowStep('record')
  }, [])

  const handleSaveTrainingLabels = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      setNotice({
        tone: 'error',
        message: '先登录后才能保存训练资料标签。',
      })
      return
    }

    if (trainingEtiology === 'unknown') {
      setNotice({
        tone: 'error',
        message: '请先选择一个疾病种类，再保存训练资料标签。',
      })
      return
    }

    setIsSavingTrainingLabels(true)

    try {
      await saveWorkspaceUserProfileMemory(userId, {
        document: workspaceSnapshot?.user_profile_memory.document ?? undefined,
        etiology: trainingEtiology,
      })
      await refreshWorkspaceSnapshot()
      setNotice({
        tone: 'success',
        message: '病因信息已保存。系统听清率和训练支持建议不会写成医学严重程度。',
      })
    } catch (error) {
      console.error('[contribute] save training labels failed:', error)
      setNotice({
        tone: 'error',
        message: '训练资料标签保存失败了，请稍后再试。',
      })
    } finally {
      setIsSavingTrainingLabels(false)
    }
  }, [
    isAuthenticated,
    refreshWorkspaceSnapshot,
    trainingEtiology,
    userId,
    workspaceSnapshot?.user_profile_memory.document,
  ])

  const persistTrainingAttempt = useCallback(async (
    attemptToPersist: PracticeAttempt,
    _saveTrigger: AttemptSaveTrigger,
  ) => {
    if (!attemptToPersist.recording) {
      setNotice({
        tone: 'error',
        message: '这次录音还没有完整音频文件，暂时无法保存。',
      })
      return
    }

    if (!canSaveTrainingSample) {
      setAttempt((current) => {
        if (!current || current.createdAt !== attemptToPersist.createdAt) {
          return current
        }

        return {
          ...current,
          uploadStatus: 'auth_required',
        }
      })
      setNotice({
        tone: 'error',
        message: '当前账号还没有新的授权确认记录，请重新登录一次后再保存训练样本。',
      })
      return
    }

    setAttempt((current) => {
      if (!current || current.createdAt !== attemptToPersist.createdAt) {
        return current
      }

      return {
        ...current,
        uploadStatus: 'saving',
      }
    })

    const consentScope: VoxFlameConsentScope = 'training_only'
    const result = await uploadRecording(attemptToPersist.recording.audio.blob, {
      text: attemptToPersist.exercise.text,
      recognizedText: attemptToPersist.transcript,
      source: 'guided_recording',
      sentenceId: attemptToPersist.exercise.id,
      recording: attemptToPersist.recording,
      consentScope,
      metadata: buildUploadMetadata(
        attemptToPersist.exercise,
        attemptToPersist.recording,
        attemptToPersist.transcript,
        attemptToPersist.feedback,
        attemptToPersist.sampleQuality,
        trainingUploadLabels,
        collectionPlanId,
      ),
    })
    const wasDiscarded = discardedAttemptIdsRef.current.has(attemptToPersist.createdAt)

    if (wasDiscarded) {
      await discardUploadedRecording({
        recordingId: attemptToPersist.recording.recordingId,
        contributionId: result.receipt?.contributionId ?? null,
        storagePath: result.receipt?.storagePath ?? null,
      })
      setAttempt((current) => {
        if (!current || current.createdAt !== attemptToPersist.createdAt) {
          return current
        }

        return {
          ...current,
          uploadStatus: 'discarded',
          uploadReceipt: null,
        }
      })
      setNotice({
        tone: 'success',
        message: '已撤回，这条不会进入训练语料。',
      })
      return
    }

    setAttempt((current) => {
      if (!current || current.createdAt !== attemptToPersist.createdAt) {
        return current
      }

      return {
        ...current,
        uploadStatus: result.status,
        uploadReceipt: result.receipt ?? null,
      }
    })

    if (result.status === 'uploaded' && userId) {
      const uploadedRecord = buildUploadedTrainingRecord(attemptToPersist)
      if (uploadedRecord) {
        appendUploadedTrainingRecord(userId, uploadedRecord)
      }

      setNotice({
        tone: 'success',
        message: '这条录音已经进入训练语料，只保留标签和系统听到的结果。',
      })
      return
    }

    if (result.status === 'retrying') {
      setNotice({
        tone: 'info',
        message: '录音已保存，稍后会自动同步。',
      })
      return
    }

    if (result.status === 'auth_required') {
      setNotice({
        tone: 'error',
        message: result.errorMessage || '登录状态已失效，请重新登录后再保存。',
      })
      return
    }

    setNotice({
      tone: 'error',
      message: result.errorMessage || '保存训练样本失败，请稍后重试。',
    })
  }, [
    canSaveTrainingSample,
    collectionPlanId,
    discardUploadedRecording,
    trainingUploadLabels,
    uploadRecording,
    userId,
  ])

  const handleDiscardAttempt = useCallback(async () => {
    if (!attempt?.recording) {
      setAttempt(null)
      setNotice({
        tone: 'success',
        message: '已忽略这次结果。',
      })
      return
    }

    discardedAttemptIdsRef.current.add(attempt.createdAt)
    setSessionPracticedExerciseIds((currentIds) => (
      currentIds.filter((exerciseId) => exerciseId !== attempt.exercise.id)
    ))
    if (isAssessmentTopic) {
      setAssessmentAttemptsByExercise((current) => {
        const next = { ...current }
        delete next[attempt.exercise.id]
        return next
      })
    }

    setAttempt((current) => (
      current?.createdAt === attempt.createdAt
        ? {
            ...current,
            uploadStatus: current.uploadStatus === 'saving' ? 'discarding' : current.uploadStatus,
          }
        : current
    ))

    if (attempt.uploadStatus === 'saving') {
      setNotice({
        tone: 'info',
        message: '已标记不收录；如果上传已经开始，完成后会自动撤回。',
      })
      return
    }

    const result = await discardUploadedRecording({
      recordingId: attempt.recording.recordingId,
      contributionId: attempt.uploadReceipt?.contributionId ?? null,
      storagePath: attempt.uploadReceipt?.storagePath ?? null,
    })

    if (result.ok) {
      if (userId) {
        removeUploadedTrainingRecord(userId, attempt.recording.recordingId)
      }
      setAttempt((current) => (
        current?.createdAt === attempt.createdAt
          ? {
              ...current,
              uploadStatus: 'discarded',
              uploadReceipt: null,
            }
          : current
      ))
      setNotice({
        tone: 'success',
        message: '已撤回，这条不会进入训练语料。',
      })
      return
    }

    setAttempt((current) => (
      current?.createdAt === attempt.createdAt
        ? {
            ...current,
            uploadStatus: attempt.uploadStatus,
          }
        : current
    ))
    setNotice({
      tone: 'error',
      message: result.errorMessage || '撤回失败，请稍后再试。',
    })
  }, [attempt, discardUploadedRecording, isAssessmentTopic, userId])

  const handleStopRecording = useCallback(async () => {
    const recordedExercise = recordingExerciseRef.current
    if (!recordedExercise) {
      setNotice({
        tone: 'error',
        message: '这次录音缺少开始时的题目标识，系统已阻止评分和上传，请重新录制。',
      })
      return
    }

    try {
      const result = await stopRecording()
      const transcript = result.transcript.trim()
      const feedback = analyzeMandarinAttempt(recordedExercise, transcript)
      const sampleQuality = assessTrainingSampleQuality({
        feedback,
        recording: result.recording,
        transcriptLatencyMs: result.transcriptLatencyMs,
      })
      const nextAttempt: PracticeAttempt = {
        createdAt: Date.now(),
        clientCaptureId: result.clientCaptureId,
        exercise: recordedExercise,
        transcript,
        transcriptLatencyMs: result.transcriptLatencyMs,
        feedback,
        sampleQuality,
        recording: result.recording,
        uploadStatus: result.recording
          ? canSaveTrainingSample
            ? 'saving'
            : 'auth_required'
          : 'idle',
        uploadReceipt: null,
      }
      const hasUsableAssessmentTranscript = !(isAssessmentTopic && transcript.length === 0)

      if (hasUsableAssessmentTranscript) {
        setSessionPracticedExerciseIds((currentIds) => (
          currentIds.includes(recordedExercise.id)
            ? currentIds
            : [...currentIds, recordedExercise.id]
        ))
      }
      setAttempt(nextAttempt)
      if (!isAssessmentTopic) {
        setCollectionFlowStep(result.recording ? 'review' : 'record')
      }
      if (isAssessmentTopic && hasUsableAssessmentTranscript) {
        setAssessmentAttemptsByExercise((current) => ({
          ...current,
          [recordedExercise.id]: nextAttempt,
        }))
      }
      const currentIndex = visibleExercises.findIndex((exercise) => exercise.id === recordedExercise.id)
      const shouldAutoAdvance = isAssessmentTopic
        ? hasUsableAssessmentTranscript && visibleExercises.length > 1 && currentIndex >= 0
        : (
            sampleQuality.action !== 'retry'
            && visibleExercises.length > 1
            && currentIndex >= 0
          )
      const nextExercise = shouldAutoAdvance
        ? visibleExercises[(currentIndex + 1) % visibleExercises.length]
        : null

      if (nextExercise && nextExercise.id !== recordedExercise.id) {
        setSelectedExerciseId(nextExercise.id)
      }

      setNotice({
        tone: !result.recording || (isAssessmentTopic && !hasUsableAssessmentTranscript)
          ? 'error'
          : canSaveTrainingSample && result.recording
            ? 'info'
            : 'success',
        message: !result.recording
          ? '这次没有生成完整录音文件，请重新录一次。'
          : isAssessmentTopic && !hasUsableAssessmentTranscript
          ? '识别结果不完整，请放慢一点再录一次。'
          : canSaveTrainingSample && result.recording
          ? nextExercise
            ? '录音已经收下，正在自动保存这条样本，并且已经切到下一句。'
            : '录音已经收下，正在自动保存这条样本。'
          : nextExercise
            ? '录音已经收下，已经切到下一句继续练。'
            : '录音已经收下，可以直接看系统听到的结果。',
      })

      if (nextAttempt.recording && canSaveTrainingSample && hasUsableAssessmentTranscript) {
        void persistTrainingAttempt(nextAttempt, 'auto')
      }
    } catch (error) {
      console.error('[contribute] stop recording failed:', error)
      setNotice({
        tone: 'error',
        message: '录音失败，请重试。',
      })
    } finally {
      recordingExerciseRef.current = null
    }
  }, [
    canSaveTrainingSample,
    isAssessmentTopic,
    persistTrainingAttempt,
    stopRecording,
    visibleExercises,
  ])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在准备训练页...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!currentExercise) {
    return (
      <div className="min-h-dvh bg-stone-50">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <div>
              <Link href={returnHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
                <ArrowLeft className="h-4 w-4" />
                {returnLabel}
              </Link>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">{topicSelection.label}</h1>
              <p className="mt-1 text-sm text-gray-600">{topicSelection.description}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <section className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-8 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">当前主题还没准备好可录句子</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {practiceMode === 'prepared_content'
                ? '自定义训练只围绕记忆区当前加载的参考材料工作。先去记忆页选一份材料设为当前加载，再回来录音。'
                : '这一组主题暂时还没有可用句子。'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {practiceMode === 'prepared_content' ? (
                <Link
                  href="/memory#memory-custom-material-editor"
                  className="inline-flex items-center rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white"
                >
                  去记忆页准备材料
                </Link>
              ) : null}
              <Link
                href={returnHref}
                className="inline-flex items-center rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700"
              >
                回到主题选择
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (usesGuidedCollectionFlow(isAssessmentTopic)) {
    const flowSteps: Array<{ id: CollectionFlowStep; label: string }> = [
      { id: 'prepare', label: '准备' },
      { id: 'record', label: '录一句' },
      { id: 'review', label: '确认结果' },
    ]
    const activeStepIndex = flowSteps.findIndex((step) => step.id === collectionFlowStep)

    return (
      <div className="min-h-dvh bg-stone-50">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <Link
                href={returnHref}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {returnLabel}
              </Link>
              <h1 className="mt-1 text-balance text-2xl font-semibold text-gray-900">{topicSelection.label}</h1>
              <p className="mt-1 text-pretty text-sm text-gray-600">一次只做一步，录完再确认结果。</p>
            </div>
            <span className="hidden rounded-full bg-white px-4 py-2 text-sm text-stone-600 ring-1 ring-stone-200 sm:block">
              本轮已完成 {sessionPracticedExerciseIds.length} 句
            </span>
          </div>
        </header>

        <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
          <nav aria-label="数据录入进度" className="rounded-2xl border border-stone-200 bg-white px-4 py-4 sm:px-6">
            <ol className="grid grid-cols-3 gap-2">
              {flowSteps.map((step, index) => {
                const isActive = step.id === collectionFlowStep
                const isComplete = index < activeStepIndex
                return (
                  <li key={step.id} className="flex items-center gap-2 sm:gap-3">
                    <span
                      aria-current={isActive ? 'step' : undefined}
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        isActive
                          ? 'bg-amber-600 text-white'
                          : isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-500',
                      )}
                    >
                      {isComplete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={cn('text-sm font-medium', isActive ? 'text-stone-950' : 'text-stone-500')}>
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </nav>

          {notice ? (
            <div
              role={notice.tone === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm font-medium',
                notice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : notice.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900',
              )}
            >
              {notice.message}
            </div>
          ) : null}

          {collectionFlowStep === 'prepare' ? (
            <section aria-labelledby="collection-prepare-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <p className="text-sm font-medium text-amber-800">第 1 步</p>
              <h2 id="collection-prepare-heading" className="mt-2 text-balance text-2xl font-semibold text-stone-950">
                准备好后再开始
              </h2>
              <p className="mt-2 text-pretty text-sm leading-6 text-stone-600">
                只确认两件事。构音方式不是重录理由，按你平时说话的方式录就好。
              </p>

              <div className="mt-6 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    checked={environmentReady}
                    onChange={(event) => setEnvironmentReady(event.target.checked)}
                    className="mt-0.5 size-5 accent-amber-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-stone-950">周围比较安静</span>
                    <span className="mt-1 block text-pretty text-sm leading-6 text-stone-600">没有持续的电视声、谈话声或明显风声。</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-2">
                  <input
                    type="checkbox"
                    checked={distanceReady}
                    onChange={(event) => setDistanceReady(event.target.checked)}
                    className="mt-0.5 size-5 accent-amber-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-stone-950">麦克风位置稳定</span>
                    <span className="mt-1 block text-pretty text-sm leading-6 text-stone-600">手机或麦克风离嘴约 20–30 厘米，录音时尽量别移动。</span>
                  </span>
                </label>
              </div>

              <div className={cn(
                'mt-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm',
                canSaveTrainingSample ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-800',
              )}>
                {canSaveTrainingSample ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-current" aria-hidden="true" />
                )}
                <span>
                  {canSaveTrainingSample
                    ? '数据授权已确认。录音会按训练用途保存，你仍可以在结果页选择不收录。'
                    : '当前账号缺少新的数据授权记录，请重新登录确认后再开始。'}
                </span>
              </div>

              <details className="mt-5 rounded-2xl border border-stone-200">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500">
                  <span>可选：补充采集资料</span>
                  <span className="text-xs font-normal text-stone-500">计划、年龄段、性别</span>
                </summary>
                <div className="grid gap-4 border-t border-stone-200 p-4 sm:grid-cols-3">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-700">采集计划</span>
                    <select value={collectionPlanId} onChange={(event) => setCollectionPlanId(event.target.value as CollectionPlanId)} className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                      {COLLECTION_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-700">年龄段</span>
                    <select value={ageBand} onChange={(event) => setAgeBand(event.target.value)} className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                      {COLLECTION_AGE_BANDS.map((band) => <option key={band} value={band}>{band === 'unspecified' ? '不愿说明' : band}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-700">性别</span>
                    <select value={sex} onChange={(event) => setSex(event.target.value as TrainingUploadLabels['sex'])} className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                      {COLLECTION_SEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </details>

              <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-pretty text-sm text-stone-500">
                  {!environmentReady || !distanceReady ? '完成上面两项确认后即可继续。' : canSaveTrainingSample ? '准备完成，可以录第一句了。' : '需要先补充数据授权。'}
                </p>
                <button
                  type="button"
                  onClick={() => setCollectionFlowStep('record')}
                  disabled={!collectionPreflightReady}
                  aria-describedby="collection-prepare-help"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  下一步，录一句
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                <span id="collection-prepare-help" className="sr-only">需要确认安静环境、稳定距离和数据授权后才能继续</span>
              </div>
            </section>
          ) : null}

          {collectionFlowStep === 'record' ? (
            <section aria-labelledby="collection-record-heading" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">第 2 步</p>
                  <h2 id="collection-record-heading" className="mt-2 text-balance text-2xl font-semibold text-stone-950">读出这一句</h2>
                  <p className="mt-2 text-pretty text-sm text-stone-600">按平时说话的方式读，读完点停止。</p>
                </div>
                <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700">
                  {isRecording ? formatRecordingTime(recordingSeconds) : recorderStatus.label}
                </span>
              </div>

              <div className="mt-6 rounded-3xl bg-amber-50 px-5 py-7 text-center ring-1 ring-amber-200 sm:px-8 sm:py-9">
                <p className="text-sm font-medium text-amber-800">目标句</p>
                <p className="mt-3 text-balance text-2xl font-semibold leading-relaxed text-stone-950 sm:text-3xl">{currentExercise.text}</p>
                {currentPhonologyTarget?.focus ? (
                  <p className="mt-3 text-pretty text-sm text-amber-900">本句重点：{currentPhonologyTarget.focus}</p>
                ) : null}
              </div>

              <div className="mt-7 flex flex-col items-center text-center">
                <button
                  type="button"
                  aria-label={isRecording ? '停止录音' : '开始录音'}
                  onClick={isRecording ? () => void handleStopRecording() : () => void handleStartRecording()}
                  disabled={isUploading || isProcessing || status === 'connecting'}
                  className={cn(
                    'flex size-28 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
                    isRecording ? 'bg-rose-600 focus-visible:ring-rose-500' : 'bg-amber-600 focus-visible:ring-amber-500',
                  )}
                >
                  <span className="flex flex-col items-center gap-1">
                    <Mic className="size-6" aria-hidden="true" />
                    <span className="text-sm font-semibold">{isRecording ? '停止' : '开始录音'}</span>
                  </span>
                </button>
                <p className="mt-4 text-pretty text-sm leading-6 text-stone-600">{recorderStatus.description}</p>
              </div>

              {isRecording ? (
                <>
                  <MicrophoneInputFeedback analyser={analyser} active title="收音状态" className="mt-6" />
                  <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4" aria-live="polite">
                    <p className="text-sm font-medium text-stone-900">系统正在听</p>
                    <p className="mt-2 min-h-7 text-pretty text-sm leading-6 text-stone-600">{interimText || '开始说话后，识别内容会显示在这里。'}</p>
                  </div>
                </>
              ) : null}

              {sessionError ? (
                <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{sessionError}</div>
              ) : null}

              <details className="mt-6 rounded-2xl border border-stone-200">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500">
                  <span>换一句</span>
                  <span className="text-xs font-normal text-stone-500">当前主题还有 {matchingExercises.length} 句</span>
                </summary>
                <div className="border-t border-stone-200 p-4">
                  <label className="block">
                    <span className="sr-only">搜索训练句子</span>
                    <input
                      value={exerciseQuery}
                      onChange={(event) => setExerciseQuery(event.target.value)}
                      placeholder="搜索句子"
                      className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </label>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                    {visibleExercises.map((exercise) => {
                      const isActive = currentExercise.id === exercise.id
                      return (
                        <button
                          key={exercise.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => handleSelectExercise(exercise.id)}
                          disabled={isRecording || isProcessing}
                          className={cn(
                            'w-full rounded-xl border px-4 py-3 text-left text-sm leading-6 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                            isActive ? 'border-amber-400 bg-amber-50 text-stone-950' : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300',
                          )}
                        >
                          {exercise.text}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </details>

              <button
                type="button"
                onClick={() => setCollectionFlowStep('prepare')}
                disabled={isRecording || isProcessing}
                className="mt-5 min-h-11 text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                返回修改采集准备
              </button>
            </section>
          ) : null}

          {collectionFlowStep === 'review' && attempt ? (
            <section aria-labelledby="collection-review-heading" className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
              <div role="status" aria-live="polite" className="flex items-start gap-4 rounded-2xl bg-emerald-50 px-4 py-4 sm:px-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-emerald-800">录音成功</p>
                  <h2 id="collection-review-heading" className="mt-1 text-balance text-xl font-semibold text-emerald-950">很好，这一句已经完整收下了</h2>
                  <p className="mt-1 text-pretty text-sm leading-6 text-emerald-800">
                    {attempt.uploadStatus === 'saving'
                      ? '正在自动保存，你可以先确认系统听到的内容。'
                      : attempt.uploadStatus === 'uploaded'
                        ? '已经安全保存到你的训练数据中。'
                        : attempt.uploadStatus === 'retrying'
                          ? '录音已留在本机，网络恢复后会自动补登。'
                          : '你可以回听、重录或继续下一句。'}
                  </p>
                </div>
              </div>

              <dl className="mt-5 divide-y divide-stone-200 rounded-2xl border border-stone-200 px-4 sm:px-5">
                <div className="grid gap-1 py-4 sm:grid-cols-[5rem_1fr] sm:gap-4">
                  <dt className="text-sm font-medium text-stone-500">目标句</dt>
                  <dd className="text-pretty text-base leading-7 text-stone-950">{attempt.exercise.text}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[5rem_1fr] sm:gap-4">
                  <dt className="text-sm font-medium text-stone-500">系统听到</dt>
                  <dd className="text-pretty text-base leading-7 text-stone-950">{attempt.transcript || '这次没有拿到稳定的识别文本，但录音仍可回听。'}</dd>
                </div>
              </dl>

              {attempt.recording && attemptPlaybackUrl ? (
                <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-stone-900">
                    <PlayCircle className="size-4 text-amber-700" aria-hidden="true" />
                    回听录音 · {formatRecordingTime(attempt.recording.audio.durationSeconds)}
                  </p>
                  <audio controls preload="metadata" src={attemptPlaybackUrl} className="mt-3 w-full">
                    当前浏览器暂不支持直接播放这条录音。
                  </audio>
                </div>
              ) : null}

              <p className="mt-4 text-pretty text-sm leading-6 text-stone-600">{attempt.sampleQuality.summary}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleContinueAfterAttempt}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                >
                  继续下一句
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleRetryCurrentExercise()}
                  disabled={isUploading || isProcessing || isRecording}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition-colors duration-150 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  重录这一句
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleDiscardAttempt()}
                disabled={attempt.uploadStatus === 'discarding' || attempt.uploadStatus === 'discarded'}
                className="mt-3 min-h-11 w-full text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                这条不收录
              </button>
            </section>
          ) : null}

          {collectionFlowStep === 'review' && !attempt ? (
            <section className="rounded-3xl border border-stone-200 bg-white p-6 text-center">
              <p className="text-pretty text-sm text-stone-600">这次结果已处理，可以继续录下一句。</p>
              <button type="button" onClick={handleContinueAfterAttempt} className="mt-4 rounded-xl bg-amber-700 px-5 py-3 text-sm font-semibold text-white">继续录音</button>
            </section>
          ) : null}

          <details className="rounded-2xl border border-stone-200 bg-white">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500">
              <span>本轮与主题信息</span>
              <span className="text-xs font-normal text-stone-500">进度、待补登与材料</span>
            </summary>
            <div className="grid gap-3 border-t border-stone-200 p-4 sm:grid-cols-3">
              <div className="rounded-xl bg-stone-50 px-4 py-3"><p className="text-xs text-stone-500">本轮已录</p><p className="mt-1 font-semibold text-stone-900 tabular-nums">{sessionPracticedExerciseIds.length} 句</p></div>
              <div className="rounded-xl bg-stone-50 px-4 py-3"><p className="text-xs text-stone-500">待补登</p><p className="mt-1 font-semibold text-stone-900 tabular-nums">{localQueueItems.length} 条</p></div>
              <div className="rounded-xl bg-stone-50 px-4 py-3"><p className="text-xs text-stone-500">当前主题</p><p className="mt-1 font-semibold text-stone-900">{topicSelection.label}</p></div>
            </div>
          </details>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href={returnHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
              <ArrowLeft className="h-4 w-4" />
              {returnLabel}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">{topicSelection.label}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {topicSelection.description}
            </p>
          </div>
          <div className="hidden rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700 sm:block">
            当前账号：{user?.email || '已登录用户'}
          </div>
        </div>
      </header>

      {notice ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {notice.message}
        </div>
      ) : null}

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8">
        <section className="order-2 grid gap-4 sm:grid-cols-3 xl:order-none">
          {currentProgressStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-sm"
            >
              <p className="text-sm font-medium text-stone-500">{stat.label}</p>
              <p className="mt-3 text-2xl font-semibold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="mt-2 text-sm text-gray-600">{stat.detail}</p>
            </div>
          ))}
        </section>

        {isAssessmentTopic && assessmentSummary ? (
          <section className="order-3 rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm xl:order-none">
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-800 w-fit">
              <Sparkles className="h-4 w-4" />
              评估主题区
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[22px] border border-amber-200 bg-white px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 text-balance">完成固定词表，建立你的沟通表现基线</h2>
                    <p className="mt-2 text-sm text-gray-600 text-pretty">
                      疾病种类可选填；报告重点看系统听清、音系差异、节奏和收音，不从一次录音诊断疾病。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveTrainingLabels()}
                    disabled={isSavingTrainingLabels || trainingEtiology === 'unknown'}
                    className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingTrainingLabels ? '保存中...' : '保存标签'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-gray-900">疾病种类</span>
                    <select
                      value={trainingEtiology}
                      onChange={(event) => setTrainingEtiology(event.target.value as TrainingEtiology)}
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
                    >
                      {TRAINING_ETIOLOGY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">训练支持级别</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {assessmentSummary.completedCount > 0
                        ? assessmentSummary.severityLabel
                        : '先录评估词'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      只反映系统本轮听清程度，可重测覆盖。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-white px-5 py-5">
                <p className="text-sm font-medium text-gray-900">当前结果</p>
                <p className="mt-3 text-3xl font-semibold text-gray-900 tabular-nums">
                  {formatPercent(assessmentSummary.accuracyRatio)}
                </p>
                <p className="mt-2 text-sm text-gray-600 text-pretty">
                  {assessmentSummary.severitySummary}
                </p>
              </div>

              <div className="rounded-[22px] border border-stone-200 bg-white px-5 py-5 lg:col-span-2">
                <p className="text-sm font-medium text-gray-900">最值得回看的词</p>
                {assessmentSummary.weakestExercises.length > 0 ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {assessmentSummary.weakestExercises.map((exercise) => (
                      <div
                        key={exercise.exerciseId}
                        className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {exercise.targetText} · {formatPercent(exercise.accuracyRatio)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          系统听到：{exercise.heardText || '这次还没有稳定结果'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-600">
                    先录完几条筛查词，这里才会浮出最容易卡住的例子。
                  </p>
                )}
              </div>
              {speechPerformanceReport ? (
                <div className="rounded-[22px] border border-stone-200 bg-white px-5 py-5 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-amber-800">声音与沟通表现报告 · 体验版</p>
                      <h3 className="mt-1 text-xl font-semibold text-gray-900">不只看一个分数，找到下一次真正能改的动作</h3>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                      已分析 {speechPerformanceReport.sampleCount} 条
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="text-xs text-stone-500">系统听清程度</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">{speechPerformanceReport.systemUnderstandingPercent}%</p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">错字、多字、漏字均计入</p>
                    </div>
                    <div className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="text-xs text-stone-500">不同词稳定性</p>
                      <p className="mt-2 text-base font-semibold text-gray-900">{speechPerformanceReport.consistencyLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">{speechPerformanceReport.consistencyDetail}</p>
                    </div>
                    <div className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="text-xs text-stone-500">表达节奏</p>
                      <p className="mt-2 text-base font-semibold text-gray-900">
                        {speechPerformanceReport.speechRateCharsPerSecond === null ? '继续积累' : `${speechPerformanceReport.speechRateCharsPerSecond} 字/秒`}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">与自己的历史基线比较更有意义</p>
                    </div>
                    <div className="rounded-2xl bg-stone-50 px-4 py-4">
                      <p className="text-xs text-stone-500">收音状态</p>
                      <p className="mt-2 text-base font-semibold text-gray-900">{speechPerformanceReport.captureLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">{speechPerformanceReport.captureDetail}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">本轮易混淆线索</p>
                      {speechPerformanceReport.patterns.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {speechPerformanceReport.patterns.map((pattern) => (
                            <span key={pattern.id} className="rounded-full bg-amber-50 px-3 py-2 text-sm text-amber-900">
                              {pattern.label} · {pattern.count} 次
                            </span>
                          ))}
                        </div>
                      ) : <p className="mt-2 text-sm text-stone-600">完成更多词条后，会归纳易漏听的字和音系组。</p>}
                    </div>
                    <div className="rounded-2xl border border-stone-200 px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">个性化识别数据准备度</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-amber-600" style={{ width: `${speechPerformanceReport.personalizationProgressPercent}%` }} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{speechPerformanceReport.personalizationDetail}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-medium text-amber-950">下一轮建议</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
                      {speechPerformanceReport.nextActions.map((action) => <li key={action}>· {action}</li>)}
                    </ul>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-stone-500">{speechPerformanceReport.boundary}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="order-1 grid gap-6 xl:order-none xl:grid-cols-[0.88fr_1.12fr]">
          <aside className="order-2 space-y-6 xl:order-1">
            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                    <Sparkles className="h-4 w-4" />
                    当前训练主题
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-gray-900">{topicSelection.label}</h2>
                  <p className="mt-2 text-sm text-gray-600 text-pretty">{topicSelection.description}</p>
                </div>
                <Link
                  href={returnHref}
                  className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
                >
                  {isAssessmentTopic ? '退出筛查' : '切换主题'}
                </Link>
              </div>

              <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm font-medium text-amber-800">采集前确认</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">只为保证样本可用，不会因为构音错误要求重录。</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex items-start gap-2 rounded-2xl bg-white px-3 py-3 text-sm text-stone-700">
                    <input type="checkbox" checked={environmentReady} onChange={(event) => setEnvironmentReady(event.target.checked)} />
                    <span>环境安静，已录过短暂环境音</span>
                  </label>
                  <label className="flex items-start gap-2 rounded-2xl bg-white px-3 py-3 text-sm text-stone-700">
                    <input type="checkbox" checked={distanceReady} onChange={(event) => setDistanceReady(event.target.checked)} />
                    <span>麦克风位置稳定，约 20–30 cm</span>
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-stone-600">采集计划</span>
                    <select value={collectionPlanId} onChange={(event) => setCollectionPlanId(event.target.value as CollectionPlanId)} className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm">
                      {COLLECTION_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-stone-600">年龄段（可选）</span>
                    <select value={ageBand} onChange={(event) => setAgeBand(event.target.value)} className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm">
                      {COLLECTION_AGE_BANDS.map((band) => <option key={band} value={band}>{band === 'unspecified' ? '不愿说明' : band}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-stone-600">性别（可选）</span>
                    <select value={sex} onChange={(event) => setSex(event.target.value as TrainingUploadLabels['sex'])} className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm">
                      {COLLECTION_SEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-3 text-xs leading-5 text-stone-500">默认只保存音频、目标文本、实际转写、严重程度、病种、年龄段和性别；其他信息只在质检需要时使用。</p>
              </div>
              <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                {practiceMode === 'prepared_content' ? (
                  <>
                    <p className="text-sm font-medium text-amber-800">当前准备内容</p>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">
                      {preparedExpression?.title || '当前参考文档'}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{preparedExpressionPreview}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                        {preparedExpressionExercises.length} 句可练
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                        训练样本：{preparedExpressionTrainingCount} 条
                      </span>
                      {preparedExpression?.scene ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                          场景：{preparedExpression.scene}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href="/memory#memory-custom-material-editor"
                        className="inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                      >
                        去记忆区编辑材料
                      </Link>
                      <button
                        type="button"
                        onClick={() => void refreshWorkspaceSnapshot()}
                        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:border-stone-400 hover:bg-stone-100"
                      >
                        同步记忆材料
                      </button>
                      {preparedExpressionDocument ? (
                        <button
                          type="button"
                          onClick={() => setIsPreparedPreviewOpen((current) => !current)}
                          className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                        >
                          {isPreparedPreviewOpen ? '收起全文' : '展开全文'}
                        </button>
                      ) : null}
                    </div>
                    {isPreparedPreviewOpen && preparedExpressionDocument ? (
                      <div className="mt-4 max-h-56 overflow-y-auto rounded-[20px] border border-stone-200 bg-white px-4 py-4 text-sm leading-7 text-gray-700 whitespace-pre-wrap">
                        {preparedExpressionDocument}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-amber-800">当前通用主题</p>
                    <h3 className="mt-2 text-xl font-semibold text-gray-900">
                      {MANDARIN_TRAINING_CATEGORY_META[selectedCategory].label}
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                        {MANDARIN_TRAINING_CATEGORY_META[selectedCategory].corpusCount} 条可练
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                        {isAssessmentTopic ? '当前模式：筛查词表' : '当前模式：通用句库'}
                      </span>
                      {isAssessmentTopic ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                          建议先整组录完
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">句子准备</p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">
                    {isAssessmentTopic ? '固定筛查词表' : '左边挑句，右边直接录音'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {isAssessmentTopic
                      ? '按顺序录就行，不需要搜索。'
                      : '这里保留当前主题的句子序列，需要时再换句。'}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                  {matchingExercises.length} 句
                </span>
              </div>

              {isAssessmentTopic ? (
                <p className="mt-4 text-sm text-gray-600">{exerciseSelectionHint}</p>
              ) : (
                <>
                  {isPhonologyTopic ? (
                    <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-stone-950 text-balance">选择音系小组</p>
                          <p className="mt-1 text-sm leading-6 text-stone-600 text-pretty">
                            每句按真实拼音标注，可以同时属于多个专项；这里选择本轮主要练什么。
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700 tabular-nums">
                          {categoryExercises.length} 句
                        </span>
                      </div>
                      <div
                        className="mt-4 grid gap-2 sm:grid-cols-2"
                        role="group"
                        aria-label="选择音系训练小组"
                      >
                        {phonologyGroupOptions.map((group) => {
                          const isActive = group.id === selectedPhonologyGroupId
                          return (
                            <button
                              key={group.id}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => handleSelectPhonologyGroup(group.id)}
                              disabled={isRecording || isProcessing}
                              className={cn(
                                'rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                                isActive
                                  ? 'border-amber-400 bg-amber-50 text-stone-950'
                                  : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50',
                              )}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold">{group.label}</span>
                                <span className="text-xs tabular-nums text-stone-500">{group.count}</span>
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-stone-600 text-pretty">
                                {group.shortLabel}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-3 rounded-2xl bg-white px-4 py-3">
                        <p className="text-sm font-medium text-stone-900">
                          当前：{activePhonologyGroup.label} · {activePhonologyGroup.shortLabel}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-stone-600 text-pretty">
                          {activePhonologyGroup.description}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                      value={exerciseQuery}
                      onChange={(event) => setExerciseQuery(event.target.value)}
                      placeholder={practiceMode === 'prepared_content' ? '搜索当前材料里的句子' : '搜索当前训练主题'}
                      className="h-11 flex-1 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300"
                    />
                    <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                      {practiceMode === 'prepared_content' ? '自定义训练' : '通用句库'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-gray-600">{exerciseSelectionHint}</p>
                </>
              )}

              <div className="mt-4 max-h-[720px] overflow-y-auto rounded-[24px] border border-stone-200 bg-stone-50 p-3">
                <div className="space-y-3">
                  {visibleExercises.map((exercise) => {
                    const isActive = currentExercise.id === exercise.id
                    const phonologyFocus = isPhonologyTopic
                      ? getPhonologyFocusForGroup(exercise.id, selectedPhonologyGroupId)
                      : null
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => handleSelectExercise(exercise.id)}
                        disabled={isRecording || isProcessing}
                        className={`w-full rounded-[20px] border px-4 py-4 text-left transition ${
                          isActive
                            ? 'border-amber-300 bg-amber-50 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                            {isPreparedExpressionExercise(exercise)
                              ? exercise.preparedExpressionSectionTitle
                              : exercise.category}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isActive
                              ? 'bg-white text-amber-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}>
                            {isActive ? (isAssessmentTopic ? '当前词' : '当前句') : (isAssessmentTopic ? '点这词开测' : '点这句开练')}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold leading-7 text-gray-900">{exercise.text}</p>
                        {phonologyFocus ? (
                          <p className="mt-2 text-sm text-amber-800 text-pretty">
                            本句重点：{phonologyFocus}
                          </p>
                        ) : null}
                      </button>
                    )
                  })}

                  {visibleExercises.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center text-sm text-gray-600">
                      {practiceMode === 'prepared_content'
                        ? '当前还没有可切分的材料句子。先去记忆区同步一份材料，或者切回通用句库。'
                        : '当前筛选下没有句子，换个关键词试试。'}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>

          <section className="order-1 space-y-6 xl:order-2">
            {!isAssessmentTopic ? (
              <section className="hidden rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm lg:block">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-amber-800">每日目标</p>
                    <h2 className="mt-2 text-2xl font-semibold text-gray-900">{currentGoalHeadline}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600 text-pretty">{currentGoalSupport}</p>
                  </div>
                  {attempt?.sampleQuality.action === 'retry' ? (
                    <button
                      type="button"
                      onClick={handleRetryCurrentExercise}
                      disabled={isUploading || isProcessing || isRecording}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" />
                      重录这一句
                    </button>
                  ) : null}
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">昨日训练榜</p>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                      昨天共 {trainingActivity?.yesterday.total_recordings ?? 0} 句
                    </span>
                  </div>
                  <div className="mt-3">
                    {renderYesterdayTopContributors(trainingActivity)}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isAssessmentTopic ? '当前词' : '当前句'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isAssessmentTopic
                      ? '识别完整后再进入下一条。'
                      : '句子准备在左边，录音和结果固定在右边；一条录稳后会默认自动切到下一句。'}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-gray-700">
                  {isRecording ? formatRecordingTime(recordingSeconds) : recorderStatus.label}
                </span>
              </div>

              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
                    {isPreparedExpressionExercise(currentExercise)
                      ? currentExercise.preparedExpressionSectionTitle
                      : currentExercise.category}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveExercise(-1)}
                      disabled={isRecording || isProcessing}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      上一句
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(1)}
                      disabled={isRecording || isProcessing}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      下一句
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-2xl font-semibold leading-snug text-gray-900">{currentExercise.text}</p>

                {currentExerciseTags.length > 0 ? (
                  <div className="mt-4">
                    {renderChips(currentExerciseTags, 'amber')}
                  </div>
                ) : null}

                {currentPhonologyTarget && currentPhonologyTargetMeta ? (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-4">
                    <p className="text-sm font-medium text-stone-950">
                      本句音系重点：{currentPhonologyTargetMeta.label} · {currentPhonologyTarget.focus}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-600 text-pretty">
                      {currentPhonologyTargetMeta.description}
                    </p>
                  </div>
                ) : null}

                {currentPreparedAnchorLine ? (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">当前段落锚点</p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{currentPreparedAnchorLine}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                <button
                  type="button"
                  onClick={isRecording ? () => void handleStopRecording() : () => void handleStartRecording()}
                  disabled={isUploading || isProcessing || status === 'connecting'}
                  className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition ${
                    isRecording
                      ? 'bg-rose-500 hover:bg-rose-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Mic className="h-6 w-6" />
                    <span className="text-sm font-medium">{isRecording ? '停止' : '录音'}</span>
                  </div>
                </button>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {isRecording
                      ? (isAssessmentTopic ? '正在录这一词' : '正在录这一句')
                      : '点一次，直接开始练'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {recorderStatus.description}
                    {!isRecording && visibleExercises.length > 1 && !isAssessmentTopic
                      ? ' 录完后会自动进入当前主题的下一句。'
                      : ''}
                  </p>
                </div>
              </div>

              <MicrophoneInputFeedback
                analyser={analyser}
                active={isRecording}
                title={isAssessmentTopic ? '收音状态' : '录音输入质量'}
                className="mt-6"
              />

              <div className="mt-6 rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-medium text-gray-900">
                  实时识别
                </p>
                <p className="mt-3 min-h-16 text-base leading-7 text-gray-700">
                  {interimText || (
                    isAssessmentTopic
                      ? '开始录音后，这里会先出现系统临时听到的词。'
                      : '开始录音后，这里会出现系统当前听到的内容。'
                  )}
                </p>
              </div>

              {sessionError ? (
                <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {sessionError}
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isAssessmentTopic ? '这次结果' : '本次结果'}
                  </h2>
                </div>
                {attempt ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                    {UPLOAD_STATUS_LABELS[attempt.uploadStatus]}
                  </span>
                ) : null}
              </div>

              {attempt ? (
                <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderChips(
                      dedupeStrings(
                        isPreparedExpressionExercise(attempt.exercise)
                          ? [
                              attempt.exercise.preparedExpressionSectionTitle,
                              ...attempt.exercise.preparedExpressionKeywords,
                            ]
                          : [attempt.exercise.category],
                        3,
                      ),
                      'stone',
                    )}
                    {isAssessmentTopic && currentAttemptCharacterAccuracy !== null ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                        字准率 {formatPercent(currentAttemptCharacterAccuracy)}
                      </span>
                    ) : null}
                  </div>

                  <dl className="mt-4 divide-y divide-stone-200 rounded-2xl bg-white px-4">
                    <div className="grid gap-1 py-3 sm:grid-cols-[4.5rem_1fr] sm:gap-4">
                      <dt className="text-sm font-medium text-gray-500">目标</dt>
                      <dd className="text-base leading-7 text-gray-950">{attempt.exercise.text}</dd>
                    </div>
                    <div className="grid gap-1 py-3 sm:grid-cols-[4.5rem_1fr] sm:gap-4">
                      <dt className="text-sm font-medium text-gray-500">系统听到</dt>
                      <dd className="text-base leading-7 text-gray-950">
                        {isAssessmentTopic
                          ? assessmentTranscriptNotice?.heardText
                          : attempt.transcript || '这次还没有稳定拿到最终结果。'}
                      </dd>
                    </div>
                  </dl>

                  {attempt.recording && attemptPlaybackUrl ? (
                    <div className="mt-3 rounded-2xl bg-white px-4 py-3">
                      <p className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                        <PlayCircle className="h-4 w-4 text-amber-700" />
                        回听 · {formatRecordingTime(attempt.recording.audio.durationSeconds)}
                      </p>
                      <audio
                        controls
                        preload="metadata"
                        src={attemptPlaybackUrl}
                        className="mt-2 w-full"
                      >
                        当前浏览器暂不支持直接播放这条录音。
                      </audio>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-xl text-sm leading-6 text-gray-700">
                      {isAssessmentTopic && !attempt.transcript
                        ? '识别结果为空，请重新录制。'
                        : isAssessmentTopic
                          ? assessmentTranscriptNotice?.helperText
                          : attempt.sampleQuality.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDiscardAttempt()}
                        disabled={attempt.uploadStatus === 'discarding' || attempt.uploadStatus === 'discarded'}
                        className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        不收录
                      </button>
                      <button
                        type="button"
                        onClick={handleRetryCurrentExercise}
                        disabled={isUploading || isProcessing || isRecording}
                        className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {isAssessmentTopic ? '重录当前词' : '重录这一句'}
                      </button>
                    </div>
                    </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm leading-6 text-gray-600">
                  {isAssessmentTopic
                    ? '录完后，这里会显示目标词、系统听到和这一词的字准率。'
                    : '录完这一句后，这里只保留目标句、系统听到和回听。'}
                </div>
              )}
            </section>
          </section>
        </section>

        {!isAssessmentTopic ? (
          <section className="order-4 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm xl:order-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">详细训练总结</h2>
              <p className="mt-1 text-sm text-gray-600">
                这里只看真实训练差异，不加多余解释。
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {trainingReports?.weeklySummary
                ? `最近 7 天 ${trainingReports.weeklySummary.sampleCount} 条`
                : trainingReports?.dailySummary
                  ? `今天 ${trainingReports.dailySummary.sampleCount} 条`
                : preparedExpressionTrainingCount > 0
                  ? `已有 ${preparedExpressionTrainingCount} 条训练样本`
                  : '录音后会自动生成'}
            </span>
          </div>

          {trainingReports ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[20px] bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">今日总结</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {trainingReports.dailySummary?.summary ?? '今天还没有新的训练总结，继续录音后这里会自动更新。'}
                </p>
                {trainingReports.dailySummary?.mismatchPairs.length ? (
                  <div className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
                    {trainingReports.dailySummary.mismatchPairs.slice(0, 4).map((pair) => (
                      <p key={`${pair.target}-${pair.heard}`}>
                        {pair.target}{' <- '}{pair.heard}
                        {pair.occurrenceCount > 1 ? ` · ${pair.occurrenceCount}次` : ''}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">今天还没有稳定错配对。</p>
                )}
              </div>

              <div className="rounded-[20px] bg-sky-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">最近 7 天总结</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {trainingReports.weeklySummary?.summary ?? '最近 7 天总结会在累计出更稳定的训练差异后出现。'}
                </p>
                {trainingReports.weeklySummary?.stableWins.length ? (
                  <div className="mt-4">
                    {renderChips(trainingReports.weeklySummary.stableWins, 'sky')}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">最近 7 天还没有浮出稳定亮点。</p>
                )}
              </div>

              <div className="rounded-[20px] bg-emerald-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">每日练习目标</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {dailyPracticeSlogan}。先完成固定小目标，再看今日总结和 7 天总结。
                </p>
                <div className="mt-4">
                  {renderChips(['20 句', '先完成一轮', '不公开账号'], 'emerald')}
                </div>
              </div>
            </div>
          ) : (
              <div className="mt-5 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                {preparedExpressionTrainingCount > 0
                ? '现在还没有按时间窗整理出的训练总结。可以继续练，或者点“用训练记录刷新总结”马上重算一版。'
                : '现在还没有训练总结。先开始录音，系统会只根据真实训练结果整理今日总结、7 天总结和计划。'}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
