'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { InstallPrompt, OfflineNotice, UpdatePrompt } from '@/components/pwa'
import { useAuth } from '@/hooks/useAuth'
import { useContributor } from '@/hooks/useContributor'
import { useMandarinTrainingSession } from '@/hooks/useMandarinTrainingSession'
import { useVoiceUpload } from '@/hooks/useVoiceUpload'
import {
  MANDARIN_TRAINING_CATEGORIES,
  MANDARIN_TRAINING_EXERCISES,
  MandarinTrainingCategory,
  MandarinTrainingExercise,
  getExercisesByCategory,
} from '@/lib/corpus/mandarin-training'
import {
  MandarinTrainingFeedback,
  analyzeMandarinAttempt,
} from '@/lib/training/mandarin-feedback'
import { memoryService } from '@/lib/memory/memory-service'

type TrainingCategoryFilter = MandarinTrainingCategory | 'all'

interface RecordingPayload {
  blob: Blob
  duration: number
  sampleRate: number
}

interface TrainingAttempt {
  exerciseId: string
  transcript: string
  feedback: MandarinTrainingFeedback
  recording: RecordingPayload | null
  uploaded: boolean
}

const DIFFICULTY_LABELS = {
  easy: '容易',
  medium: '中等',
  hard: '较难',
} as const

const FEEDBACK_STATUS_LABELS = {
  excellent: '匹配良好',
  close: '接近目标句',
  retry: '建议重练',
  unclear: '系统未稳定听清',
} as const

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function buildUploadMetadata(
  exercise: MandarinTrainingExercise,
  transcript: string,
  feedback: MandarinTrainingFeedback,
  consentToUpload: boolean,
) {
  return {
    training_mode: 'mandarin_practice',
    exercise_id: exercise.id,
    exercise_text: exercise.text,
    exercise_category: exercise.category,
    focus_tags: exercise.focusTags,
    keywords: exercise.keywords,
    recognized_text: transcript,
    feedback_status: feedback.status,
    missing_chars: feedback.missingChars,
    extra_chars: feedback.extraChars,
    source_label: exercise.source.label,
    source_url: exercise.source.url,
    upload_consent: consentToUpload,
  }
}

function buildTrainingMemoryContent(
  exercise: MandarinTrainingExercise,
  transcript: string,
  feedback: MandarinTrainingFeedback,
): string {
  const transcriptLabel = transcript || '系统未稳定听清'
  return `训练记录：目标句“${exercise.text}”；系统听到“${transcriptLabel}”；结果为${FEEDBACK_STATUS_LABELS[feedback.status]}；重点标签：${exercise.focusTags.join('、')}。`
}

function buildTrainingResultPayload(
  exercise: MandarinTrainingExercise,
  transcript: string,
  feedback: MandarinTrainingFeedback,
  consentToUpload: boolean,
) {
  return {
    exercise_id: exercise.id,
    exercise_text: exercise.text,
    exercise_category: exercise.category,
    keywords: exercise.keywords,
    focus_tags: exercise.focusTags,
    recognized_text: transcript,
    feedback_status: feedback.status,
    missing_chars: feedback.missingChars,
    extra_chars: feedback.extraChars,
    upload_consent: consentToUpload,
    source_label: exercise.source.label,
    source_url: exercise.source.url,
  }
}

