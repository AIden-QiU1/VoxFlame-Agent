'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ListChecks,
  Mic,
  SlidersHorizontal,
  UploadCloud,
} from 'lucide-react'
import { PWAStatusCenter } from '@/components/pwa/PWAStatusCenter'
import { SessionReadinessPanel } from '@/components/runtime/SessionReadinessPanel'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useMandarinTrainingSession } from '@/hooks/useMandarinTrainingSession'
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
import { memoryService } from '@/lib/memory/memory-service'
import type {
  VoxFlameConsentScope,
  VoxFlameRecordingEnvelope,
} from '@/lib/recording/recording-contract'
import {
  type MandarinTrainingFeedback,
  analyzeMandarinAttempt,
} from '@/lib/training/mandarin-feedback'
import {
  assessTrainingSampleQuality,
  type TrainingSampleQuality,
} from '@/lib/training/training-sample-quality'
import {
  DEFAULT_TRAINING_GUIDANCE_PROFILE,
  TRAINING_ETIOLOGY_OPTIONS,
  TRAINING_PRIORITY_OPTIONS,
  TRAINING_SEVERITY_OPTIONS,
  buildTrainingGuidanceContext,
  buildTrainingGuidanceProfileMetadata,
  getTrainingGuidanceProfile,
  saveTrainingGuidanceProfile,
  type TrainingGuidanceProfile,
} from '@/lib/training/training-guidance-profile'
import {
  appendUploadedTrainingRecord,
  buildTrainingProfileMemorySummary,
  buildTrainingVoiceProfilePayload,
  markTrainingProfileSummarySynced,
} from '@/lib/training/training-profile'
import {
  defaultCapabilitiesForMode,
  defaultStrategyForMode,
  type RtcScene,
} from '@/lib/realtime-audio/session-contract'
import {
  deriveTrainingSampleReviewDecision,
  type TrainingSampleReviewDecision,
} from '@/lib/training/training-sample-review'
import { buildTrainingSampleLineage } from '@/lib/training/training-sample-lineage'

type AttemptUploadStatus =
  | 'idle'
  | 'saving'
  | 'uploaded'
  | 'retrying'
  | 'auth_required'
  | 'failed'

type AttemptSaveTrigger = 'auto' | 'manual'

