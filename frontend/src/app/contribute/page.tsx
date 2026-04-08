'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { FileText, Loader2, Mic, Sparkles, UploadCloud } from 'lucide-react'
import { MicrophoneInputFeedback } from '@/components/runtime/MicrophoneInputFeedback'
import { useAuth } from '@/hooks/useAuth'
import { useMandarinTrainingSession } from '@/hooks/useMandarinTrainingSession'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import { type UploadReceipt, useVoiceUpload } from '@/hooks/useVoiceUpload'
import {
  LEGAL_CONSENT_VERSION,
  hasRequiredLegalConsent,
} from '@/lib/auth/legal-consent'
import {
  MANDARIN_TRAINING_CATEGORIES,
  MANDARIN_TRAINING_CATEGORY_META,
  type MandarinTrainingCategory,
  type MandarinTrainingExercise,
  getExercisesByCategory,
} from '@/lib/corpus/mandarin-training'
import {
  fetchPreparedExpressionAsset,
  savePreparedExpressionAsset,
  summarizePreparedExpressionAsset,
  type PreparedExpressionAsset,
} from '@/lib/memory/workspace-client'
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
  markTrainingProfileSummarySynced,
  TRAINING_PROFILE_SYNC_INTERVAL,
} from '@/lib/training/training-profile'
import {
  buildPreparedExpressionPracticeExercises,
  type PreparedExpressionPracticeExercise,
} from '@/lib/training/prepared-expression-practice'
import {
  assessTrainingSampleQuality,
  type TrainingSampleQuality,
} from '@/lib/training/training-sample-quality'
import { deriveTrainingSampleReviewDecision, type TrainingSampleReviewDecision } from '@/lib/training/training-sample-review'
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

interface PracticeAttempt {
  createdAt: number
  exercise: PracticeExercise
  transcript: string
  transcriptLatencyMs: number
  feedback: MandarinTrainingFeedback
  sampleQuality: TrainingSampleQuality
  sampleReview: TrainingSampleReviewDecision
  recording: VoxFlameRecordingEnvelope | null
  uploadStatus: AttemptUploadStatus
  uploadReceipt: UploadReceipt | null
}

interface NoticeState {
  tone: 'info' | 'success' | 'error'
  message: string
}