export default function ContributePage() {
  const { userId } = useAuth()
  const { contributor, anonymousId, displayName, refreshStats } = useContributor()
  const {
    uploadRecording,
    isUploading,
    uploadProgress,
    lastError,
  } = useVoiceUpload()
  const {
    status,
    interimText,
    error: sessionError,
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    sendTrainingResult,
    disconnect,
  } = useMandarinTrainingSession()

  const [selectedCategory, setSelectedCategory] = useState<TrainingCategoryFilter>('all')
  const [currentExerciseId, setCurrentExerciseId] = useState(MANDARIN_TRAINING_EXERCISES[0]?.id ?? '')
  const [recordingTime, setRecordingTime] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [consentToUpload, setConsentToUpload] = useState(false)
  const [attempt, setAttempt] = useState<TrainingAttempt | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const memoryOwnerId = userId || anonymousId || null

  const filteredExercises = getExercisesByCategory(selectedCategory)
  const currentExercise =
    filteredExercises.find((exercise) => exercise.id === currentExerciseId) ??
    filteredExercises[0] ??
    MANDARIN_TRAINING_EXERCISES[0]

  useEffect(() => {
    if (!currentExercise) {
      return
    }

    const existsInCurrentFilter = filteredExercises.some((exercise) => exercise.id === currentExerciseId)
    if (!existsInCurrentFilter) {
      setCurrentExerciseId(currentExercise.id)
    }
  }, [currentExercise, currentExerciseId, filteredExercises])

  useEffect(() => {
    if (!isRecording) {
      return
    }

    setRecordingTime(0)
    const timer = window.setInterval(() => {
      setRecordingTime((value) => value + 1)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isRecording])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  useEffect(() => {
    if (!memoryOwnerId) {
      return
    }

    memoryService.init(memoryOwnerId)
  }, [memoryOwnerId])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setToastMessage(null)
    }, 3200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [toastMessage])

  async function uploadAttempt(
    targetExercise: MandarinTrainingExercise,
    targetAttempt: TrainingAttempt,
    fromAutoUpload: boolean,
  ) {
    if (!targetAttempt.recording) {
      setToastMessage('这次录音没有可上传的音频文件。')
      return
    }

    const effectiveConsent = fromAutoUpload ? consentToUpload : true

    const success = await uploadRecording(targetAttempt.recording.blob, {
      text: targetExercise.text,
      duration: targetAttempt.recording.duration,
      source: 'guided_recording',
      sentenceId: targetExercise.id,
      metadata: buildUploadMetadata(
        targetExercise,
        targetAttempt.transcript,
        targetAttempt.feedback,
        effectiveConsent,
      ),
    })

    if (!success) {
      setToastMessage('上传失败，请稍后重试。')
      return
    }

    setAttempt((prev) => {
      if (!prev || prev.exerciseId !== targetExercise.id) {
        return prev
      }

      return {
        ...prev,
        uploaded: true,
      }
    })
    await refreshStats()
    setToastMessage(fromAutoUpload ? '录音已按你的授权加入匿名语料。' : '这次录音已加入匿名语料。')
  }

  function persistTrainingMemory(
    exercise: MandarinTrainingExercise,
    transcript: string,
    feedback: MandarinTrainingFeedback,
  ) {
    if (!memoryOwnerId) {
      return
    }

    const content = buildTrainingMemoryContent(exercise, transcript, feedback)
    memoryService.addMemoryEntry({
      type: 'episodic',
      content,
      metadata: {
        kind: 'training_result',
        exercise_id: exercise.id,
        exercise_category: exercise.category,
        keywords: exercise.keywords,
        focus_tags: exercise.focusTags,
        recognized_text: transcript,
        feedback_status: feedback.status,
        missing_chars: feedback.missingChars,
        extra_chars: feedback.extraChars,
        source_label: exercise.source.label,
        source_url: exercise.source.url,
      },
    })
  }

  async function handleStartRecording() {
    if (!currentExercise || isUploading || isProcessing) {
      return
    }

    setAttempt(null)
    setToastMessage(null)

    try {
      await startRecording()
    } catch (error) {
      console.error('Failed to start training recording:', error)
      setToastMessage('录音启动失败，请检查麦克风权限。')
    }
  }

  async function handleStopRecording() {
    if (!currentExercise) {
      return
    }

    try {
      const result = await stopRecording()
      const transcript = result.transcript.trim()
      const feedback = analyzeMandarinAttempt(currentExercise, transcript)

      const nextAttempt: TrainingAttempt = {
        exerciseId: currentExercise.id,
        transcript,
        feedback,
        recording: result.recording,
        uploaded: false,
      }

      setAttempt(nextAttempt)
      setCompletedCount((value) => value + 1)
      persistTrainingMemory(currentExercise, transcript, feedback)
      sendTrainingResult(
        buildTrainingResultPayload(
          currentExercise,
          transcript,
          feedback,
          consentToUpload,
        ),
      )

      if (consentToUpload && result.recording) {
        await uploadAttempt(currentExercise, nextAttempt, true)
      } else {
        setToastMessage('已生成本次反馈。需要时可以手动匿名上传。')
      }
    } catch (error) {
      console.error('Failed to stop training recording:', error)
      setToastMessage('录音结束失败，请重新尝试。')
    }
  }

  function moveExercise(offset: number) {
    if (filteredExercises.length === 0 || !currentExercise) {
      return
    }

    const currentIndex = filteredExercises.findIndex((exercise) => exercise.id === currentExercise.id)
    const nextIndex = (currentIndex + offset + filteredExercises.length) % filteredExercises.length
    setCurrentExerciseId(filteredExercises[nextIndex].id)
    setAttempt(null)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.12),_transparent_24%),linear-gradient(180deg,_#fffdf8_0%,_#fff9f0_48%,_#fff5eb_100%)]">
      <nav className="sticky top-0 z-40 border-b border-amber-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 text-gray-900">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-lg font-semibold text-amber-700">
              燃
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600">VoxFlame</p>
              <p className="text-base font-semibold">中文语训与录音上传</p>
            </div>
          </Link>
          <div className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm text-gray-600">
            当前贡献者：<span className="font-semibold text-gray-900">{displayName}</span>
          </div>
        </div>
      </nav>

      {toastMessage ? (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toastMessage}
        </div>
      ) : null}

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="rounded-[32px] border border-amber-100 bg-white/90 p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Mandarin Practice
              </span>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                先练真实沟通句，再决定是否匿名上传
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
              这不是泛化录音采集页，而是一条完整的中文训练闭环。
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
              每次练习都会展示目标句、拼音和本次重点。录音结束后，你可以看到系统听到的结果、差异提示，以及是否把这条样本匿名上传，用于后续中文语训和个体化建议。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-amber-50 px-5 py-4">
                <p className="text-sm text-amber-700">本次已完成</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{completedCount}</p>
                <p className="mt-2 text-sm text-gray-600">本轮页面内练习次数</p>
              </div>
              <div className="rounded-3xl bg-orange-50 px-5 py-4">
                <p className="text-sm text-orange-700">累计上传</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {contributor?.total_recordings ?? 0}
                </p>
                <p className="mt-2 text-sm text-gray-600">匿名贡献到语料库的录音数</p>
              </div>
              <div className="rounded-3xl bg-stone-100 px-5 py-4">
                <p className="text-sm text-stone-700">连接状态</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">
                  {status === 'recording'
                    ? '正在录音'
                    : status === 'processing'
                      ? '处理中'
                      : status === 'ready'
                        ? '已就绪'
                        : status === 'connecting'
                          ? '正在连接'
                          : status === 'error'
                            ? '连接异常'
                            : '待开始'}
                </p>
                <p className="mt-2 text-sm text-gray-600">录音时会自动连接 TEN Agent 做实时转写</p>
              </div>
            </div>
          </div>

          <aside className="rounded-[32px] border border-amber-100 bg-[#fffaf2] p-7 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <h2 className="text-lg font-semibold text-gray-900">匿名上传说明</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              上传内容包括录音、目标句、练习标签和系统识别结果。未勾选授权时，这次练习只保留在当前页面反馈里，不会主动上传。
            </p>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-3xl border border-amber-200 bg-white p-4">
              <input
                type="checkbox"
                checked={consentToUpload}
                onChange={(event) => setConsentToUpload(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm leading-6 text-gray-700">
                完成录音后，匿名上传这次样本，用于中文语训、语料整理和后续个体化建议。
              </span>
            </label>

            <div className="mt-6 rounded-3xl border border-dashed border-amber-200 bg-white px-4 py-4 text-sm leading-6 text-gray-600">
              <p className="font-medium text-gray-900">上传策略</p>
              <p className="mt-2">默认 local-first。授权后才上传；如果网络或存储异常，会自动降级为本地暂存。</p>
            </div>

            {isUploading ? (
              <div className="mt-6 rounded-3xl bg-amber-100 px-4 py-4">
                <p className="text-sm font-medium text-amber-900">正在处理上传</p>
                <div className="mt-3 h-2 rounded-full bg-white/80">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-amber-800">进度 {uploadProgress}%</p>
              </div>
            ) : null}

            {lastError ? (
              <div className="mt-4 rounded-3xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-800">
                {lastError}
              </div>
            ) : null}

            {sessionError ? (
              <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
                {sessionError}
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部练习
              </button>
              {MANDARIN_TRAINING_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedCategory === category
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {currentExercise ? (
              <div className="mt-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                    {currentExercise.category}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                    {DIFFICULTY_LABELS[currentExercise.difficulty]}
                  </span>
                </div>

                <p className="mt-6 text-3xl font-semibold leading-snug text-gray-900 sm:text-4xl">
                  {currentExercise.text}
                </p>
                <p className="mt-4 rounded-3xl bg-stone-100 px-4 py-4 font-mono text-sm leading-7 text-stone-700 sm:text-base">
                  {currentExercise.pinyin}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {currentExercise.focusTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-amber-200 bg-white px-3 py-1 text-sm text-amber-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4">
                  <p className="text-sm font-medium text-gray-900">本次练习提示</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{currentExercise.coachingTip}</p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <a
                    href={currentExercise.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-700 underline decoration-amber-300 underline-offset-4"
                  >
                    来源：{currentExercise.source.label}
                  </a>
                  <div className="flex gap-3">
                    <button
                      onClick={() => moveExercise(-1)}
                      className="rounded-full border border-gray-200 px-4 py-2 text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      上一句
                    </button>
                    <button
                      onClick={() => moveExercise(1)}
                      className="rounded-full border border-gray-200 px-4 py-2 text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      下一句
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">开始录音</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    录音时会显示实时转写。停止后，我们会先给出对照反馈，再根据你的授权决定是否上传。
                  </p>
                </div>
                <div className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-gray-700">
                  {isRecording ? formatSeconds(recordingTime) : status === 'processing' ? '处理中' : '准备就绪'}
                </div>
              </div>

              <div className="mt-6 rounded-[28px] bg-[#fff8ef] p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={isUploading || isProcessing}
                    className={`h-24 w-24 rounded-full text-white shadow-lg transition ${
                      isRecording
                        ? 'bg-rose-500 hover:bg-rose-600'
                        : 'bg-amber-500 hover:bg-amber-600'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-label={isRecording ? '停止录音' : '开始录音'}
                  >
                    {isRecording ? '停止' : '录音'}
                  </button>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {isRecording ? '正在跟读当前句子' : '按下按钮开始练习'}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {isRecording
                        ? '录音结束后会自动生成对照反馈。'
                        : '建议先看一遍拼音，再开始录音。'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-white/80 bg-white/90 px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">实时转写</p>
                  <p className="mt-3 min-h-16 text-base leading-7 text-gray-700">
                    {interimText || '开始录音后，这里会显示系统当前听到的内容。'}
                  </p>
                </div>
              </div>
            </section>

            {attempt ? (
              <section className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-gray-900">录后反馈</h2>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    {FEEDBACK_STATUS_LABELS[attempt.feedback.status]}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl bg-stone-100 px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">目标句</p>
                    <p className="mt-2 text-base leading-7 text-gray-700">{currentExercise.text}</p>
                  </div>
                  <div className="rounded-3xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">系统听到的内容</p>
                    <p className="mt-2 text-base leading-7 text-gray-700">
                      {attempt.transcript || '这次系统还没有稳定拿到最终结果。'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-gray-200 bg-white px-5 py-4">
                  <p className="text-sm font-medium text-gray-900">总结</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{attempt.feedback.summary}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-stone-100 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">漏掉的字</p>
                      <p className="mt-2 text-sm text-gray-700">
                        {attempt.feedback.missingChars.length > 0
                          ? attempt.feedback.missingChars.join('、')
                          : '无'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-stone-100 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">多出的字</p>
                      <p className="mt-2 text-sm text-gray-700">
                        {attempt.feedback.extraChars.length > 0
                          ? attempt.feedback.extraChars.join('、')
                          : '无'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-medium text-gray-900">建议</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                    {attempt.feedback.suggestions.map((suggestion) => (
                      <li key={suggestion}>- {suggestion}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!attempt.uploaded ? (
                    <button
                      onClick={() => uploadAttempt(currentExercise, attempt, false)}
                      disabled={isUploading || !attempt.recording}
                      className="rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      匿名上传这次录音
                    </button>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-700">
                      这次录音已完成贡献
                    </span>
                  )}

                  <button
                    onClick={() => moveExercise(1)}
                    className="rounded-full border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    换一句继续练
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </section>

        <section className="rounded-[32px] border border-stone-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
          <h2 className="text-lg font-semibold text-gray-900">这一页现在能做什么</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-stone-100 px-5 py-4">
              <p className="text-sm font-medium text-gray-900">中文场景句</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                当前先练真实高价值句，不先追求大而全语料库。
              </p>
            </div>
            <div className="rounded-3xl bg-stone-100 px-5 py-4">
              <p className="text-sm font-medium text-gray-900">录后对照反馈</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                先做目标句、识别结果和训练标签级建议，不假装给出医学诊断。
              </p>
            </div>
            <div className="rounded-3xl bg-stone-100 px-5 py-4">
              <p className="text-sm font-medium text-gray-900">匿名上传</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                只有你明确授权后才上传；网络异常时会按现有逻辑本地降级。
              </p>
            </div>
          </div>
        </section>
      </main>

      <OfflineNotice />
      <InstallPrompt />
      <UpdatePrompt />
    </div>
  )
}