interface PracticeAttempt {
  createdAt: number
  exercise: MandarinTrainingExercise
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

const DEFAULT_VISIBLE_SENTENCES = 60
const SEARCH_VISIBLE_SENTENCES = 80

const FEEDBACK_STATUS_LABELS: Record<MandarinTrainingFeedback['status'], string> = {
  excellent: '已经很接近了',
  close: '差一点就稳了',
  retry: '先拆开再练',
  unclear: '这次没稳定听清',
}

const UPLOAD_STATUS_LABELS: Record<AttemptUploadStatus, string> = {
  idle: '这条录音还没进入保存流程',
  saving: '正在自动保存',
  uploaded: '已写入训练语料',
  retrying: '正在后台自动补登',
  auth_required: '需要重新登录恢复自动保存',
  failed: '云端登记暂时异常',
}

const SAMPLE_QUALITY_LABELS: Record<TrainingSampleQuality['tier'], string> = {
  ready: '可直接训练',
  usable: '可保留继续练',
  review: '建议回看后补录',
  retry: '建议马上重录',
}

const SAMPLE_REVIEW_LABELS: Record<TrainingSampleReviewDecision['evaluationStatus'], string> = {
  ready: '自动纳入样本池',
  sampled_for_review: '进入复核队列',
  retry_recommended: '已上传，但建议后续补录',
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
  exercise: MandarinTrainingExercise,
  recording: VoxFlameRecordingEnvelope,
  transcript: string,
  transcriptLatencyMs: number,
  feedback: MandarinTrainingFeedback,
  sampleQuality: TrainingSampleQuality,
  sampleReview: TrainingSampleReviewDecision,
  guidanceProfile: TrainingGuidanceProfile,
  saveTrigger: AttemptSaveTrigger,
): Record<string, unknown> {
  const lineage = buildTrainingSampleLineage(exercise, recording)

  return {
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
    target_pinyin: feedback.targetPinyinDisplay,
    heard_pinyin: feedback.heardPinyinDisplay,
    focus_syllables: feedback.focusSyllables,
    articulation_tips: feedback.articulationTips,
    pronunciation_initial_pairs: feedback.pronunciationInitialPairs,
    pronunciation_final_pairs: feedback.pronunciationFinalPairs,
    pronunciation_tone_pairs: feedback.pronunciationTonePairs,
    pronunciation_targets: feedback.pronunciationTargets,
    pronunciation_summary: feedback.pronunciationSummary,
    guidance_profile: buildTrainingGuidanceProfileMetadata(guidanceProfile),
    consent_version: LEGAL_CONSENT_VERSION,
    source_label: 'training_workspace_v2',
    save_trigger: saveTrigger,
    auto_saved: saveTrigger === 'auto',
  }
}

function buildTrainingFeedbackRequestPayload(
  exercise: MandarinTrainingExercise,
  transcript: string,
  feedback: MandarinTrainingFeedback,
  guidanceProfile: TrainingGuidanceProfile,
): Record<string, unknown> {
  return {
    exercise_id: exercise.id,
    exercise_text: exercise.text,
    exercise_category: exercise.category,
    recognized_text: transcript,
    feedback_status: feedback.status,
    focus_tags: feedback.focusSyllables,
    pronunciation_summary: feedback.pronunciationSummary,
    guidance_profile: buildTrainingGuidanceProfileMetadata(guidanceProfile),
  }
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
    focusTags: [attempt.exercise.category],
    focusSyllables: attempt.feedback.focusSyllables,
    initialPairs: attempt.feedback.pronunciationInitialPairs,
    finalPairs: attempt.feedback.pronunciationFinalPairs,
    tonePairs: attempt.feedback.pronunciationTonePairs,
    articulationTips: attempt.feedback.articulationTips,
    keywords: [],
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
      description: '按正常节奏读完这句，然后点击停止看反馈。',
    }
  }

  if (status === 'processing') {
    return {
      label: '正在收结果',
      description: '正在等待最终 transcript 和录音 envelope 收齐。',
    }
  }

  if (status === 'ready') {
    return {
      label: '可以开始',
      description: '句子和录音按钮都已就绪，直接点一次就能开练。',
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
      description: sessionError || '当前训练链路有异常，请先看下面的提示。',
    }
  }

  return {
    label: '等待你开始',
    description: '先选一句，再点录音。训练页不会先让你读很多说明。',
  }
}