interface PreparedCorrectionSummaryView {
  summary: string
  hotwords: string[]
  recurringErrors: string[]
  nextFocus: string[]
  model: string
  basedOnTrainingCount: number
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

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
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

function buildUploadMetadata(
  exercise: PracticeExercise,
  recording: VoxFlameRecordingEnvelope,
  transcript: string,
  transcriptLatencyMs: number,
  feedback: MandarinTrainingFeedback,
  sampleQuality: TrainingSampleQuality,
  sampleReview: TrainingSampleReviewDecision,
  saveTrigger: AttemptSaveTrigger,
): Record<string, unknown> {
  const lineage = buildTrainingSampleLineage(exercise, recording)
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
    sample_quality_score: sampleQuality.score,
    sample_quality_tier: sampleQuality.tier,
    sample_quality_action: sampleQuality.action,
    sample_quality_summary: sampleQuality.summary,
    sample_quality_reasons: sampleQuality.reasons,
    evaluation_status: sampleReview.evaluationStatus,
    review_queue: sampleReview.reviewQueue,
    review_priority: sampleReview.reviewPriority,
    review_required: sampleReview.reviewRequired,
    review_reason_tags: sampleReview.reasonTags,
    review_summary: sampleReview.summary,
    review_recommended_action: sampleQuality.action,
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
): { label: string; description: string } {
  if (status === 'recording') {
    return {
      label: '正在录音',
      description: '按正常节奏读完这句，然后点击停止。',
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
      description: '选中一句后，点一次录音就行。',
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
    description: '先保存准备内容，再选一句开始练。',
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

export default function ContributePage() {
  const { user, userId, session, isLoading, isAuthenticated } = useAuth({
    redirectToLogin: true,
    nextPath: '/contribute',
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

  const [selectedCategory, setSelectedCategory] = useState<MandarinTrainingCategory>(
    MANDARIN_TRAINING_CATEGORIES[0],
  )
  const [practiceMode, setPracticeMode] = useState<PracticeSourceMode>('sentence_corpus')
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    getExercisesByCategory(MANDARIN_TRAINING_CATEGORIES[0])[0]?.id ?? '',
  )
  const [exerciseQuery, setExerciseQuery] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sessionPracticedExerciseIds, setSessionPracticedExerciseIds] = useState<string[]>([])
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [preparedContentAsset, setPreparedContentAsset] = useState<PreparedExpressionAsset | null>(null)
  const [preparedContentTitle, setPreparedContentTitle] = useState('')
  const [preparedContentScene, setPreparedContentScene] = useState('')
  const [preparedContentSource, setPreparedContentSource] = useState('manual_input')
  const [preparedContentText, setPreparedContentText] = useState('')
  const [preparedContentStatus, setPreparedContentStatus] = useState<string | null>(null)
  const [isPreparedContentLoading, setIsPreparedContentLoading] = useState(false)
  const [isSavingPreparedContent, setIsSavingPreparedContent] = useState(false)
  const [isSummarizingPreparedContent, setIsSummarizingPreparedContent] = useState(false)

  const disconnectRef = useRef(disconnect)
  const preparedContentFileInputRef = useRef<HTMLInputElement | null>(null)
  disconnectRef.current = disconnect

  const canSaveTrainingSample = hasRequiredLegalConsent(user)
  const recorderStatus = getRecorderStatusCopy(status, sessionError)
  const preparedExpression = workspaceSnapshot?.prepared_expression ?? null
  const preparedExpressionExercises = useMemo(
    () => buildPreparedExpressionPracticeExercises(preparedExpression),
    [preparedExpression],
  )
  const hasPreparedContent = preparedExpressionExercises.length > 0
  const preparedExpressionTrainingCount = preparedExpression?.rehearsal_count ?? 0
  const canRefreshCorrectionSummary = preparedExpressionTrainingCount > 0

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
      preparedExpressionExercises[0] ??
      getExercisesByCategory(MANDARIN_TRAINING_CATEGORIES[0])[0]
    ),
    [categoryExercises, preparedExpressionExercises, selectableExerciseState.exercises, selectedExerciseId, visibleExercises],
  )

  const currentPreparedSection = useMemo(
    () => (
      isPreparedExpressionExercise(currentExercise)
        ? preparedExpression?.sections.find((section) => section.id === currentExercise.preparedExpressionSectionId) ?? null
        : null
    ),
    [currentExercise, preparedExpression],
  )

  const currentExerciseTags = useMemo(
    () => dedupeStrings(
      isPreparedExpressionExercise(currentExercise)
        ? [
            currentExercise.preparedExpressionSectionTitle,
            ...currentExercise.preparedExpressionKeywords,
            ...currentExercise.preparedExpressionHighRiskPhrases,
          ]
        : [currentExercise?.category ?? null],
      8,
    ),
    [currentExercise],
  )

  const correctionSummary = useMemo<PreparedCorrectionSummaryView | null>(() => {
    const assetSummary = preparedContentAsset?.rehearsal_summary
    if (assetSummary) {
      return {
        summary: assetSummary.summary,
        hotwords: assetSummary.hotwords,
        recurringErrors: assetSummary.recurringErrors,
        nextFocus: assetSummary.nextFocus,
        model: assetSummary.model,
        basedOnTrainingCount: assetSummary.basedOnTrainingCount,
      }
    }

    const snapshotSummary = workspaceSnapshot?.prepared_expression?.rehearsal_summary
    if (!snapshotSummary) {
      return null
    }

    return {
      summary: snapshotSummary.summary,
      hotwords: snapshotSummary.hotwords,
      recurringErrors: snapshotSummary.recurring_errors,
      nextFocus: snapshotSummary.next_focus,
      model: snapshotSummary.model,
      basedOnTrainingCount: snapshotSummary.based_on_training_count,
    }
  }, [preparedContentAsset, workspaceSnapshot?.prepared_expression])

  const exerciseSelectionHint = useMemo(() => {
    if (selectableExerciseState.stage === 'unrecorded') {
      return `当前优先展示还没录过的句子，还剩 ${selectableExerciseState.unrecordedCount} 句。`
    }

    if (selectableExerciseState.stage === 'unrepeated') {
      return '这一组之前都录过了，当前先避开这轮已经练过的句子。'
    }

    return '这一组这轮都练过了，现在允许回看前面的句子继续复练。'
  }, [selectableExerciseState])

  const applyPreparedContentAsset = useCallback((asset: PreparedExpressionAsset | null) => {
    setPreparedContentAsset(asset)
    setPreparedContentTitle(asset?.draft.title ?? '')
    setPreparedContentScene(asset?.draft.scene ?? '')
    setPreparedContentSource(asset?.draft.source ?? 'manual_input')
    setPreparedContentText(asset?.draft.content ?? '')
  }, [])

  useEffect(() => {
    if (!userId) {
      return
    }

    setSessionPracticedExerciseIds([])
    void refreshLocalQueueCount()
  }, [refreshLocalQueueCount, userId])

  useEffect(() => {
    if (hasPreparedContent && practiceMode !== 'prepared_content') {
      setPracticeMode('prepared_content')
      if (preparedExpressionExercises[0]) {
        setSelectedExerciseId(preparedExpressionExercises[0].id)
      }
    }
  }, [hasPreparedContent, practiceMode, preparedExpressionExercises])

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
    if (!preparedContentStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setPreparedContentStatus(null)
    }, 3600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [preparedContentStatus])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      applyPreparedContentAsset(null)
      return
    }

