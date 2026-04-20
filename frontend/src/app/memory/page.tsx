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
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import {
  activatePreparedExpressionAsset,
  deletePreparedExpressionAsset,
  fetchPreparedExpressionLibrary,
  savePreparedExpressionAsset,
  saveWorkspaceSceneTemplates,
  saveWorkspaceUserProfileMemory,
  type PreparedExpressionAsset,
  type PreparedExpressionLibraryAsset,
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

const PROFILE_DOCUMENT_OUTLINE = [
  '我是谁：姓名、身份、平时最常见的沟通对象。',
  '我的说话背景：疾病/构音情况、严重程度、别人通常会在哪些地方听不清。',
  '高频沟通场景：例如就医、工作汇报、陌生人问路、家人沟通。',
  '沟通习惯：我习惯先怎么开场、哪里容易卡住、说不顺时怎么补救。',
  '希望别人怎么配合：例如请等我说完、没听清请复述、可以让我用文字补充。',
] as const

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
  expandedSectionId: MemorySectionId | null
  onToggle: (id: MemorySectionId) => void
  eyebrow: string
  eyebrowTone: 'amber' | 'sky' | 'stone'
  title: string
  description: string
  preview: string
  badge?: string
  actions?: ReactNode
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
  actions,
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
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="min-w-0 flex-1 text-left"
        >
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
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {badge ? (
            <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {badge}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onToggle(id)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {isExpanded ? '收起内容' : '展开内容'}
          </button>
        </div>
      </div>

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
  const [activeSceneTemplateId, setActiveSceneTemplateId] = useState<string | null>(null)
  const [expandedSectionId, setExpandedSectionId] = useState<MemorySectionId | null>(null)
  const [userProfileDocument, setUserProfileDocument] = useState('')
  const [userProfileStatus, setUserProfileStatus] = useState<string | null>(null)
  const [isSavingUserProfile, setIsSavingUserProfile] = useState(false)
  const [isUserProfileEditorOpen, setIsUserProfileEditorOpen] = useState(false)
  const [preparedExpressionLibrary, setPreparedExpressionLibrary] = useState<PreparedExpressionLibraryAsset | null>(null)
  const [selectedPreparedExpressionId, setSelectedPreparedExpressionId] = useState<string | null>(null)
  const [preparedExpressionTitle, setPreparedExpressionTitle] = useState('')
  const [preparedExpressionScene, setPreparedExpressionScene] = useState('')
  const [preparedExpressionSource, setPreparedExpressionSource] = useState('manual_input')
  const [preparedExpressionContent, setPreparedExpressionContent] = useState('')
  const [preparedExpressionStatus, setPreparedExpressionStatus] = useState<string | null>(null)
  const [isPreparedExpressionLoading, setIsPreparedExpressionLoading] = useState(false)
  const [isSavingPreparedExpression, setIsSavingPreparedExpression] = useState(false)
  const [isPreparedExpressionContentOpen, setIsPreparedExpressionContentOpen] = useState(false)
  const [isPreparedExpressionEditorOpen, setIsPreparedExpressionEditorOpen] = useState(false)
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
    if (!userProfileStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setUserProfileStatus(null)
    }, 3600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [userProfileStatus])

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
      setPreparedExpressionLibrary(null)
      setSelectedPreparedExpressionId(null)
      return
    }

    const activeUserId = userId
    let cancelled = false

    async function loadPreparedExpression() {
      setIsPreparedExpressionLoading(true)

      try {
        const library = await fetchPreparedExpressionLibrary(activeUserId)
        if (!cancelled) {
          applyPreparedExpressionLibrary(library)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[MemoryPage] Failed to load prepared expression library:', error)
          setPreparedExpressionStatus('参考材料读取失败了，稍后再试一次。')
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

  useEffect(() => {
    const profileDocument = workspaceSnapshot?.user_profile_memory.document?.trim() ?? ''
    setUserProfileDocument(profileDocument)
    setIsUserProfileEditorOpen(!profileDocument)
  }, [workspaceSnapshot?.user_profile_memory.document])

  const preparedExpressionAssets = preparedExpressionLibrary?.assets ?? []
  const activePreparedExpressionId = preparedExpressionLibrary?.active_asset_id ?? null
  const preparedExpressionAsset = useMemo(
    () => preparedExpressionAssets.find((asset) => asset.draft.id === selectedPreparedExpressionId)
      ?? preparedExpressionAssets.find((asset) => asset.draft.id === activePreparedExpressionId)
      ?? preparedExpressionAssets[0]
      ?? null,
    [activePreparedExpressionId, preparedExpressionAssets, selectedPreparedExpressionId],
  )
  const activePreparedExpressionAsset = useMemo(
    () => preparedExpressionAssets.find((asset) => asset.draft.id === activePreparedExpressionId) ?? null,
    [activePreparedExpressionId, preparedExpressionAssets],
  )

  function applyPreparedExpressionSelection(
    library: PreparedExpressionLibraryAsset | null,
    assetId: string | null,
    options?: {
      openEditor?: boolean
      openContent?: boolean
    },
  ) {
    const selectedAsset = assetId
      ? library?.assets.find((asset) => asset.draft.id === assetId) ?? null
      : null

    setSelectedPreparedExpressionId(assetId)
    setPreparedExpressionTitle(selectedAsset?.draft.title ?? '')
    setPreparedExpressionScene(selectedAsset?.draft.scene ?? '')
    setPreparedExpressionSource(selectedAsset?.draft.source ?? 'manual_input')
    setPreparedExpressionContent(selectedAsset?.draft.content ?? '')
    setIsPreparedExpressionEditorOpen(options?.openEditor ?? !selectedAsset)
    setIsPreparedExpressionContentOpen(options?.openContent ?? false)
  }

  function applyPreparedExpressionLibrary(
    library: PreparedExpressionLibraryAsset | null,
    preferredSelectedId?: string | null,
    options?: {
      openEditor?: boolean
      openContent?: boolean
    },
  ) {
    setPreparedExpressionLibrary(library)
    const nextSelectedId =
      preferredSelectedId && library?.assets.some((asset) => asset.draft.id === preferredSelectedId)
        ? preferredSelectedId
        : library?.active_asset_id
          ?? library?.assets[0]?.draft.id
          ?? null

    applyPreparedExpressionSelection(library, nextSelectedId, options)
  }

  function startNewPreparedExpressionDraft() {
    applyPreparedExpressionSelection(preparedExpressionLibrary, null, {
      openEditor: true,
      openContent: false,
    })
  }

  function handleSelectPreparedExpression(asset: PreparedExpressionAsset) {
    applyPreparedExpressionSelection(preparedExpressionLibrary, asset.draft.id)
  }

  async function handleSaveUserProfileDocument() {
    if (!userId || !isAuthenticated) {
      setUserProfileStatus('先登录后才能保存用户画像。')
      return
    }

    const document = userProfileDocument.trim()
    if (!document) {
      setUserProfileStatus('先写一版用户画像文档，再保存。')
      return
    }

    setIsSavingUserProfile(true)

    try {
      await saveWorkspaceUserProfileMemory(userId, { document })
      await refreshWorkspaceSnapshot()
      setUserProfileStatus('用户画像已经保存。后面系统只会在这个基础上做小幅维护，不会把它拆成别的记忆类型。')
      setIsUserProfileEditorOpen(false)
    } catch (error) {
      console.error('[MemoryPage] Failed to save user profile memory:', error)
      setUserProfileStatus('用户画像保存失败了，请稍后再试。')
    } finally {
      setIsSavingUserProfile(false)
    }
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
      setPreparedExpressionStatus('先登录后才能把参考材料保存到记忆页。')
      return
    }

    const content = preparedExpressionContent.trim()
    if (!content) {
      setPreparedExpressionStatus('先贴入或上传一份准备内容。')
      return
    }

    setIsSavingPreparedExpression(true)

    try {
      const library = await savePreparedExpressionAsset(userId, {
        id: preparedExpressionAsset?.draft.id ?? null,
        title: preparedExpressionTitle.trim() || null,
        scene: preparedExpressionScene.trim() || null,
        source: preparedExpressionSource.trim() || 'manual_input',
        content,
        make_active: true,
      })

      applyPreparedExpressionLibrary(library, library?.active_asset_id ?? null)
      await refreshWorkspaceSnapshot()
      setPreparedExpressionStatus(
        preparedExpressionAsset
          ? '这份参考材料已经更新，并设为当前加载文档。'
          : '新材料已经保存，并设为当前加载文档。',
      )
      setIsPreparedExpressionEditorOpen(false)
    } catch (error) {
      console.error('[MemoryPage] Failed to save prepared expression asset:', error)
      setPreparedExpressionStatus('参考材料保存失败了，请稍后再试一次。')
    } finally {
      setIsSavingPreparedExpression(false)
    }
  }

  async function handleActivatePreparedExpression() {
    if (!userId || !isAuthenticated || !preparedExpressionAsset) {
      setPreparedExpressionStatus('先选中一份材料，再设为当前加载。')
      return
    }

    try {
      const library = await activatePreparedExpressionAsset(userId, preparedExpressionAsset.draft.id)
      applyPreparedExpressionLibrary(library, preparedExpressionAsset.draft.id, {
        openEditor: isPreparedExpressionEditorOpen,
        openContent: isPreparedExpressionContentOpen,
      })
      await refreshWorkspaceSnapshot()
      setPreparedExpressionStatus(`“${preparedExpressionAsset.draft.title}”已经设为当前加载文档。`)
    } catch (error) {
      console.error('[MemoryPage] Failed to activate prepared expression asset:', error)
      setPreparedExpressionStatus('切换当前材料失败了，请稍后再试。')
    }
  }

  async function handleDeletePreparedExpression() {
    if (!userId || !isAuthenticated || !preparedExpressionAsset) {
      setPreparedExpressionStatus('先选中一份材料，再删除。')
      return
    }

    try {
      const deletedTitle = preparedExpressionAsset.draft.title
      const library = await deletePreparedExpressionAsset(userId, preparedExpressionAsset.draft.id)
      applyPreparedExpressionLibrary(library)
      await refreshWorkspaceSnapshot()
      setPreparedExpressionStatus(`“${deletedTitle}”已经从材料库移除。`)
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
  const activeSceneTemplate = useMemo(
    () => sceneTemplateLibrary.find((template) => template.id === activeSceneTemplateId) ?? null,
    [activeSceneTemplateId, sceneTemplateLibrary],
  )

  useEffect(() => {
    const preferredTemplateId = selectedSceneTemplateIds[0] ?? sceneTemplateLibrary[0]?.id ?? null
    setActiveSceneTemplateId((current) => {
      if (current && sceneTemplateLibrary.some((template) => template.id === current)) {
        return current
      }

      return preferredTemplateId
    })
  }, [sceneTemplateLibrary, selectedSceneTemplateIds])

  const userProfileSummary = (
    workspaceSnapshot?.user_profile_memory.document?.trim()
    || workspaceSnapshot?.user_profile_memory.summary?.trim()
    || workspaceSnapshot?.preparation.profile_summary?.trim()
    || ''
  )
  const selectedSceneTemplateSummary = summarizeText(
    selectedSceneTemplates.map((template) => template.title).join(' / '),
    '还没有加载模板。选中后再展开细看具体热词、风险词和开口句。',
  )

  const hasSavedUserProfileDocument = Boolean(workspaceSnapshot?.user_profile_memory.document?.trim())
  const userProfileDocumentDirty = userProfileDocument.trim() !== (workspaceSnapshot?.user_profile_memory.document?.trim() ?? '')
  const userProfileSignals = useMemo(
    () => [
      ...(workspaceSnapshot?.user_profile_memory.common_scenarios ?? []),
      ...(workspaceSnapshot?.user_profile_memory.risky_terms ?? []),
      ...(workspaceSnapshot?.user_profile_memory.support_strategies ?? []),
    ],
    [
      workspaceSnapshot?.user_profile_memory.common_scenarios,
      workspaceSnapshot?.user_profile_memory.risky_terms,
      workspaceSnapshot?.user_profile_memory.support_strategies,
    ],
  )

  const hasSavedPreparedExpression = Boolean(preparedExpressionAsset?.draft.id)
  const preparedExpressionCount = preparedExpressionAssets.length
  const isSelectedPreparedExpressionActive = Boolean(
    preparedExpressionAsset && preparedExpressionAsset.draft.id === activePreparedExpressionId,
  )
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
    setExpandedSectionId((current) => (current === sectionId ? null : sectionId))
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
    activePreparedExpressionAsset
      ? `${activePreparedExpressionAsset.draft.title}：${activePreparedExpressionAsset.structured.summary}`
      : null,
    '还没有参考材料。这里会按材料库管理多份文档，并明确哪一份是当前加载材料。',
    140,
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
            description="这里应该是一份持续维护的用户画像文档，不是三句模板。系统只会在这份文档和稳定规律的基础上做轻量维护。"
            preview={summarizeText(
              userProfileSummary,
              '还没有用户画像文档。展开后先写一版背景、病情、场景和沟通习惯。',
            )}
          >
            {userProfileStatus ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                {userProfileStatus}
              </div>
            ) : null}

            <div className="mt-4 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">当前画像文档</div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    建议把它当成一份长期说明文档来维护：谁是这个用户、常见沟通场景是什么、别人最容易哪里听不清、希望别人怎样配合。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserProfileEditorOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-sky-300 hover:text-stone-950"
                >
                  {isUserProfileEditorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {hasSavedUserProfileDocument
                    ? isUserProfileEditorOpen ? '收起文档' : '编辑画像'
                    : '开始写画像'}
                </button>
              </div>

              {hasSavedUserProfileDocument ? (
                <div className="mt-4 rounded-[20px] border border-stone-200 bg-white px-4 py-4 text-sm leading-7 text-gray-700 whitespace-pre-wrap">
                  {isUserProfileEditorOpen
                    ? userProfileDocument
                    : summarizeText(userProfileDocument, userProfileSummary, 220)}
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm leading-6 text-gray-600">
                  还没有第一版画像文档。建议先用一段到两段话把背景、病情/说话特点、常见场景和沟通习惯写出来。
                </div>
              )}
            </div>

            {isUserProfileEditorOpen || !hasSavedUserProfileDocument ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
                  <div className="text-sm font-semibold text-gray-900">第一版用户画像可以按这个顺序写</div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                    {PROFILE_DOCUMENT_OUTLINE.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-900">画像文档</span>
                  <textarea
                    value={userProfileDocument}
                    onChange={(event) => setUserProfileDocument(event.target.value)}
                    placeholder="例如：我叫...，平时在工作汇报和就医说明时最容易被听不清。我的构音障碍主要体现在... 我通常希望对方先听我说完，如果没听清请复述关键词。"
                    className="min-h-[260px] w-full rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-gray-900 outline-none transition focus:border-sky-300 focus:bg-white"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveUserProfileDocument()}
                    disabled={isSavingUserProfile || !userProfileDocument.trim() || !userProfileDocumentDirty}
                    className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingUserProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {hasSavedUserProfileDocument ? '更新画像文档' : '保存第一版画像'}
                  </button>
                  <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-600">
                    后台维护链后续只会轻量补充稳定规律，不会把这份画像拆成别的对象
                  </span>
                </div>
              </div>
            ) : null}

            {userProfileSignals.length > 0 ? (
              <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <div className="text-sm font-semibold text-gray-900">系统已经观察到的稳定信号</div>
                <div className="mt-3">
                  {renderChips(userProfileSignals.slice(0, 8), 'sky')}
                </div>
              </div>
            ) : null}

          </MemorySectionShell>
        </div>

        <div id="memory-custom-material-editor">
          <MemorySectionShell
            id="custom_material"
            expandedSectionId={expandedSectionId}
            onToggle={handleSectionToggle}
            eyebrow="自定义材料"
            eyebrowTone="amber"
            title="参考材料库"
            description="这里管理多份参考材料。先选一份，再决定要不要设为当前加载、展开全文或继续编辑。"
            preview={preparedExpressionPreview}
            badge={preparedExpressionCount > 0 ? `${preparedExpressionCount} 份材料` : '还没有材料'}
            actions={(
              <button
                type="button"
                onClick={() => {
                  if (expandedSectionId !== 'custom_material') {
                    handleSectionToggle('custom_material')
                  }
                  startNewPreparedExpressionDraft()
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                <Sparkles className="h-4 w-4" />
                新增材料
              </button>
            )}
          >
            {preparedExpressionStatus ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {preparedExpressionStatus}
              </div>
            ) : null}

            <div className="mt-4 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
              {preparedExpressionCount > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">材料列表</div>
                      <p className="mt-1 text-sm leading-6 text-gray-600">
                        点击一份材料后，再展开全文、编辑，或把它设为当前加载文档。
                      </p>
                    </div>
                    {activePreparedExpressionAsset ? (
                      <span className="rounded-full bg-white px-4 py-2 text-sm text-gray-700">
                        当前加载：{activePreparedExpressionAsset.draft.title}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {preparedExpressionAssets.map((asset) => {
                      const isSelected = preparedExpressionAsset?.draft.id === asset.draft.id
                      const isActive = activePreparedExpressionId === asset.draft.id

                      return (
                        <button
                          key={asset.draft.id}
                          type="button"
                          onClick={() => handleSelectPreparedExpression(asset)}
                          className={`rounded-[20px] border px-4 py-4 text-left transition ${
                            isSelected
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-stone-200 bg-white hover:border-amber-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">{asset.draft.title || '未命名材料'}</div>
                            {isActive ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                当前加载
                              </span>
                            ) : null}
                            {isSelected ? (
                              <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                已选中
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {summarizeText(asset.draft.content, asset.structured.summary, 160)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {asset.draft.scene ? (
                              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                                场景：{asset.draft.scene}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                              来源：{asset.draft.source || 'manual_input'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm leading-6 text-gray-600">
                    这里还没有参考材料。先新增第一份文档，后面沟通页和训练页会围着“当前加载材料”继续收紧。
                  </div>
                  <button
                    type="button"
                    onClick={() => startNewPreparedExpressionDraft()}
                    className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Sparkles className="h-4 w-4" />
                    新增材料
                  </button>
                </div>
              )}
            </div>

            {preparedExpressionAsset ? (
              <div className="mt-4 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPreparedExpressionContentOpen((current) => !current)}
                    className="min-w-0 flex-1 rounded-[20px] border border-transparent px-1 py-1 text-left transition hover:border-amber-200"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">{preparedExpressionTitle || '未命名材料'}</div>
                      {isSelectedPreparedExpressionActive ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                          当前加载
                        </span>
                      ) : (
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                          已选中，尚未加载
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {summarizeText(
                        preparedExpressionContent,
                        '这份参考文档会作为沟通和训练的重要上下文。',
                        180,
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {preparedExpressionScene ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                          场景：{preparedExpressionScene}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                        来源：{preparedExpressionSource || 'manual_input'}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-amber-800">
                        {isPreparedExpressionContentOpen ? '点击收起全文' : '点击展开全文'}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isSelectedPreparedExpressionActive ? (
                      <button
                        type="button"
                        onClick={() => void handleActivatePreparedExpression()}
                        className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
                      >
                        设为当前加载
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsPreparedExpressionContentOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-amber-300 hover:text-stone-950"
                    >
                      {isPreparedExpressionContentOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isPreparedExpressionContentOpen ? '收起全文' : '展开全文'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPreparedExpressionEditorOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-amber-300 hover:text-stone-950"
                    >
                      {isPreparedExpressionEditorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isPreparedExpressionEditorOpen ? '收起编辑' : '编辑材料'}
                    </button>
                  </div>
                </div>

                {isPreparedExpressionContentOpen ? (
                  <div className="mt-4 rounded-[20px] border border-stone-200 bg-white px-4 py-4 text-sm leading-7 text-gray-700 whitespace-pre-wrap">
                    {preparedExpressionContent}
                  </div>
                ) : null}
              </div>
            ) : null}

            {isPreparedExpressionEditorOpen || !hasSavedPreparedExpression ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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

                <div className="flex flex-wrap items-center gap-3">
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

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-gray-900">全文内容</span>
                  <textarea
                    value={preparedExpressionContent}
                    onChange={(event) => setPreparedExpressionContent(event.target.value)}
                    placeholder="把你后面要说的全文、提纲或说明贴在这里。"
                    className="min-h-[240px] w-full rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4 text-sm leading-7 text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSavePreparedExpression()}
                    disabled={isSavingPreparedExpression || !canSavePreparedExpression}
                    className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingPreparedExpression ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {hasSavedPreparedExpression ? '保存并更新这份材料' : '保存新材料'}
                  </button>
                  <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-600">
                    保存后会自动设为当前加载文档，训练总结只根据真实录音结果更新
                  </span>
                  {hasSavedPreparedExpression ? (
                    <button
                      type="button"
                      onClick={() => void handleDeletePreparedExpression()}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除这份材料
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
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
              description="这里按模板标题切换查看，不是一展开就把整库细节全部摊开。默认先看第一套，再决定要不要加载。"
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

              <div className="mt-5">
                {sceneTemplateLibrary.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {sceneTemplateLibrary.map((template) => {
                        const isActive = template.id === activeSceneTemplate?.id
                        const isSelected = selectedSceneTemplateIds.includes(template.id)

                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setActiveSceneTemplateId(template.id)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              isActive
                                ? 'border-amber-400 bg-amber-50 text-stone-950'
                                : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/60'
                            }`}
                          >
                            <span>{template.title}</span>
                            {isSelected ? (
                              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] text-amber-800">
                                已加载
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>

                    {activeSceneTemplate ? (
                      <article className="mt-4 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900">{activeSceneTemplate.title}</h3>
                              <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                {activeSceneTemplate.severity_hint}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                {activeSceneTemplate.scenario}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-gray-600">
                              {activeSceneTemplate.summary}
                            </p>
                            <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                              <p>适用情况：{activeSceneTemplate.condition_hint}</p>
                              <p>这套模板主要帮你：{activeSceneTemplate.communication_goal}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void handleToggleSceneTemplate(activeSceneTemplate.id)
                            }}
                            disabled={isSavingSceneTemplates}
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                              selectedSceneTemplateIds.includes(activeSceneTemplate.id)
                                ? 'bg-gray-900 text-white'
                                : 'border border-stone-300 bg-white text-stone-700 hover:border-amber-300 hover:text-stone-950'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {selectedSceneTemplateIds.includes(activeSceneTemplate.id) ? <Check className="h-4 w-4" /> : null}
                            {selectedSceneTemplateIds.includes(activeSceneTemplate.id) ? '已加载这套模板' : '加载这套模板'}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-[20px] bg-white px-4 py-4">
                            <div className="text-sm font-semibold text-gray-900">优先顺序</div>
                            <div className="mt-3">
                              {renderChips(activeSceneTemplate.focus_priority, 'stone')}
                            </div>
                          </div>
                          <div className="rounded-[20px] bg-white px-4 py-4">
                            <div className="text-sm font-semibold text-gray-900">重点热词</div>
                            <div className="mt-3">
                              {renderChips(activeSceneTemplate.hotwords.map((item) => item.phrase), 'amber')}
                            </div>
                          </div>
                          <div className="rounded-[20px] bg-white px-4 py-4">
                            <div className="text-sm font-semibold text-gray-900">容易听偏的词</div>
                            <div className="mt-3">
                              {renderChips(activeSceneTemplate.risky_terms, 'sky')}
                            </div>
                          </div>
                          <div className="rounded-[20px] bg-white px-4 py-4">
                            <div className="text-sm font-semibold text-gray-900">希望对方这样配合</div>
                            <div className="mt-3">
                              {renderChips(activeSceneTemplate.support_strategies, 'emerald')}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[20px] bg-white px-4 py-4">
                          <div className="text-sm font-semibold text-gray-900">这套模板里的开口句</div>
                          <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                            {activeSceneTemplate.starter_phrases.map((phrase) => (
                              <p key={phrase}>{phrase}</p>
                            ))}
                          </div>
                        </div>
                      </article>
                    ) : null}
                  </>
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