export default function ContributePage() {
  const { user, userId, isLoading, isAuthenticated } = useAuth({
    redirectToLogin: true,
    nextPath: '/contribute',
  })
  const {
    status,
    interimText,
    error: sessionError,
    latestTrainingFeedback,
    latestVoiceProfileSync,
    isRecording,
    isProcessing,
    sessionIntent,
    sessionReadiness,
    grantedCapabilities,
    startRecording,
    stopRecording,
    requestTrainingFeedback,
    syncVoiceProfile,
    disconnect,
  } = useMandarinTrainingSession({
    userId: userId ?? undefined,
  })
  const {
    uploadRecording,
    refreshLocalQueueCount,
    isUploading,
    lastError,
  } = useVoiceUpload()

  const [selectedCategory, setSelectedCategory] = useState<MandarinTrainingCategory>(
    MANDARIN_TRAINING_CATEGORIES[0],
  )
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    getExercisesByCategory(MANDARIN_TRAINING_CATEGORIES[0])[0]?.id ?? '',
  )
  const [exerciseQuery, setExerciseQuery] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [guidanceProfile, setGuidanceProfile] = useState<TrainingGuidanceProfile>(
    DEFAULT_TRAINING_GUIDANCE_PROFILE,
  )
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const disconnectRef = useRef(disconnect)
  disconnectRef.current = disconnect

  const canSaveTrainingSample = hasRequiredLegalConsent(user)
  const recorderStatus = getRecorderStatusCopy(status, sessionError)
  const guidanceContext = useMemo(
    () => buildTrainingGuidanceContext(guidanceProfile),
    [guidanceProfile],
  )
  const categoryExercises = useMemo(
    () => getExercisesByCategory(selectedCategory),
    [selectedCategory],
  )
  const normalizedQuery = exerciseQuery.trim().toLowerCase()
  const matchingExercises = useMemo(() => {
    if (!normalizedQuery) {
      return categoryExercises
    }

    return categoryExercises.filter((exercise) => (
      exercise.text.includes(normalizedQuery) ||
      exercise.pinyin.toLowerCase().includes(normalizedQuery)
    ))
  }, [categoryExercises, normalizedQuery])
  const visibleExercises = useMemo(
    () => matchingExercises.slice(0, normalizedQuery ? SEARCH_VISIBLE_SENTENCES : DEFAULT_VISIBLE_SENTENCES),
    [matchingExercises, normalizedQuery],
  )
  const currentExercise = useMemo(
    () => (
      categoryExercises.find((exercise) => exercise.id === selectedExerciseId) ??
      visibleExercises[0] ??
      categoryExercises[0] ??
      getExercisesByCategory(MANDARIN_TRAINING_CATEGORIES[0])[0]
    ),
    [categoryExercises, selectedExerciseId, visibleExercises],
  )
  const currentCategoryMeta = MANDARIN_TRAINING_CATEGORY_META[selectedCategory]
  const runtimeScene = useMemo<RtcScene | undefined>(() => {
    if (selectedCategory === '看病与求助') {
      return 'medical'
    }

    if (selectedCategory === '日常与出行') {
      return 'outing'
    }

    if (selectedCategory === '人群与角色') {
      return 'home'
    }

    return undefined
  }, [selectedCategory])
  const plannedTrainingIntent = useMemo(() => ({
    surface: 'training_workspace' as const,
    mode: 'training' as const,
    sessionStrategy: defaultStrategyForMode('training'),
    requestedCapabilities: defaultCapabilitiesForMode('training'),
    scene: runtimeScene,
  }), [runtimeScene])
  const agentFeedback = useMemo(() => {
    if (!attempt || !latestTrainingFeedback) {
      return null
    }

    return latestTrainingFeedback.exerciseId === attempt.exercise.id
      ? latestTrainingFeedback
      : null
  }, [attempt, latestTrainingFeedback])
  const profileSyncResult = useMemo(() => {
    if (!attempt || !latestVoiceProfileSync) {
      return null
    }

    return latestVoiceProfileSync.exerciseId === attempt.exercise.id
      ? latestVoiceProfileSync
      : null
  }, [attempt, latestVoiceProfileSync])

  useEffect(() => {
    if (!userId) {
      return
    }

    memoryService.init(userId)
    setGuidanceProfile(getTrainingGuidanceProfile(userId))
    void refreshLocalQueueCount()
  }, [refreshLocalQueueCount, userId])

  useEffect(() => {
    if (!userId || isLoading) {
      return
    }

    saveTrainingGuidanceProfile(userId, guidanceProfile)
  }, [guidanceProfile, isLoading, userId])

  useEffect(() => {
    return () => {
      disconnectRef.current()
    }
  }, [])

  useEffect(() => {
    if (!categoryExercises.length) {
      return
    }

    const stillInCategory = categoryExercises.some((exercise) => exercise.id === selectedExerciseId)
    if (!stillInCategory) {
      setSelectedExerciseId(categoryExercises[0].id)
      return
    }

    if (
      normalizedQuery &&
      visibleExercises.length > 0 &&
      !visibleExercises.some((exercise) => exercise.id === selectedExerciseId)
    ) {
      setSelectedExerciseId(visibleExercises[0].id)
    }
  }, [categoryExercises, normalizedQuery, selectedExerciseId, visibleExercises])

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

  const handleSelectCategory = useCallback((category: MandarinTrainingCategory) => {
    setSelectedCategory(category)
    setExerciseQuery('')
    setAttempt(null)
    const firstExercise = getExercisesByCategory(category)[0]
    if (firstExercise) {
      setSelectedExerciseId(firstExercise.id)
    }
  }, [])

  const handleSelectExercise = useCallback((exerciseId: string) => {
    setSelectedExerciseId(exerciseId)
    setAttempt(null)
    setNotice(null)
  }, [])

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
        message: '这次录音还没有完整的音频文件，暂时无法保存。',
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
        guidanceProfile,
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
        syncVoiceProfile(
          buildTrainingVoiceProfilePayload(syncCandidate.snapshot, guidanceProfile),
        )

        if (syncCandidate.shouldSyncSummary) {
          const summary = buildTrainingProfileMemorySummary(syncCandidate.snapshot)
          memoryService.addMemoryEntry({
            type: 'semantic',
            content: summary.content,
            metadata: summary.metadata,
            sessionMetadata: {
              kind: 'training',
              source: 'training_profile_summary',
              category: attemptToPersist.exercise.category,
            },
          })
          markTrainingProfileSummarySynced(
            userId,
            syncCandidate.snapshot.totalUploadedRecordings,
          )
        }
      }

      setNotice({
        tone: 'success',
        message: saveTrigger === 'auto'
          ? `${attemptToPersist.sampleQuality.summary} 已按目标句 + 录音音频写入训练语料。`
          : '这条录音已经写入训练语料，后面的画像和 manifest 可以继续沿这条资产往下走。',
      })
      return
    }

    if (result.status === 'retrying') {
      setNotice({
        tone: 'info',
        message: '音频已经收下了，云端登记会在后台自动补齐，不需要手动同步。',
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
    guidanceProfile,
    syncVoiceProfile,
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

      setAttempt(nextAttempt)
      requestTrainingFeedback(
        buildTrainingFeedbackRequestPayload(
          currentExercise,
          transcript,
          feedback,
          guidanceProfile,
        ),
      )
      setNotice({
        tone: canSaveTrainingSample && result.recording
          ? 'info'
          : feedback.status === 'excellent'
            ? 'success'
            : 'info',
        message: canSaveTrainingSample && result.recording
          ? sampleQuality.action === 'retry'
            ? '反馈已经出来了，这条录音会自动保存，但更建议你马上补一条更稳的版本。'
            : '反馈已经出来了，这条录音会自动保存成监督训练样本。'
          : feedback.status === 'excellent'
            ? '这句已经很接近了，可以继续换一句。'
            : '反馈已经出来了，先盯一个点，不用一次全改。',
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
  }, [canSaveTrainingSample, currentExercise, guidanceProfile, persistTrainingAttempt, requestTrainingFeedback, stopRecording])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_54%,_#f6f4ee_100%)] px-4 py-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-20 rounded-[32px] bg-white shadow-[0_20px_60px_rgba(120,53,15,0.06)]" />
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="h-[620px] rounded-[32px] bg-white shadow-[0_20px_60px_rgba(120,53,15,0.06)]" />
            <div className="h-[620px] rounded-[32px] bg-white shadow-[0_20px_60px_rgba(120,53,15,0.06)]" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !currentExercise) {
    return null
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.10),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.10),_transparent_22%),linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_50%,_#f5f3ed_100%)]">
      <nav className="border-b border-amber-100 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3 text-gray-900">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-lg font-semibold text-amber-700">
              燃
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700">VoxFlame</p>
              <p className="text-lg font-semibold">训练工作台</p>
            </div>
          </Link>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700">
            当前账号：{user?.email || '已登录用户'}
          </div>
        </div>
      </nav>

      {notice ? (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {notice.message}
        </div>
      ) : null}

      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-8">
        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-amber-700">真实录音分类</p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">先选一句现在真会说出口的话</h2>
              </div>
              <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                {currentCategoryMeta.corpusCount} 句真实语料
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-5">
              {MANDARIN_TRAINING_CATEGORIES.map((category) => {
                const meta = MANDARIN_TRAINING_CATEGORY_META[category]
                const isActive = category === selectedCategory
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleSelectCategory(category)}
                    className={`rounded-[28px] border px-4 py-4 text-left transition ${
                      isActive
                        ? 'border-amber-300 bg-amber-50 shadow-[0_12px_36px_rgba(245,158,11,0.10)]'
                        : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                    <p className="mt-1 text-xs text-gray-600">{meta.shortLabel}</p>
                    <p className="mt-3 text-xs font-medium text-amber-800">{meta.corpusCount} 条</p>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 rounded-[28px] border border-stone-200 bg-stone-50 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentCategoryMeta.label}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{currentCategoryMeta.description}</p>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-sm text-gray-700">
                  示例：{currentCategoryMeta.examples.slice(0, 2).join(' / ')}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <label className="flex-1">
                <span className="sr-only">搜索句子</span>
                <Input
                  value={exerciseQuery}
                  onChange={(event) => setExerciseQuery(event.target.value)}
                  placeholder="在当前分类里搜索句子或拼音"
                  className="h-11 rounded-2xl border-stone-200 bg-stone-50"
                />
              </label>
              <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                {matchingExercises.length > visibleExercises.length
                  ? `共 ${matchingExercises.length} 句，当前显示前 ${visibleExercises.length} 句`
                  : `当前可选 ${matchingExercises.length} 句`}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="max-h-[560px] overflow-y-auto rounded-[28px] border border-stone-200 bg-[#fffdfa] p-3">
                <div className="space-y-3">
                  {visibleExercises.map((exercise) => {
                    const isActive = currentExercise.id === exercise.id
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => handleSelectExercise(exercise.id)}
                        className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                          isActive
                            ? 'border-amber-300 bg-amber-50 shadow-[0_12px_30px_rgba(245,158,11,0.10)]'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                            {exercise.category}
                          </span>
                          {isActive ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                              当前句
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-lg font-semibold leading-7 text-gray-900">{exercise.text}</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">{exercise.pinyin}</p>
                      </button>
                    )
                  })}
                  {visibleExercises.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-5 py-10 text-center text-sm text-gray-600">
                      当前筛选下没有匹配句子，换个关键词试试。
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[28px] border border-stone-200 bg-white p-5">
                <p className="text-sm font-medium text-gray-900">当前句子的训练重点</p>
                <p className="mt-3 text-2xl font-semibold leading-snug text-gray-900">{currentExercise.text}</p>
                <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-700">
                  {currentExercise.pinyin}
                </p>
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">先这样练</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{currentCategoryMeta.helper}</p>
                </div>
                <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">分类提醒</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                    {currentCategoryMeta.trainingTips.slice(0, 2).map((tip) => (
                      <li key={tip}>- {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:h-fit">
            <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-700">大录音区</p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900">录音、训练、反馈都围着这一句转</h2>
                </div>
                <div className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-gray-700">
                  {isRecording ? formatRecordingTime(recordingSeconds) : recorderStatus.label}
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-amber-200 bg-[#fff9ef] px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                      {currentExercise.category}
                    </span>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                      当前目标句
                    </span>
                  </div>
                  <div className="flex gap-3">
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
                      换一句
                    </button>
                  </div>
                </div>

                <p className="mt-5 text-3xl font-semibold leading-snug text-gray-900">{currentExercise.text}</p>
                <p className="mt-3 rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-stone-700">
                  {currentExercise.pinyin}
                </p>
                <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">这轮训练重点</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{guidanceContext.evidenceSummary}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                <button
                  type="button"
                  onClick={isRecording ? () => void handleStopRecording() : () => void handleStartRecording()}
                  disabled={isUploading || isProcessing || status === 'connecting'}
                  className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-[0_16px_40px_rgba(120,53,15,0.20)] transition ${
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
                    {isRecording ? '正在收这一句的声音' : '点一下，直接开始练这一句'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{recorderStatus.description}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-medium text-gray-900">实时识别</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  这里先显示系统当前听到的内容。你点停止后，下面的反馈区会切到最终结果。
                </p>
                <p className="mt-4 min-h-20 text-base leading-7 text-gray-700">
                  {interimText || '开始录音后，这里会出现实时 transcript。'}
                </p>
              </div>

              {sessionError ? (
                <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-800">
                  {sessionError}
                </div>
              ) : null}

              <SessionReadinessPanel
                intent={sessionIntent}
                readiness={sessionReadiness}
                grantedCapabilities={grantedCapabilities}
                plannedIntent={plannedTrainingIntent}
                title="训练前准备"
                className="mt-4"
              />
            </section>
            <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
              {attempt ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ListChecks className="mt-1 h-5 w-5 text-amber-700" />
                      <div>
                        <p className="text-sm font-medium text-amber-700">紧贴录音的反馈区</p>
                        <h2 className="mt-1 text-2xl font-semibold text-gray-900">停录后先看这里，不用往下翻很远</h2>
                      </div>
                    </div>
                    <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-gray-700">
                      {FEEDBACK_STATUS_LABELS[attempt.feedback.status]}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl bg-stone-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">目标句</p>
                      <p className="mt-3 text-lg leading-7 text-gray-900">{attempt.exercise.text}</p>
                      <p className="mt-3 text-sm leading-6 text-stone-600">{attempt.feedback.targetPinyinDisplay}</p>
                    </div>
                    <div className="rounded-3xl bg-amber-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">系统听到的内容</p>
                      <p className="mt-3 text-lg leading-7 text-gray-900">
                        {attempt.transcript || '这次还没有稳定拿到最终结果。'}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-stone-600">{attempt.feedback.heardPinyinDisplay}</p>
                    </div>
                    <div className="rounded-3xl bg-sky-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">先盯这一步</p>
                      <p className="mt-3 text-lg leading-7 text-gray-900">
                        {agentFeedback?.nextStep || attempt.feedback.suggestions[0]}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-sky-900">
                        {agentFeedback?.encouragement || '先把动作做慢、做实，再决定要不要继续录下一遍。'}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-emerald-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">上传状态</p>
                      <p className="mt-3 text-lg leading-7 text-gray-900">
                        {SAMPLE_QUALITY_LABELS[attempt.sampleQuality.tier]}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-emerald-900">
                        这块只影响后台整理，不影响这条完整录音进入训练样本链路。
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">总结</p>
                      <p className="mt-3 text-sm leading-6 text-gray-700">{attempt.feedback.summary}</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs uppercase text-stone-500">漏掉的字</p>
                          <p className="mt-2 text-sm text-gray-700">
                            {attempt.feedback.missingChars.length > 0
                              ? attempt.feedback.missingChars.join('、')
                              : '无'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs uppercase text-stone-500">多出来的字</p>
                          <p className="mt-2 text-sm text-gray-700">
                            {attempt.feedback.extraChars.length > 0
                              ? attempt.feedback.extraChars.join('、')
                              : '无'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-5">
                        <p className="text-sm font-medium text-gray-900">先盯这几个字</p>
                        <p className="mt-3 text-sm leading-6 text-gray-700">
                          {agentFeedback?.primaryFocus || attempt.feedback.focusSyllables.join('、') || '先看整句节奏'}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-5">
                        <p className="text-sm font-medium text-gray-900">口型 / 舌位重点</p>
                        <p className="mt-3 text-sm leading-6 text-gray-700">
                          {agentFeedback?.primaryPinyin || attempt.feedback.pronunciationTargets.join('、') || '这次没有稳定发现固定混淆'}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5">
                        <p className="text-sm font-medium text-gray-900">嘴巴和气息怎么做</p>
                        <p className="mt-3 text-sm leading-6 text-gray-700">
                          {agentFeedback?.articulationTip || attempt.feedback.articulationTips[0] || guidanceContext.coachingPlan[1]}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">下一次怎么练</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                        {(agentFeedback
                          ? [agentFeedback.summary, agentFeedback.nextStep, guidanceContext.coachingPlan[2]]
                          : attempt.feedback.suggestions
                        ).filter(Boolean).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">系统为什么会这样听</p>
                      <p className="mt-3 text-sm leading-6 text-gray-700">
                        {attempt.feedback.pronunciationSummary}
                      </p>
                    </div>

                    {attempt.recording ? (
                      <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-gray-900">训练资产状态</p>
                          <span className="rounded-full bg-white px-3 py-1 text-sm text-gray-700">
                            {UPLOAD_STATUS_LABELS[attempt.uploadStatus]}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs uppercase text-stone-500">录音 ID</p>
                            <p className="mt-2 break-all font-mono text-sm text-gray-700">{attempt.recording.recordingId}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs uppercase text-stone-500">会话 ID</p>
                            <p className="mt-2 break-all font-mono text-sm text-gray-700">{attempt.recording.sessionId}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs uppercase text-stone-500">采样率</p>
                            <p className="mt-2 text-sm text-gray-700">{attempt.recording.audio.sampleRate} Hz</p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs uppercase text-stone-500">授权范围</p>
                            <p className="mt-2 text-sm text-gray-700">training_only</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium text-gray-900">数据侧备注，不影响这条录音上传</p>
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                              {SAMPLE_QUALITY_LABELS[attempt.sampleQuality.tier]}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-gray-700">
                            这些信息主要给系统做后续整理和复核参考，不是在判断你“值不值得上传”。只要这条录音完整，它就会进入训练样本链路。
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-stone-50 px-4 py-4">
                              <p className="text-xs uppercase text-stone-500">录音时长</p>
                              <p className="mt-2 text-sm text-gray-700">{formatRecordingTime(Math.round(attempt.recording.audio.durationSeconds))}</p>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-4 py-4">
                              <p className="text-xs uppercase text-stone-500">识别覆盖</p>
                              <p className="mt-2 text-sm text-gray-700">{Math.round(attempt.sampleQuality.coverageRatio * 100)}%</p>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-4 py-4">
                              <p className="text-xs uppercase text-stone-500">系统返回速度</p>
                              <p className="mt-2 text-sm text-gray-700">{(attempt.transcriptLatencyMs / 1000).toFixed(1)}s</p>
                            </div>
                          </div>
                          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
                            {attempt.sampleQuality.reasons.slice(0, 3).map((reason) => (
                              <li key={reason}>- {reason}</li>
                            ))}
                          </ul>
                          <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4">
                            <p className="text-xs uppercase text-stone-500">后台备注</p>
                            <p className="mt-2 text-sm font-medium text-gray-800">
                              {SAMPLE_REVIEW_LABELS[attempt.sampleReview.evaluationStatus]}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-gray-700">
                              {attempt.sampleReview.summary} 要不要继续再录，交给你自己决定。
                            </p>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-stone-600">
                            同一句可以反复练并保留多条样本；只有同一条录音重复上传时，系统才会按录音 ID 安全去重。
                          </p>
                        </div>

                        {attempt.uploadReceipt?.manifestPath ? (
                          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                            <p className="text-xs uppercase text-emerald-700">Manifest</p>
                            <p className="mt-2 break-all font-mono text-sm text-emerald-900">
                              {attempt.uploadReceipt.manifestPath}
                            </p>
                          </div>
                        ) : null}

                        {profileSyncResult ? (
                          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-900">
                            训练画像已收到这次更新结果：热词 {profileSyncResult.hotwordCount} 个，混淆模式 {profileSyncResult.confusionPatternsCount} 项。
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {agentFeedback ? (
                      <div className="rounded-3xl border border-amber-200 bg-[#fffaf0] px-5 py-5">
                        <p className="text-sm font-medium text-gray-900">训练反馈</p>
                        <p className="mt-3 text-sm leading-6 text-gray-700">{agentFeedback.summary}</p>
                        <p className="mt-3 text-sm leading-6 text-gray-700">下一步：{agentFeedback.nextStep}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleStartRecording()}
                      disabled={isRecording || isUploading || isProcessing}
                      className="rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      再录一次这句
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(1)}
                      className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-stone-400 hover:bg-stone-50"
                    >
                      换一句继续练
                    </button>
                    {attempt.uploadStatus === 'saving' ? (
                      <span className="rounded-full bg-amber-100 px-5 py-3 text-sm font-medium text-amber-900">
                        正在自动保存这条录音
                      </span>
                    ) : attempt.uploadStatus === 'retrying' || attempt.uploadStatus === 'failed' ? (
                      <span className="rounded-full bg-amber-100 px-5 py-3 text-sm font-medium text-amber-900">
                        正在后台自动补齐云端登记
                      </span>
                    ) : attempt.uploadStatus === 'auth_required' ? (
                      <span className="rounded-full bg-stone-100 px-5 py-3 text-sm font-medium text-stone-700">
                        重新登录后会恢复自动保存
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-5 py-3 text-sm font-medium text-emerald-800">
                        这条录音已经进入训练语料
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-start gap-3">
                    <ListChecks className="mt-1 h-5 w-5 text-amber-700" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">反馈区预留在录音旁边</p>
                      <h2 className="mt-1 text-2xl font-semibold text-gray-900">录完这一句后，反馈就在下面出现</h2>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl bg-stone-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">系统听到的内容</p>
                      <p className="mt-3 text-sm leading-6 text-gray-600">停录后直接看到 transcript，不需要切到别的地方。</p>
                    </div>
                    <div className="rounded-3xl bg-sky-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">最该先改的地方</p>
                      <p className="mt-3 text-sm leading-6 text-gray-600">会先告诉你应该盯哪几个字、哪组声母或韵母，不会先给一堆旧历史。</p>
                    </div>
                    <div className="rounded-3xl bg-amber-50 px-5 py-5">
                      <p className="text-sm font-medium text-gray-900">样本质量与资产状态</p>
                      <p className="mt-3 text-sm leading-6 text-gray-600">录完后这里会同时告诉你它是否已自动落盘，若云端登记短暂波动也会在后台自动补齐，不再让你手动同步。</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-amber-700" />
              <div>
                <p className="text-sm font-medium text-amber-700">训练资产状态</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">录完就直接走自动上传，不再让你手动处理</h2>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-stone-50 px-5 py-5">
              <p className="text-sm font-medium text-gray-900">当前策略</p>
              <p className="mt-3 text-lg font-semibold text-gray-900">录音结束后立即上传音频，并自动补齐 manifest / receipt。</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                训练页不再把“留在本地、手动同步、再点一次上传”放进主路径。只要音频完整，就会继续走上传链路；识别差异只用于训练反馈和后续整理，不会拿来挡数据入链。即使云端登记短暂波动，也会优先转成后台自动补登。
              </p>
            </div>

            {!canSaveTrainingSample ? (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                当前账号还没有新的授权确认记录。重新登录一次后，训练页就不会再重复问，自动保存也会直接恢复。
              </div>
            ) : null}

            {lastError ? (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                {lastError}
              </div>
            ) : null}
          </section>

          <section className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="h-5 w-5 text-amber-700" />
              <div>
                <p className="text-sm font-medium text-amber-700">训练设置</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">只保留会直接影响反馈的设置</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-900">病因背景</span>
                <select
                  value={guidanceProfile.etiology}
                  onChange={(event) => {
                    setGuidanceProfile((current) => ({
                      ...current,
                      etiology: event.target.value as TrainingGuidanceProfile['etiology'],
                    }))
                  }}
                  className="mt-2 h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-800"
                >
                  {TRAINING_ETIOLOGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-900">当前严重程度</span>
                <select
                  value={guidanceProfile.severity}
                  onChange={(event) => {
                    setGuidanceProfile((current) => ({
                      ...current,
                      severity: event.target.value as TrainingGuidanceProfile['severity'],
                    }))
                  }}
                  className="mt-2 h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-800"
                >
                  {TRAINING_SEVERITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-900">这轮最先改哪类</span>
                <select
                  value={guidanceProfile.priority}
                  onChange={(event) => {
                    setGuidanceProfile((current) => ({
                      ...current,
                      priority: event.target.value as TrainingGuidanceProfile['priority'],
                    }))
                  }}
                  className="mt-2 h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-800"
                >
                  {TRAINING_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5">
              <p className="text-sm font-medium text-gray-900">这轮我会先按这个方向提醒你</p>
              <p className="mt-3 text-sm leading-6 text-gray-700">{guidanceContext.evidenceSummary}</p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
                {guidanceContext.coachingPlan.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </section>
        </section>
      </main>

      <PWAStatusCenter />
    </div>
  )
}