    const activeUserId = userId
    let cancelled = false

    async function loadPreparedContent() {
      setIsPreparedContentLoading(true)

      try {
        const asset = await fetchPreparedExpressionAsset(activeUserId)
        if (!cancelled) {
          applyPreparedContentAsset(asset)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[contribute] failed to load prepared content asset:', error)
          setPreparedContentStatus('准备内容读取失败了，稍后再试一次。')
        }
      } finally {
        if (!cancelled) {
          setIsPreparedContentLoading(false)
        }
      }
    }

    void loadPreparedContent()

    return () => {
      cancelled = true
    }
  }, [applyPreparedContentAsset, isAuthenticated, userId])

  const handlePreparedContentFileChange = useCallback(async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      setPreparedContentText(content)
      setPreparedContentSource(file.name)
      if (!preparedContentTitle.trim()) {
        setPreparedContentTitle(stripFileExtension(file.name))
      }
      setPreparedContentStatus('准备内容已经读进来了，确认后保存就行。')
    } catch (error) {
      console.error('[contribute] failed to read prepared content file:', error)
      setPreparedContentStatus('文件读取失败了，换一个 `.md` 或 `.txt` 再试一下。')
    } finally {
      event.target.value = ''
    }
  }, [preparedContentTitle])

  const handleSavePreparedContent = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      setPreparedContentStatus('先登录后才能保存准备内容。')
      return
    }

    const content = preparedContentText.trim()
    if (!content) {
      setPreparedContentStatus('先贴入一份准备内容，再保存。')
      return
    }

    setIsSavingPreparedContent(true)
    try {
      const asset = await savePreparedExpressionAsset(userId, {
        title: preparedContentTitle.trim() || null,
        scene: preparedContentScene.trim() || null,
        source: preparedContentSource.trim() || 'manual_input',
        content,
      })

      applyPreparedContentAsset(asset)
      await refreshWorkspaceSnapshot()
      setPreparedContentStatus('准备内容已经保存，下面会直接按标点和拆句结果训练。')
    } catch (error) {
      console.error('[contribute] failed to save prepared content:', error)
      setPreparedContentStatus('准备内容保存失败了，请稍后再试。')
    } finally {
      setIsSavingPreparedContent(false)
    }
  }, [
    applyPreparedContentAsset,
    isAuthenticated,
    preparedContentScene,
    preparedContentSource,
    preparedContentText,
    preparedContentTitle,
    refreshWorkspaceSnapshot,
    userId,
  ])

  const handleSummarizePreparedContent = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      setPreparedContentStatus('先登录后才能更新总结。')
      return
    }

    if (!canRefreshCorrectionSummary) {
      setPreparedContentStatus('现在还没有训练录音，先至少录 1 句再刷新训练总结。')
      return
    }

    const content = preparedContentText.trim()
    if (!content) {
      setPreparedContentStatus('先保存一份准备内容，再更新总结。')
      return
    }

    setIsSummarizingPreparedContent(true)
    try {
      if (!preparedContentAsset || preparedContentAsset.draft.content.trim() !== content) {
        const saved = await savePreparedExpressionAsset(userId, {
          title: preparedContentTitle.trim() || null,
          scene: preparedContentScene.trim() || null,
          source: preparedContentSource.trim() || 'manual_input',
          content,
        })
        applyPreparedContentAsset(saved)
      }

      const summarized = await summarizePreparedExpressionAsset(userId, 'manual')
      applyPreparedContentAsset(summarized)
      await refreshWorkspaceSnapshot()
      setPreparedContentStatus('最新训练总结已经写回记忆和纠错上下文。')
    } catch (error) {
      console.error('[contribute] failed to summarize prepared content:', error)
      setPreparedContentStatus('总结失败了，请稍后再试。')
    } finally {
      setIsSummarizingPreparedContent(false)
    }
  }, [
    applyPreparedContentAsset,
    isAuthenticated,
    preparedContentAsset,
    preparedContentScene,
    preparedContentSource,
    preparedContentText,
    preparedContentTitle,
    refreshWorkspaceSnapshot,
    userId,
    canRefreshCorrectionSummary,
  ])

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
        attemptToPersist.sampleReview,
        saveTrigger,
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
        const syncCandidate = appendUploadedTrainingRecord(userId, uploadedRecord)

        if (isPreparedExpressionExercise(attemptToPersist.exercise) && syncCandidate.shouldSyncSummary) {
          void summarizePreparedExpressionAsset(userId, 'periodic_auto')
            .then(async (asset) => {
              applyPreparedContentAsset(asset)
              markTrainingProfileSummarySynced(
                userId,
                syncCandidate.snapshot.totalUploadedRecordings,
              )
              await refreshWorkspaceSnapshot()
              setNotice({
                tone: 'success',
                message: `已累计满 ${TRAINING_PROFILE_SYNC_INTERVAL} 条，训练总结已自动更新。`,
              })
            })
            .catch((error) => {
              console.error('[contribute] auto summarize prepared content failed:', error)
            })
        }
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
    applyPreparedContentAsset,
    canSaveTrainingSample,
    refreshWorkspaceSnapshot,
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
      const sampleReview = deriveTrainingSampleReviewDecision({
        feedback,
        sampleQuality,
        recording: result.recording,
      })
      const nextAttempt: PracticeAttempt = {
        createdAt: Date.now(),
        exercise: currentExercise,
        transcript,
        transcriptLatencyMs: result.transcriptLatencyMs,
        feedback,
        sampleQuality,
        sampleReview,
        recording: result.recording,
        uploadStatus: result.recording
          ? canSaveTrainingSample
            ? 'saving'
            : 'auth_required'
          : 'idle',
        uploadReceipt: null,
      }

      setSessionPracticedExerciseIds((currentIds) => (
        currentIds.includes(currentExercise.id)
          ? currentIds
          : [...currentIds, currentExercise.id]
      ))
      setAttempt(nextAttempt)
      setNotice({
        tone: canSaveTrainingSample && result.recording ? 'info' : 'success',
        message: canSaveTrainingSample && result.recording
          ? '录音已经收下，正在自动保存这条样本。'
          : '录音已经收下，可以直接看系统听到的结果。',
      })

      if (nextAttempt.recording && canSaveTrainingSample) {
        void persistTrainingAttempt(nextAttempt, 'auto')
      }
    } catch (error) {
      console.error('[contribute] stop recording failed:', error)
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '录音结束失败，请重新尝试。',
      })
    }
  }, [canSaveTrainingSample, currentExercise, persistTrainingAttempt, stopRecording])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在准备训练页...</div>
      </div>
    )
  }

  if (!isAuthenticated || !currentExercise) {
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
              只做三件事：保存准备内容、拆句录音、累计 50 句后自动更新纠错总结。
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
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                <Sparkles className="h-4 w-4" />
                准备内容
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">用户自己管理准备内容，不做任何场景硬编码</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                把你后面要说的全文、提纲或说明贴进来。保存后，系统会按标点和拆句结果生成可练内容，训练满 50 句后自动总结热词和高频误听。
              </p>
            </div>
            <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {correctionSummary
                ? `最近一次总结基于 ${correctionSummary.basedOnTrainingCount} 条训练样本`
                : `每满 ${TRAINING_PROFILE_SYNC_INTERVAL} 句自动更新一次`}
            </div>
          </div>

          {preparedContentStatus ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {preparedContentStatus}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-900">标题</span>
              <input
                value={preparedContentTitle}
                onChange={(event) => setPreparedContentTitle(event.target.value)}
                placeholder="例如：公开分享 / 面试自我介绍 / 就医说明"
                className="h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-900">场景标签</span>
              <input
                value={preparedContentScene}
                onChange={(event) => setPreparedContentScene(event.target.value)}
                placeholder="例如：interview / work / medical"
                className="h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => preparedContentFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-gray-800 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <UploadCloud className="h-4 w-4" />
              上传 `.md` / `.txt`
            </button>
            <input
              ref={preparedContentFileInputRef}
              type="file"
              accept=".md,.txt,.text"
              onChange={handlePreparedContentFileChange}
              className="hidden"
            />
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-600">
              来源：{preparedContentSource || 'manual_input'}
            </span>
            {isPreparedContentLoading ? (
              <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在读取已有内容
              </span>
            ) : null}
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-gray-900">全文内容</span>
            <textarea
              value={preparedContentText}
              onChange={(event) => setPreparedContentText(event.target.value)}
              placeholder="把你后面要说的全文、提纲或说明贴在这里。"
              className="min-h-[220px] w-full rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSavePreparedContent()}
              disabled={isSavingPreparedContent || isSummarizingPreparedContent}
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingPreparedContent ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              保存内容
            </button>
            <button
              type="button"
              onClick={() => void handleSummarizePreparedContent()}
              disabled={isSavingPreparedContent || isSummarizingPreparedContent || !canRefreshCorrectionSummary}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSummarizingPreparedContent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              用训练记录刷新总结
            </button>
            {!canRefreshCorrectionSummary ? (
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-600">
                先录至少 1 句，训练总结才会生成
              </span>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">拆句训练</h2>
                <p className="mt-1 text-sm text-gray-600">
                  优先展示还没录过的句子，同一轮里也不会重复。
                </p>
              </div>
              {hasPreparedContent ? (
                <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeMode('prepared_content')
                      setAttempt(null)
                      if (preparedExpressionExercises[0]) {
                        setSelectedExerciseId(preparedExpressionExercises[0].id)
                      }
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      practiceMode === 'prepared_content'
                        ? 'bg-white text-amber-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    准备内容
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeMode('sentence_corpus')
                      setAttempt(null)
                      const firstExercise = getExercisesByCategory(selectedCategory)[0]
                      if (firstExercise) {
                        setSelectedExerciseId(firstExercise.id)
                      }
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      practiceMode === 'sentence_corpus'
                        ? 'bg-white text-amber-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    通用句库
                  </button>
                </div>
              ) : null}
            </div>

            {practiceMode === 'sentence_corpus' ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MANDARIN_TRAINING_CATEGORIES.map((category) => {
                  const meta = MANDARIN_TRAINING_CATEGORY_META[category]
                  const isActive = category === selectedCategory

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category)
                        setExerciseQuery('')
                        setAttempt(null)
                        const firstExercise = getExercisesByCategory(category)[0]
                        if (firstExercise) {
                          setSelectedExerciseId(firstExercise.id)
                        }
                      }}
                      className={`rounded-[20px] border px-4 py-4 text-left transition ${
                        isActive
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                      <p className="mt-2 text-xs text-gray-600">{meta.corpusCount} 条</p>
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                value={exerciseQuery}
                onChange={(event) => setExerciseQuery(event.target.value)}
                placeholder={practiceMode === 'prepared_content' ? '搜索准备内容中的句子' : '搜索当前句库'}
                className="h-11 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
              />
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                {matchingExercises.length} 句
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-600">{exerciseSelectionHint}</p>

            <div className="mt-4 max-h-[620px] overflow-y-auto rounded-[24px] border border-stone-200 bg-stone-50 p-3">
              <div className="space-y-3">
                {visibleExercises.map((exercise) => {
                  const isActive = currentExercise.id === exercise.id
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => {
                        setSelectedExerciseId(exercise.id)
                        setAttempt(null)
                      }}
                      className={`w-full rounded-[20px] border px-4 py-4 text-left transition ${
                        isActive
                          ? 'border-amber-300 bg-white shadow-sm'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                          {isPreparedExpressionExercise(exercise)
                            ? exercise.preparedExpressionSectionTitle
                            : exercise.category}
                        </span>
                        {isActive ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                            当前句
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-base font-semibold leading-7 text-gray-900">{exercise.text}</p>
                    </button>
                  )
                })}

                {visibleExercises.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-stone-300 bg-white px-5 py-10 text-center text-sm text-gray-600">
                    当前筛选下没有句子，换个关键词试试。
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">当前句</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    训练页每次只保留标签、目标句和系统听到的结果。
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

                {currentPreparedSection ? (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">当前段落锚点</p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{currentPreparedSection.anchor_line}</p>
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
                    {isRecording ? '正在录这一句' : '点一次，直接开始练'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{recorderStatus.description}</p>
                </div>
              </div>

              <MicrophoneInputFeedback
                analyser={analyser}
                active={isRecording}
                title="录音输入质量"
                className="mt-6"
              />

              <div className="mt-6 rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-medium text-gray-900">实时识别</p>
                <p className="mt-3 min-h-16 text-base leading-7 text-gray-700">
                  {interimText || '开始录音后，这里会出现系统当前听到的内容。'}
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
                  <h2 className="text-xl font-semibold text-gray-900">本次结果</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    不做逐句 AI 点评，只看标签和系统听到的结果。
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

                  <div className="rounded-[20px] bg-sky-50 px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">系统听到</p>
                    <p className="mt-3 text-base leading-7 text-gray-900">
                      {attempt.transcript || '这次还没有稳定拿到最终结果。'}
                    </p>
                  </div>

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
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                  录完这一句后，这里只会出现标签、目标句、系统听到和保存状态。
                </div>
              )}
            </section>
          </section>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">纠错总结</h2>
              <p className="mt-1 text-sm text-gray-600">
                这里只展示每 50 句更新一次的规律、重点词和高频误听，用来服务 correction。
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {correctionSummary
                ? `${correctionSummary.model} · ${correctionSummary.basedOnTrainingCount} 条`
                : preparedExpressionTrainingCount > 0
                  ? `已有 ${preparedExpressionTrainingCount} 条训练样本`
                  : `满 ${TRAINING_PROFILE_SYNC_INTERVAL} 句后自动更新`}
            </span>
          </div>

          {correctionSummary ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[20px] bg-stone-50 px-4 py-4 lg:col-span-3">
                <p className="text-sm font-medium text-gray-900">总结</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">{correctionSummary.summary}</p>
              </div>

              <div className="rounded-[20px] bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">热词</p>
                <div className="mt-3">
                  {correctionSummary.hotwords.length > 0
                    ? renderChips(correctionSummary.hotwords, 'amber')
                    : <p className="text-sm text-gray-600">当前还没有热词。</p>}
                </div>
              </div>

              <div className="rounded-[20px] bg-sky-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">高频误听</p>
                {correctionSummary.recurringErrors.length > 0 ? (
                  <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                    {correctionSummary.recurringErrors.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-600">当前还没有累计出稳定误听。</p>
                )}
              </div>

              <div className="rounded-[20px] bg-emerald-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">下一轮重点</p>
                <div className="mt-3">
                  {correctionSummary.nextFocus.length > 0
                    ? renderChips(correctionSummary.nextFocus, 'emerald')
                    : <p className="text-sm text-gray-600">继续训练后会自动浮出下一轮重点。</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
              {preparedExpressionTrainingCount > 0
                ? '现在还没有 50 句级别的训练总结。可以继续练，或者点“用训练记录刷新总结”先手动整理一版。'
                : '现在还没有训练总结。先开始录音，系统会只根据真实训练结果回流规律、重点词和高频误听。'}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
