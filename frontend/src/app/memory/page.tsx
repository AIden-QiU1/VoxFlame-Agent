'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { CommunicationPreferenceCard } from '@/components/chat/CommunicationPreferenceCard'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import {
  deletePreparedExpressionAsset,
  fetchPreparedExpressionAsset,
  savePreparedExpressionAsset,
  saveWorkspaceSceneTemplates,
  type PreparedExpressionAsset,
  type SceneTemplateLibraryItem,
} from '@/lib/memory/workspace-client'

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

type MemorySectionId = 'profile' | 'custom_material' | 'training_summary' | 'scene_templates'

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
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

function summarizeText(value: string | null | undefined, fallback: string, maxLength = 88): string {
  const normalized = value?.trim()
  if (!normalized) {
    return fallback
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized
}

interface MemorySectionShellProps {
  id: MemorySectionId
  expandedSectionId: MemorySectionId
  onToggle: (id: MemorySectionId) => void
  eyebrow: string
  eyebrowTone: 'amber' | 'sky' | 'stone'
  title: string
  description: string
  preview: string
  badge?: string
  children: ReactNode
}

function MemorySectionShell({
  id,
  expandedSectionId,
  onToggle,
  eyebrow,
  eyebrowTone,
  title,
  description,
  preview,
  badge,
  children,
}: MemorySectionShellProps) {
  const isExpanded = expandedSectionId === id
  const eyebrowClasses: Record<MemorySectionShellProps['eyebrowTone'], string> = {
    amber: 'bg-amber-50 text-amber-800',
    sky: 'bg-sky-50 text-sky-800',
    stone: 'bg-stone-100 text-stone-700',
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full flex-wrap items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${eyebrowClasses[eyebrowTone]}`}>
            <Sparkles className="h-4 w-4" />
            {eyebrow}
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            {description}
          </p>
          <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-gray-700">
            {preview}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {badge}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {isExpanded ? '收起内容' : '展开内容'}
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div className="mt-5">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export default function MemoryPage() {
  const { userId, isAuthenticated, isLoading } = useAuth({
    redirectToLogin: true,
    nextPath: '/memory',
  })
  const [selectedSceneTemplateIds, setSelectedSceneTemplateIds] = useState<string[]>([])
  const [sceneTemplateStatus, setSceneTemplateStatus] = useState<string | null>(null)
  const [isSavingSceneTemplates, setIsSavingSceneTemplates] = useState(false)
  const [expandedSceneTemplateId, setExpandedSceneTemplateId] = useState<string | null>(null)
  const [expandedSectionId, setExpandedSectionId] = useState<MemorySectionId>('profile')
  const [preparedExpressionAsset, setPreparedExpressionAsset] = useState<PreparedExpressionAsset | null>(null)
  const [preparedExpressionTitle, setPreparedExpressionTitle] = useState('')
  const [preparedExpressionScene, setPreparedExpressionScene] = useState('')
  const [preparedExpressionSource, setPreparedExpressionSource] = useState('manual_input')
  const [preparedExpressionContent, setPreparedExpressionContent] = useState('')
  const [preparedExpressionStatus, setPreparedExpressionStatus] = useState<string | null>(null)
  const [isPreparedExpressionLoading, setIsPreparedExpressionLoading] = useState(false)
  const [isSavingPreparedExpression, setIsSavingPreparedExpression] = useState(false)
  const preparedExpressionFileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    snapshot: workspaceSnapshot,
    refresh: refreshWorkspaceSnapshot,
  } = useWorkspaceMemorySnapshot({
    userId,
    isAuthenticated,
  })

  useEffect(() => {
    if (!sceneTemplateStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setSceneTemplateStatus(null)
    }, 3200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [sceneTemplateStatus])

  useEffect(() => {
    if (!preparedExpressionStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setPreparedExpressionStatus(null)
    }, 3600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [preparedExpressionStatus])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setPreparedExpressionAsset(null)
      return
    }

    const activeUserId = userId
    let cancelled = false

    async function loadPreparedExpression() {
      setIsPreparedExpressionLoading(true)

      try {
        const asset = await fetchPreparedExpressionAsset(activeUserId)
        if (!cancelled) {
          applyPreparedExpressionAsset(asset)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[MemoryPage] Failed to load prepared expression asset:', error)
          setPreparedExpressionStatus('准备内容读取失败了，稍后再试一次。')
        }
      } finally {
        if (!cancelled) {
          setIsPreparedExpressionLoading(false)
        }
      }
    }

    void loadPreparedExpression()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, userId])

  useEffect(() => {
    setSelectedSceneTemplateIds(workspaceSnapshot?.scene_templates.selected_ids ?? [])
  }, [workspaceSnapshot?.scene_templates.selected_ids])

  function applyPreparedExpressionAsset(asset: PreparedExpressionAsset | null) {
    setPreparedExpressionAsset(asset)
    setPreparedExpressionTitle(asset?.draft.title ?? '')
    setPreparedExpressionScene(asset?.draft.scene ?? '')
    setPreparedExpressionSource(asset?.draft.source ?? 'manual_input')
    setPreparedExpressionContent(asset?.draft.content ?? '')
  }

  async function handleToggleSceneTemplate(templateId: string) {
    if (!userId || !isAuthenticated) {
      setSceneTemplateStatus('先登录后才能保存模板选择。')
      return
    }

    const nextIds = selectedSceneTemplateIds.includes(templateId)
      ? selectedSceneTemplateIds.filter((id) => id !== templateId)
      : [...selectedSceneTemplateIds, templateId]

    setSelectedSceneTemplateIds(nextIds)
    setIsSavingSceneTemplates(true)

    try {
      const savedIds = await saveWorkspaceSceneTemplates(userId, nextIds)
      setSelectedSceneTemplateIds(savedIds)
      await refreshWorkspaceSnapshot()
      setSceneTemplateStatus('模板选择已经保存，后续沟通会自动带上对应重点词和沟通策略。')
    } catch (error) {
      console.error('[MemoryPage] Failed to save scene template selection:', error)
      setSceneTemplateStatus('模板选择保存失败了，请稍后再试。')
    } finally {
      setIsSavingSceneTemplates(false)
    }
  }

  async function handlePreparedExpressionFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      setPreparedExpressionContent(content)
      setPreparedExpressionSource(file.name)
      if (!preparedExpressionTitle.trim()) {
        setPreparedExpressionTitle(stripFileExtension(file.name))
      }
      setPreparedExpressionStatus('准备内容已经读进来了，确认后保存就行。')
    } catch (error) {
      console.error('[MemoryPage] Failed to read prepared expression file:', error)
      setPreparedExpressionStatus('文件读取失败了，换一个 `.md` 或 `.txt` 再试一下。')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSavePreparedExpression() {
    if (!userId || !isAuthenticated) {
      setPreparedExpressionStatus('先登录后才能把准备内容保存到记忆页。')
      return
    }

    const content = preparedExpressionContent.trim()
    if (!content) {
      setPreparedExpressionStatus('先贴入或上传一份准备内容。')
      return
    }

    setIsSavingPreparedExpression(true)

    try {
      const asset = await savePreparedExpressionAsset(userId, {
        title: preparedExpressionTitle.trim() || null,
        scene: preparedExpressionScene.trim() || null,
        source: preparedExpressionSource.trim() || 'manual_input',
        content,
      })

      applyPreparedExpressionAsset(asset)
      await refreshWorkspaceSnapshot()
      setPreparedExpressionStatus('准备内容已经保存。训练页后续会围着这份稿子继续收紧今日总结、7 天总结和计划。')
    } catch (error) {
      console.error('[MemoryPage] Failed to save prepared expression asset:', error)
      setPreparedExpressionStatus('准备内容保存失败了，请稍后再试一次。')
    } finally {
      setIsSavingPreparedExpression(false)
    }
  }

  async function handleDeletePreparedExpression() {
    if (!userId || !isAuthenticated) {
      setPreparedExpressionStatus('先登录后才能删除这份材料。')
      return
    }

    try {
      await deletePreparedExpressionAsset(userId)
      setPreparedExpressionAsset(null)
      setPreparedExpressionTitle('')
      setPreparedExpressionScene('')
      setPreparedExpressionSource('manual_input')
      setPreparedExpressionContent('')
      await refreshWorkspaceSnapshot()
      setPreparedExpressionStatus('这份材料已经删除。你之后可以重新创建新的材料。')
    } catch (error) {
      console.error('[MemoryPage] Failed to delete prepared expression asset:', error)
      setPreparedExpressionStatus('删除失败了，请稍后再试。')
    }
  }

  const sceneTemplateLibrary = useMemo<SceneTemplateLibraryItem[]>(
    () => workspaceSnapshot?.scene_templates.library ?? [],
    [workspaceSnapshot?.scene_templates.library],
  )
  const selectedSceneTemplates = useMemo(
    () => sceneTemplateLibrary.filter((template) => selectedSceneTemplateIds.includes(template.id)),
    [sceneTemplateLibrary, selectedSceneTemplateIds],
  )
  const userProfileSummary = workspaceSnapshot?.preparation.profile_summary?.trim() ?? ''
  const selectedSceneTemplateSummary = summarizeText(
    selectedSceneTemplates.map((template) => template.title).join(' / '),
    '还没有加载模板。选中后再展开细看具体热词、风险词和开口句。',
  )

  const hasSavedPreparedExpression = Boolean(preparedExpressionAsset?.draft.id)
  const preparedExpressionDirty = useMemo(() => {
    if (!preparedExpressionAsset) {
      return Boolean(
        preparedExpressionTitle.trim()
        || preparedExpressionScene.trim()
        || preparedExpressionSource.trim() !== 'manual_input'
        || preparedExpressionContent.trim(),
      )
    }

    return (
      preparedExpressionTitle !== (preparedExpressionAsset.draft.title ?? '')
      || preparedExpressionScene !== (preparedExpressionAsset.draft.scene ?? '')
      || preparedExpressionSource !== (preparedExpressionAsset.draft.source ?? 'manual_input')
      || preparedExpressionContent !== (preparedExpressionAsset.draft.content ?? '')
    )
  }, [
    preparedExpressionAsset,
    preparedExpressionContent,
    preparedExpressionScene,
    preparedExpressionSource,
    preparedExpressionTitle,
  ])
  const canSavePreparedExpression = Boolean(preparedExpressionContent.trim()) && (
    !hasSavedPreparedExpression || preparedExpressionDirty
  )

  function handleSectionToggle(sectionId: MemorySectionId) {
    setExpandedSectionId((current) => (current === sectionId ? current : sectionId))
  }

  const trainingReports = useMemo<TrainingReportsView | null>(() => {
    const reports =
      preparedExpressionAsset?.training_reports
      ?? workspaceSnapshot?.prepared_expression?.training_reports
      ?? null

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
  }, [preparedExpressionAsset, workspaceSnapshot?.prepared_expression])
  const preparedExpressionPreview = summarizeText(
    preparedExpressionTitle.trim()
      || preparedExpressionAsset?.draft.title
      || preparedExpressionContent.trim(),
    '还没有保存材料。这里建议只保留最重要的一份当前材料。',
  )
  const trainingSummaryPreview = summarizeText(
    trainingReports?.weeklySummary?.summary
      || trainingReports?.dailySummary?.summary
      || trainingReports?.trainingPlan?.summary,
    '还没有训练总结。训练页有真实录音后，这里再按时间窗更新。',
  )
  if (isLoading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在整理你的记忆页...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">记忆页</h1>
            <p className="mt-1 text-sm text-gray-600">
              这里只保留自定义材料、场景模板、用户画像，以及训练页回流的今日总结、7 天总结和计划。
            </p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700">
            资料会在这里集中管理
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div id="memory-profile-editor">
          <MemorySectionShell
            id="profile"
            expandedSectionId={expandedSectionId}
            onToggle={handleSectionToggle}
            eyebrow="用户画像"
            eyebrowTone="sky"
            title="用户画像"
            description="这里就是用户画像。后台会在沟通 session 结束后小幅更新稳定规律；你可以手动固定开场、配合方式和补救方式。"
            preview={summarizeText(
              userProfileSummary,
              '还没有固定画像摘要。展开后可以直接编辑开场、配合方式和补救方式。',
            )}
          >
            <CommunicationPreferenceCard
              userId={userId}
              initialPreferences={workspaceSnapshot?.expression_kit.communication_preferences}
              eyebrow="用户画像"
              title="固定你的开场和补救方式"
              description="这里不是新的记忆类型，而是用户画像里可编辑的一部分。首屏会优先使用这些稳定表达。"
              saveLabel="保存画像"
              clearLabel="清空这三句"
              onSaved={() => {
                void refreshWorkspaceSnapshot()
              }}
            />
          </MemorySectionShell>
        </div>

        <div id="memory-custom-material-editor">
          <MemorySectionShell
            id="custom_material"
            expandedSectionId={expandedSectionId}
            onToggle={handleSectionToggle}
            eyebrow="自定义材料"
            eyebrowTone="amber"
            title="你自己维护要说的材料"
            description="把后面要说的全文、提纲或说明放在这里。它的作用是给沟通页提供最关键的参考内容，你可以随时打开、改写、覆盖保存。"
            preview={preparedExpressionPreview}
            badge={trainingReports?.weeklySummary
              ? `最近 7 天 ${trainingReports.weeklySummary.sampleCount} 条`
              : trainingReports?.dailySummary
                ? `今天 ${trainingReports.dailySummary.sampleCount} 条`
                : '先保存材料'}
          >
            {preparedExpressionStatus ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {preparedExpressionStatus}
              </div>
            ) : null}

            <div className="mt-4 rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <p className="text-sm leading-6 text-gray-600">
                {hasSavedPreparedExpression
                  ? '这里就是当前参考文档的编辑区。直接改内容后点“更新参考文档”就会覆盖保存到原位置，不需要删掉旧稿再重传。'
                  : '这里还没有保存过参考文档。先贴入或上传第一份，后面都可以直接在这里改并更新。'}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-900">标题</span>
              <input
                value={preparedExpressionTitle}
                onChange={(event) => setPreparedExpressionTitle(event.target.value)}
                placeholder="例如：公开分享 / 面试自我介绍 / 就医说明"
                className="h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-900">场景标签</span>
              <input
                value={preparedExpressionScene}
                onChange={(event) => setPreparedExpressionScene(event.target.value)}
                placeholder="例如：interview / work / medical"
                className="h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => preparedExpressionFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-gray-800 transition hover:border-amber-300 hover:bg-amber-50"
            >
              <UploadCloud className="h-4 w-4" />
              上传 `.md` / `.txt`
            </button>
            <input
              ref={preparedExpressionFileInputRef}
              type="file"
              accept=".md,.txt,.text"
              onChange={handlePreparedExpressionFileChange}
              className="hidden"
            />
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-600">
              来源：{preparedExpressionSource || 'manual_input'}
            </span>
            {isPreparedExpressionLoading ? (
              <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在读取已有内容
              </span>
            ) : null}
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-gray-900">全文内容</span>
            <textarea
              value={preparedExpressionContent}
              onChange={(event) => setPreparedExpressionContent(event.target.value)}
              placeholder="把你后面要说的全文、提纲或说明贴在这里。"
              className="min-h-[240px] w-full rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
            />
          </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSavePreparedExpression()}
              disabled={isSavingPreparedExpression || !canSavePreparedExpression}
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingPreparedExpression ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {hasSavedPreparedExpression ? '更新参考文档' : '保存第一份参考文档'}
            </button>
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-600">
              训练总结只会根据训练页真实录音结果自动更新
            </span>
            {hasSavedPreparedExpression ? (
              <button
                type="button"
                onClick={() => void handleDeletePreparedExpression()}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300"
              >
                <Trash2 className="h-4 w-4" />
                从当前页移除
              </button>
            ) : null}
            </div>
          </MemorySectionShell>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div id="memory-training-summary">
            <MemorySectionShell
              id="training_summary"
              expandedSectionId={expandedSectionId}
              onToggle={handleSectionToggle}
              eyebrow="训练总结"
              eyebrowTone="stone"
              title="训练总结"
              description="这里沉淀训练页回流的今日总结、7 天总结和下一轮计划，不再混成旧的“纠错总结”口径。"
              preview={trainingSummaryPreview}
              badge={trainingReports?.weeklySummary
                ? `最近 7 天 ${trainingReports.weeklySummary.sampleCount} 条`
                : trainingReports?.dailySummary
                  ? `今天 ${trainingReports.dailySummary.sampleCount} 条`
                  : '等待回流'}
            >
              {trainingReports ? (
                <div className="space-y-4">
                <div className="rounded-[20px] bg-stone-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">今日总结</p>
                  <p className="mt-3 text-sm leading-7 text-gray-700">
                    {trainingReports.dailySummary?.summary ?? '今天还没有新的训练总结。'}
                  </p>
                </div>

                <div className="rounded-[20px] bg-amber-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">最近 7 天总结</p>
                  <p className="mt-3 text-sm leading-7 text-gray-700">
                    {trainingReports.weeklySummary?.summary ?? '最近 7 天还没有整理出稳定总结。'}
                  </p>
                  {trainingReports.weeklySummary?.mismatchPairs.length ? (
                    <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                      {trainingReports.weeklySummary.mismatchPairs.slice(0, 6).map((pair) => (
                        <p key={`${pair.target}-${pair.heard}`}>
                          {pair.target}{' <- '}{pair.heard}
                          {pair.occurrenceCount > 1 ? ` · ${pair.occurrenceCount}次` : ''}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-600">最近 7 天还没有稳定错配对。</p>
                  )}
                </div>

                <div className="rounded-[20px] bg-sky-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-900">下一轮计划</p>
                  <p className="mt-3 text-sm leading-7 text-gray-700">
                    {trainingReports.trainingPlan?.summary ?? '继续训练后，这里会出现下一轮计划。'}
                  </p>
                  {trainingReports.trainingPlan?.items.length ? (
                    <div className="mt-3">
                      {renderChips(trainingReports.trainingPlan.items, 'sky')}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-600">还没有生成下一轮计划。</p>
                  )}
                </div>

                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                  现在还没有训练总结。先去训练页按拆句开始录，这里会按时间窗回流今日总结、7 天总结和下一轮计划。
                </div>
              )}
            </MemorySectionShell>
          </div>

          <div id="memory-scene-template-selector">
            <MemorySectionShell
              id="scene_templates"
              expandedSectionId={expandedSectionId}
              onToggle={handleSectionToggle}
              eyebrow="场景 / 热词模板"
              eyebrowTone="stone"
              title="场景 / 热词模板"
              description="这里不再让你自己造一堆重点词。你只需要选最贴近当前场景的模板，系统会自动带上对应热词、风险词和沟通策略。"
              preview={selectedSceneTemplateSummary}
              badge={`已选 ${selectedSceneTemplateIds.length} 套`}
            >
              {sceneTemplateStatus ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {sceneTemplateStatus}
                </div>
              ) : null}

              {selectedSceneTemplates.length > 0 ? (
                <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                  <div className="text-sm font-semibold text-gray-900">当前会自动带上的模板</div>
                  <div className="mt-3 space-y-3">
                    {selectedSceneTemplates.map((template) => (
                      <div key={template.id} className="rounded-[20px] bg-white px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{template.title}</span>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                            {template.severity_hint}
                          </span>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                            {template.scenario}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-700">{template.communication_goal}</p>
                        <div className="mt-3">
                          {renderChips(template.hotwords.slice(0, 4).map((item) => item.phrase), 'amber')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4">
                {sceneTemplateLibrary.length > 0 ? (
                  sceneTemplateLibrary.map((template) => {
                    const isSelected = selectedSceneTemplateIds.includes(template.id)
                    const isExpanded = expandedSceneTemplateId === template.id

                    return (
                      <article
                        key={template.id}
                        className={`rounded-[24px] border p-5 transition ${
                          isSelected
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-stone-200 bg-stone-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900">{template.title}</h3>
                              <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                {template.severity_hint}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                {template.scenario}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-gray-600">
                              {isExpanded ? template.summary : summarizeText(template.summary, '展开后看详情。', 52)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleToggleSceneTemplate(template.id)
                              }}
                              disabled={isSavingSceneTemplates}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                                isSelected
                                  ? 'bg-gray-900 text-white'
                                  : 'border border-stone-300 bg-white text-stone-700 hover:border-amber-300 hover:text-stone-950'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {isSelected ? <Check className="h-4 w-4" /> : null}
                              {isSelected ? '已加载' : '加载这套模板'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedSceneTemplateId((current) => current === template.id ? null : template.id)
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:border-stone-400"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              {isExpanded ? '收起详情' : '查看详情'}
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <>
                            <div className="mt-4 space-y-2 text-sm leading-6 text-gray-600">
                              <p>适用情况：{template.condition_hint}</p>
                              <p>这套模板主要帮你：{template.communication_goal}</p>
                            </div>
                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                              <div className="rounded-[20px] bg-white px-4 py-4">
                                <div className="text-sm font-semibold text-gray-900">优先顺序</div>
                                <div className="mt-3">
                                  {renderChips(template.focus_priority, 'stone')}
                                </div>
                              </div>
                              <div className="rounded-[20px] bg-white px-4 py-4">
                                <div className="text-sm font-semibold text-gray-900">重点热词</div>
                                <div className="mt-3">
                                  {renderChips(template.hotwords.map((item) => item.phrase), 'amber')}
                                </div>
                              </div>
                              <div className="rounded-[20px] bg-white px-4 py-4">
                                <div className="text-sm font-semibold text-gray-900">容易听偏的词</div>
                                <div className="mt-3">
                                  {renderChips(template.risky_terms, 'sky')}
                                </div>
                              </div>
                              <div className="rounded-[20px] bg-white px-4 py-4">
                                <div className="text-sm font-semibold text-gray-900">希望对方这样配合</div>
                                <div className="mt-3">
                                  {renderChips(template.support_strategies, 'emerald')}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 rounded-[20px] bg-white px-4 py-4">
                              <div className="text-sm font-semibold text-gray-900">这套模板里的开口句</div>
                              <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                                {template.starter_phrases.map((phrase) => (
                                  <p key={phrase}>{phrase}</p>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </article>
                    )
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                    模板库还没加载出来，稍后刷新再试。
                  </div>
                )}
              </div>
            </MemorySectionShell>
          </div>
        </section>
      </main>
    </div>
  )
}
