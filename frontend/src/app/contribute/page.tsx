'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, Mic, RotateCcw, Sparkles } from 'lucide-react'
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
import type {
  VoxFlameConsentScope,
  VoxFlameRecordingEnvelope,
} from '@/lib/recording/recording-contract'
import {
  type MandarinTrainingFeedback,
  analyzeMandarinAttempt,
} from '@/lib/training/mandarin-feedback'
import {
  appendUploadedTrainingRecord,
  getUploadedTrainingExerciseIds,
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
import { summarizeAssessmentAttempts } from '@/lib/training/training-assessment'
import {
  DEFAULT_TRAINING_GUIDANCE_PROFILE,
  TRAINING_ETIOLOGY_OPTIONS,
  type TrainingEtiology,
  type TrainingSeverity,
} from '@/lib/training/training-guidance-profile'
import { buildTrainingSampleLineage } from '@/lib/training/training-sample-lineage'
import { selectTrainingExercises } from '@/lib/training/training-exercise-selection'

type AttemptUploadStatus =
  | 'idle'
  | 'saving'
  | 'uploaded'
  | 'retrying'
  | 'auth_required'
  | 'failed'

type AttemptSaveTrigger = 'auto' | 'manual'

type PracticeSourceMode = 'prepared_content' | 'sentence_corpus'
type PracticeExercise = MandarinTrainingExercise | PreparedExpressionPracticeExercise

interface TrainingUploadLabels {
  etiology?: TrainingEtiology
  severity?: TrainingSeverity
}

interface PracticeAttempt {
  createdAt: number
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

interface TrainingPlanView {
  summary: string
  items: string[]
  generatedAt: string
}

interface TrainingReportsView {
  dailySummary: TrainingSummaryWindowView | null
  weeklySummary: TrainingSummaryWindowView | null
  trainingPlan: TrainingPlanView | null
}

const DEFAULT_VISIBLE_SENTENCES = 60
const SEARCH_VISIBLE_SENTENCES = 80

const UPLOAD_STATUS_LABELS: Record<AttemptUploadStatus, string> = {
  idle: '这条录音还没进入保存流程',
  saving: '正在自动保存',
  uploaded: '已写入训练语料',
  retrying: '正在后台自动补登',
  auth_required: '需要重新登录恢复自动保存',
  failed: '云端登记暂时异常',
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

function mapAssessmentSeverityToProfileSeverity(
  severityBand: ReturnType<typeof summarizeAssessmentAttempts>['severityBand'],
): TrainingSeverity {
  if (severityBand === 'severe') {
    return 'severe'
  }

  if (severityBand === 'moderate') {
    return 'moderate'
  }

  if (severityBand === 'mild') {
    return 'mild'
  }

  return 'unsure'
}

function buildUploadMetadata(
  exercise: PracticeExercise,
  recording: VoxFlameRecordingEnvelope,
  transcript: string,
  transcriptLatencyMs: number,
  feedback: MandarinTrainingFeedback,
  sampleQuality: TrainingSampleQuality,
  saveTrigger: AttemptSaveTrigger,
  uploadLabels?: TrainingUploadLabels | null,
): Record<string, unknown> {
  const lineage = buildTrainingSampleLineage(exercise, recording)
  const isAssessmentExercise = exercise.category === '评估筛查'
  const metadata: Record<string, unknown> = {
    kind: 'training_result',
    exercise_id: exercise.id,
    exercise_text: exercise.text,
    exercise_category: exercise.category,
    target_text: exercise.text,
    prompt_aligned_transcript: exercise.text,
    raw_transcript: transcript,
    recognized_text: transcript,
    confidence: sampleQuality.confidence,
    confidence_source: 'heuristic_training_workspace_v1',
    latency_ms: transcriptLatencyMs,
    prompt_group_key: lineage.promptGroupKey,
    prompt_fingerprint: lineage.promptFingerprint,
    recording_dedupe_key: lineage.recordingDedupeKey,
    duplicate_policy: lineage.duplicatePolicy,
    repeated_prompt_strategy: lineage.repeatedPromptStrategy,
    feedback_status: feedback.status,
    clarity_score: getClarityScore(feedback.status),
    alignment_score: sampleQuality.score,
    alignment_status: sampleQuality.action === 'retry' ? 'retry_recommended' : 'matched',
    alignment_tier: sampleQuality.tier,
    alignment_summary: sampleQuality.summary,
    alignment_reasons: sampleQuality.reasons,
    transcript_coverage_ratio: sampleQuality.coverageRatio,
    missing_chars: feedback.missingChars,
    extra_chars: feedback.extraChars,
    speech_patterns: feedback.speechPatterns,
    articulation_tips: feedback.articulationTips,
    pronunciation_targets: feedback.pronunciationTargets,
    pronunciation_summary: feedback.pronunciationSummary,
    consent_version: LEGAL_CONSENT_VERSION,
    source_label: 'training_workspace_v3',
    save_trigger: saveTrigger,
    auto_saved: saveTrigger === 'auto',
  }

  if (uploadLabels?.etiology && uploadLabels.etiology !== DEFAULT_TRAINING_GUIDANCE_PROFILE.etiology) {
    metadata.etiology = uploadLabels.etiology
  }

  if (uploadLabels?.severity && uploadLabels.severity !== DEFAULT_TRAINING_GUIDANCE_PROFILE.severity) {
    metadata.severity = uploadLabels.severity
  }

  if (isAssessmentExercise) {
    metadata.assessment_mode = 'screening'
    metadata.assessment_scheme = 'character_accuracy_v1'
    metadata.assessment_prompt_count = 20
  }

  if (isPreparedExpressionExercise(exercise)) {
    metadata.prepared_expression_id = exercise.preparedExpressionId
    metadata.prepared_expression_title = exercise.preparedExpressionTitle
    metadata.prepared_expression_section_id = exercise.preparedExpressionSectionId
    metadata.prepared_expression_section_title = exercise.preparedExpressionSectionTitle
    metadata.high_risk_phrases = exercise.preparedExpressionHighRiskPhrases
    metadata.fallback_phrases = exercise.preparedExpressionFallbackPhrases
    metadata.keywords = exercise.preparedExpressionKeywords
    metadata.hotwords = exercise.preparedExpressionKeywords
    metadata.practice_source = exercise.practiceSource
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
      description: '正在等最终 transcript 和录音 envelope 收齐。',
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
      description: '正在拉起训练会话和麦克风链路。',
    }
  }

  if (status === 'error') {
    return {
      label: '需要处理',
      description: sessionError || '当前训练链路有异常，请先处理下面的提示。',
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
      helperText: '这条已经拿到 transcript，可以继续看这一词的字准率。',
      tone: 'sky',
    }
  }

  if (hasRecording) {
    return {
      heardText: '这次录到了音频，但短词 transcript 还没收稳。',
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
    training_plan: {
      summary: string
      items: string[]
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
    trainingPlan: reports.training_plan
      ? {
          summary: reports.training_plan.summary,
          items: reports.training_plan.items,
          generatedAt: reports.training_plan.generated_at,
        }
      : null,
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
  const currentGoalHeadline = useMemo(() => {
    if (trainingReports?.trainingPlan?.items[0]) {
      return trainingReports.trainingPlan.items[0]
    }

    if (trainingReports?.dailySummary?.nextFocus[0]) {
      return `这一轮先盯住“${trainingReports.dailySummary.nextFocus[0]}”`
    }

    return '先选一个主题，进去后就直接开始录第一句。'
  }, [trainingReports])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在准备训练页...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_54%,_#f6f4ee_100%)]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="text-sm font-medium text-amber-700 hover:text-amber-800">
              返回首页
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">训练页</h1>
            <p className="mt-1 text-sm text-gray-600">
              先选训练主题，再跳到录音页一条条往下练。
            </p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700">
            当前账号：{user?.email || '已登录用户'}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <section className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-amber-800">当前目标</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">{currentGoalHeadline}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              训练主页面现在只做主题选择，不再把录音区和句子序列直接摊在这里。
            </p>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-amber-900">今日总结</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {trainingReports?.dailySummary?.summary ?? '今天还没有总结，先选一个主题录第一句。'}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
                {trainingReports?.dailySummary
                  ? `${trainingReports.dailySummary.sampleCount} 条`
                  : '待生成'}
              </span>
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-sky-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-sky-900">最近 7 天总结</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {trainingReports?.weeklySummary?.summary ?? '最近 7 天的稳定规律会在训练积累后自动更新。'}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-800">
                {trainingReports?.weeklySummary
                  ? `${trainingReports.weeklySummary.sampleCount} 条`
                  : '待生成'}
              </span>
            </div>
          </section>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                <Sparkles className="h-4 w-4" />
                选择训练主题
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">点一个主题，直接跳到录音页</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                主题选择和录音已经分成两层页面。这里负责决定练哪一组，进去后就只做录音、看结果、自动切下一句。
              </p>
            </div>
            <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              录稳一条后会默认自动切到下一句
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {preparedExpression ? (
              <Link
                href={getTrainingTopicHref('custom-material')}
                className="rounded-[22px] border border-amber-300 bg-amber-50 px-5 py-5 text-left shadow-sm transition hover:border-amber-400 hover:bg-amber-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">自定义训练</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {preparedExpression.title}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
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
                className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-5 py-5 text-left transition hover:border-amber-300 hover:bg-white"
              >
                <p className="text-sm font-semibold text-gray-900">自定义训练</p>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  还没有当前加载材料。先去记忆页选一份材料，再回来练。
                </p>
              </Link>
            )}

            {MANDARIN_TRAINING_CATEGORIES.map((category) => {
              const meta = MANDARIN_TRAINING_CATEGORY_META[category]
              return (
                <Link
                  key={category}
                  href={getTrainingTopicHref(getTrainingTopicIdForCategory(category))}
                  className="rounded-[22px] border border-stone-200 bg-white px-5 py-5 text-left transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{meta.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                      {meta.corpusCount} 条
                    </span>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                      {meta.shortLabel}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

export function TrainingRecorderPage({ topicId }: { topicId: TrainingTopicId }) {
  const topicSelection = useMemo(
    () => resolveTrainingTopicSelection(topicId),
    [topicId],
  )
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

  const disconnectRef = useRef(disconnect)
  disconnectRef.current = disconnect

  const canSaveTrainingSample = hasRequiredLegalConsent(user)
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

  const categoryExercises = useMemo(
    () => (
      practiceMode === 'prepared_content'
        ? preparedExpressionExercises
        : getExercisesByCategory(selectedCategory)
    ),
    [practiceMode, preparedExpressionExercises, selectedCategory],
  )

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
          : [currentExercise?.category ?? null],
      8,
    ),
    [currentExercise, isAssessmentTopic],
  )

  const trainingReports = useMemo(
    () => mapTrainingReports(workspaceSnapshot?.prepared_expression?.training_reports),
    [workspaceSnapshot?.prepared_expression?.training_reports],
  )
  const assessmentSummary = useMemo(
    () => (
      isAssessmentTopic
        ? summarizeAssessmentAttempts(
            Object.values(assessmentAttemptsByExercise).map((savedAttempt) => ({
              exerciseId: savedAttempt.exercise.id,
              targetText: savedAttempt.exercise.text,
              heardText: savedAttempt.transcript,
              normalizedTarget: savedAttempt.feedback.normalizedTarget,
              missingChars: savedAttempt.feedback.missingChars,
            })),
            categoryExercises.length,
          )
        : null
    ),
    [assessmentAttemptsByExercise, categoryExercises.length, isAssessmentTopic],
  )
  const assessedSeverity = useMemo(
    () => (
      assessmentSummary
        ? mapAssessmentSeverityToProfileSeverity(assessmentSummary.severityBand)
        : 'unsure'
    ),
    [assessmentSummary],
  )
  const trainingUploadLabels = useMemo<TrainingUploadLabels>(() => ({
    etiology: trainingEtiology,
    severity:
      assessedSeverity !== DEFAULT_TRAINING_GUIDANCE_PROFILE.severity
        ? assessedSeverity
        : workspaceSnapshot?.user_profile_memory?.severity as TrainingSeverity | undefined,
  }), [assessedSeverity, trainingEtiology, workspaceSnapshot?.user_profile_memory?.severity])
  const recorderStatus = getRecorderStatusCopy(status, sessionError, isAssessmentTopic)
  const currentAttemptCharacterAccuracy = useMemo(() => {
    if (!attempt || !isAssessmentTopic || attempt.feedback.normalizedTarget.length === 0) {
      return null
    }

    return Math.max(
      0,
      (attempt.feedback.normalizedTarget.length - attempt.feedback.missingChars.length)
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
        ? `当前初步等级：${assessmentSummary.severityLabel}`
        : '先把 20 条筛查词录完一遍'
    }

    if (trainingReports?.trainingPlan?.items[0]) {
      return trainingReports.trainingPlan.items[0]
    }

    if (trainingReports?.dailySummary?.nextFocus[0]) {
      return `这一轮先盯住“${trainingReports.dailySummary.nextFocus[0]}”`
    }

    return '这一轮先把当前这句录稳，再继续下一句。'
  }, [assessmentSummary, isAssessmentTopic, trainingReports])

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
          label: '初步等级',
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

  const moveExercise = useCallback((offset: number) => {
    if (!visibleExercises.length || !currentExercise) {
      return
    }

    const currentIndex = visibleExercises.findIndex((exercise) => exercise.id === currentExercise.id)
    if (currentIndex < 0) {
      return
    }

    const nextIndex = (currentIndex + offset + visibleExercises.length) % visibleExercises.length
    setSelectedExerciseId(visibleExercises[nextIndex].id)
    setAttempt(null)
  }, [currentExercise, visibleExercises])

  const handleSelectExercise = useCallback((exerciseId: string) => {
    setSelectedExerciseId(exerciseId)
    setAttempt(null)
  }, [])

  const handleStartRecording = useCallback(async () => {
    if (!currentExercise || isUploading || isProcessing) {
      return
    }

    setAttempt(null)
    setNotice(null)

    try {
      await startRecording()
    } catch (error) {
      console.error('[contribute] start recording failed:', error)
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '录音启动失败，请再试一次。',
      })
    }
  }, [currentExercise, isProcessing, isUploading, startRecording])

  const handleRetryCurrentExercise = useCallback(() => {
    if (isRecording || isProcessing || isUploading) {
      return
    }

    setAttempt(null)
    setNotice(null)
    void handleStartRecording()
  }, [handleStartRecording, isProcessing, isRecording, isUploading])

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
        severity: assessedSeverity,
      })
      await refreshWorkspaceSnapshot()
      setNotice({
        tone: 'success',
        message: '训练资料标签已保存，后续上传样本会自动带上疾病种类和评测严重程度。',
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
    assessedSeverity,
    isAuthenticated,
    refreshWorkspaceSnapshot,
    trainingEtiology,
    userId,
    workspaceSnapshot?.user_profile_memory.document,
  ])

  const persistTrainingAttempt = useCallback(async (
    attemptToPersist: PracticeAttempt,
    saveTrigger: AttemptSaveTrigger,
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
        attemptToPersist.transcriptLatencyMs,
        attemptToPersist.feedback,
        attemptToPersist.sampleQuality,
        saveTrigger,
        trainingUploadLabels,
      ),
    })

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
        message: '音频已经收下了，云端登记会在后台自动补齐。',
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
    trainingUploadLabels,
    uploadRecording,
    userId,
  ])

  const handleStopRecording = useCallback(async () => {
    if (!currentExercise) {
      return
    }

    try {
      const result = await stopRecording()
      const transcript = result.transcript.trim()
      const feedback = analyzeMandarinAttempt(currentExercise, transcript)
      const sampleQuality = assessTrainingSampleQuality({
        feedback,
        recording: result.recording,
        transcriptLatencyMs: result.transcriptLatencyMs,
      })
      const nextAttempt: PracticeAttempt = {
        createdAt: Date.now(),
        exercise: currentExercise,
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
          currentIds.includes(currentExercise.id)
            ? currentIds
            : [...currentIds, currentExercise.id]
        ))
      }
      setAttempt(nextAttempt)
      if (isAssessmentTopic && hasUsableAssessmentTranscript) {
        setAssessmentAttemptsByExercise((current) => ({
          ...current,
          [currentExercise.id]: nextAttempt,
        }))
      }
      const currentIndex = visibleExercises.findIndex((exercise) => exercise.id === currentExercise.id)
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

      if (nextExercise && nextExercise.id !== currentExercise.id) {
        setSelectedExerciseId(nextExercise.id)
      }

      setNotice({
        tone: isAssessmentTopic && !hasUsableAssessmentTranscript
          ? 'error'
          : canSaveTrainingSample && result.recording
            ? 'info'
            : 'success',
        message: isAssessmentTopic && !hasUsableAssessmentTranscript
          ? '这次录到了音频，但短词 transcript 还没收稳；先把词说慢一点、尾音留完整，再录一次。'
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
        message: error instanceof Error ? error.message : '录音结束失败，请重新尝试。',
      })
    }
  }, [
    canSaveTrainingSample,
    currentExercise,
    isAssessmentTopic,
    persistTrainingAttempt,
    stopRecording,
    visibleExercises,
  ])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在准备训练页...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!currentExercise) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_54%,_#f6f4ee_100%)]">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <div>
              <Link href="/contribute" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
                <ArrowLeft className="h-4 w-4" />
                返回主题选择
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
                href="/contribute"
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_54%,_#f6f4ee_100%)]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/contribute" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
              <ArrowLeft className="h-4 w-4" />
              返回主题选择
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">{topicSelection.label}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {topicSelection.description}
            </p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700">
            当前账号：{user?.email || '已登录用户'}
          </div>
        </div>
      </header>

      {notice ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {notice.message}
        </div>
      ) : null}

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
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
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-800 w-fit">
              <Sparkles className="h-4 w-4" />
              评估主题区
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[22px] border border-amber-200 bg-white px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 text-balance">先选病种，再录筛查词</h2>
                    <p className="mt-2 text-sm text-gray-600 text-pretty">
                      疾病种类只选一次。严重程度会按这一组筛查词自动更新。
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
                    <p className="text-sm font-medium text-gray-900">评测严重程度</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {assessmentSummary.completedCount > 0
                        ? assessmentSummary.severityLabel
                        : '先录评估词'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      训练分层用，可重测覆盖。
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
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <aside className="space-y-6">
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
                  href="/contribute"
                  className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
                >
                  切换主题
                </Link>
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
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => handleSelectExercise(exercise.id)}
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

          <section className="space-y-6">
            {!isAssessmentTopic ? (
              <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
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
                  <p className="text-sm font-medium text-gray-900">今日计划</p>
                  <div className="mt-3">
                    {trainingReports?.trainingPlan?.items.length
                      ? renderChips(trainingReports.trainingPlan.items.slice(0, 3), 'emerald')
                      : (
                        <p className="text-sm leading-6 text-gray-600">
                          先录 1 句，系统会自动整理今天的简短计划。
                        </p>
                      )}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isAssessmentTopic ? '当前词' : '当前句'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isAssessmentTopic
                      ? '录稳再切下一条。空 transcript 会停在当前词，不会误跳。'
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
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-white"
                    >
                      上一句
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(1)}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm text-gray-700 transition hover:border-stone-400 hover:bg-white"
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
                  {isAssessmentTopic ? '实时 transcript' : '实时识别'}
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

            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isAssessmentTopic ? '这次结果' : '本次结果'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {isAssessmentTopic
                      ? '主要看目标词、系统听到和这一词的字准率。'
                      : '不做逐句 AI 点评，只看标签和系统听到的结果。'}
                  </p>
                </div>
                {attempt ? (
                  <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                    {UPLOAD_STATUS_LABELS[attempt.uploadStatus]}
                  </span>
                ) : null}
              </div>

              {attempt ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[20px] bg-stone-50 px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">标签</p>
                    <div className="mt-3">
                      {renderChips(
                        dedupeStrings(
                          isPreparedExpressionExercise(attempt.exercise)
                            ? [
                                attempt.exercise.preparedExpressionSectionTitle,
                                ...attempt.exercise.preparedExpressionKeywords,
                              ]
                            : [attempt.exercise.category],
                          8,
                        ),
                        'stone',
                      )}
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-amber-50 px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">目标句</p>
                    <p className="mt-3 text-base leading-7 text-gray-900">{attempt.exercise.text}</p>
                  </div>

                  {isAssessmentTopic ? (
                    <div
                      className={`rounded-[20px] px-4 py-4 ${
                        assessmentTranscriptNotice?.tone === 'sky'
                          ? 'bg-sky-50'
                          : 'bg-amber-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">系统听到</p>
                      <p className="mt-3 text-base leading-7 text-gray-900">
                        {assessmentTranscriptNotice?.heardText}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        {assessmentTranscriptNotice?.helperText}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-[20px] bg-sky-50 px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">系统听到</p>
                      <p className="mt-3 text-base leading-7 text-gray-900">
                        {attempt.transcript || '这次还没有稳定拿到最终结果。'}
                      </p>
                    </div>
                  )}

                  {isAssessmentTopic && currentAttemptCharacterAccuracy !== null ? (
                    <div className="rounded-[20px] bg-white px-4 py-4 ring-1 ring-amber-200">
                      <p className="text-sm font-medium text-gray-900">这一词筛查分</p>
                      <p className="mt-3 text-2xl font-semibold text-gray-900">
                        {formatPercent(currentAttemptCharacterAccuracy)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-700">
                        当前按正确字数 / 目标词总字数计算。整组录完后，再看更稳定的初步等级。
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-[20px] bg-emerald-50 px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">保存状态</p>
                    <p className="mt-3 text-base leading-7 text-gray-900">
                      {UPLOAD_STATUS_LABELS[attempt.uploadStatus]}
                    </p>
                    {attempt.uploadReceipt?.manifestPath ? (
                      <p className="mt-3 break-all font-mono text-xs text-emerald-900">
                        {attempt.uploadReceipt.manifestPath}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {isAssessmentTopic ? '这次建议' : '这句判断'}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-gray-700">
                          {isAssessmentTopic && !attempt.transcript
                            ? '先留在当前词重录，不把这次空 transcript 算进评估结果。'
                            : attempt.sampleQuality.summary}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetryCurrentExercise}
                        disabled={isUploading || isProcessing || isRecording}
                        className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {isAssessmentTopic ? '重录当前词' : '重录这一句'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                  {isAssessmentTopic
                    ? '录完后，这里会显示目标词、系统听到和这一词的字准率。'
                    : '录完这一句后，这里只会出现标签、目标句、系统听到和保存状态。'}
                </div>
              )}
            </section>
          </section>
        </section>

        {!isAssessmentTopic ? (
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
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
                <p className="text-sm font-medium text-gray-900">下一轮计划</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {trainingReports.trainingPlan?.summary ?? '计划会跟着今日总结和 7 天总结一起出来。'}
                </p>
                <div className="mt-3">
                  {trainingReports.trainingPlan?.items.length
                    ? renderChips(trainingReports.trainingPlan.items, 'emerald')
                    : <p className="text-sm text-gray-600">继续训练后会自动浮出下一轮计划。</p>}
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
