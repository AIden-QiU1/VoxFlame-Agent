'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import {
  memoryService,
  type HotwordCategory,
  type HotwordProfile,
} from '@/lib/memory/memory-service'
import {
  fetchPreparedExpressionAsset,
  savePreparedExpressionAsset,
  type PreparedExpressionAsset,
} from '@/lib/memory/workspace-client'

interface RemoteMemoryProfileResponse {
  hotword_profiles?: HotwordProfile[]
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

const HOTWORD_CATEGORY_LABELS: Record<HotwordCategory, string> = {
  medical: '医疗康复',
  profession: '专业术语',
  family: '家庭照护',
  daily: '日常表达',
  emergency: '紧急场景',
  custom: '自定义',
}

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

const LOAD_BEHAVIOR_LABELS = {
  manual: '手动加载',
  recommended: '推荐加载',
  always_on: '默认常驻',
  derived: '系统生成',
} as const

export default function MemoryPage() {
  const { userId, isAuthenticated, isLoading } = useAuth({
    redirectToLogin: true,
    nextPath: '/memory',
  })
  const [localHotwordProfiles, setLocalHotwordProfiles] = useState<HotwordProfile[]>([])
  const [remoteHotwordProfiles, setRemoteHotwordProfiles] = useState<HotwordProfile[]>([])
  const [hotwordPhrase, setHotwordPhrase] = useState('')
  const [hotwordCategory, setHotwordCategory] = useState<HotwordCategory>('custom')
  const [hotwordScenario, setHotwordScenario] = useState('')
  const [hotwordNote, setHotwordNote] = useState('')
  const [hotwordStatus, setHotwordStatus] = useState<string | null>(null)
  const [isSavingHotwords, setIsSavingHotwords] = useState(false)
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
    if (isLoading || !userId) {
      return
    }

    memoryService.init(userId)
    setLocalHotwordProfiles(memoryService.getHotwordProfiles())
  }, [isLoading, userId])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setRemoteHotwordProfiles([])
      return
    }

    let cancelled = false

    async function loadRemoteHotwords() {
      try {
        const token = await getValidToken()
        if (!token) {
          return
        }

        const response = await fetch(`${config.api.baseUrl}/memory/profile/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          return
        }

        const data = await response.json() as RemoteMemoryProfileResponse
        if (cancelled) {
          return
        }

        const syncedProfiles = data.hotword_profiles ?? []
        setRemoteHotwordProfiles(syncedProfiles)
        if (memoryService.getHotwordProfiles().length === 0 && syncedProfiles.length > 0) {
          const localProfiles = memoryService.replaceHotwordProfiles(syncedProfiles)
          setLocalHotwordProfiles(localProfiles)
        }
      } catch (error) {
        console.error('[MemoryPage] Failed to load remote hotwords:', error)
      }
    }

    void loadRemoteHotwords()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, userId])

  useEffect(() => {
    if (!hotwordStatus) {
      return
    }

    const timer = window.setTimeout(() => {
      setHotwordStatus(null)
    }, 3200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [hotwordStatus])

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

  function applyPreparedExpressionAsset(asset: PreparedExpressionAsset | null) {
    setPreparedExpressionAsset(asset)
    setPreparedExpressionTitle(asset?.draft.title ?? '')
    setPreparedExpressionScene(asset?.draft.scene ?? '')
    setPreparedExpressionSource(asset?.draft.source ?? 'manual_input')
    setPreparedExpressionContent(asset?.draft.content ?? '')
  }

  async function syncHotwordsToBackend(nextProfiles: HotwordProfile[]) {
    if (!isAuthenticated || !userId) {
      setHotwordStatus('已保存到当前设备。')
      return
    }

    try {
      const token = await getValidToken()
      if (!token) {
        setHotwordStatus('已保存到当前设备；登录态同步稍后会自动重试。')
        return
      }

      const response = await fetch(`${config.api.baseUrl}/memory/hotwords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          profiles: nextProfiles,
        }),
      })

      if (!response.ok) {
        setHotwordStatus('已保存到当前设备；后端同步暂时失败。')
        return
      }

      const data = await response.json() as { profiles?: HotwordProfile[] }
      setRemoteHotwordProfiles(data.profiles ?? nextProfiles)
      await refreshWorkspaceSnapshot()
      setHotwordStatus('重点词已保存，并会进入后续 correction 上下文。')
    } catch (error) {
      console.error('[MemoryPage] Failed to sync hotwords:', error)
      setHotwordStatus('已保存到当前设备；后端同步暂时失败。')
    }
  }

  async function handleHotwordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const phrase = hotwordPhrase.trim()
    if (!phrase) {
      setHotwordStatus('先填写一个你想让系统优先保真的词。')
      return
    }

    setIsSavingHotwords(true)
    memoryService.upsertHotwordProfile({
      phrase,
      category: hotwordCategory,
      scenario: hotwordScenario,
      note: hotwordNote,
    })
    const nextProfiles = memoryService.getHotwordProfiles()
    setLocalHotwordProfiles(nextProfiles)
    await syncHotwordsToBackend(nextProfiles)
    setHotwordPhrase('')
    setHotwordCategory('custom')
    setHotwordScenario('')
    setHotwordNote('')
    setIsSavingHotwords(false)
  }

  async function handleDeleteHotword(profileId: string) {
    setIsSavingHotwords(true)
    const nextProfiles = memoryService.deleteHotwordProfile(profileId)
    setLocalHotwordProfiles(nextProfiles)
    await syncHotwordsToBackend(nextProfiles)
    setIsSavingHotwords(false)
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

  const activeHotwordProfiles = localHotwordProfiles.length > 0
    ? localHotwordProfiles
    : remoteHotwordProfiles

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
  const objectZones = workspaceSnapshot?.object_zones ?? []

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
              这里只保留准备内容、自定义重点词，以及训练页回流的今日总结、7 天总结和计划。
            </p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-700">
            durable workspace
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
                <Sparkles className="h-4 w-4" />
                workspace object zones
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">记忆页先收成 4 个正式对象区</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                这里先把当前 `workspace snapshot` 收成统一对象视图：自定义材料、场景/热词模板、用户个人画像、训练总结。后面沟通页的 loadout 和 context assembly 会围着这 4 类对象继续收口。
              </p>
            </div>
            <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {objectZones.length > 0
                ? `${objectZones.reduce((count, zone) => count + zone.items.length, 0)} 个对象已进入当前 workspace`
                : '当前还没有可展示对象'}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {objectZones.map((zone) => (
              <section
                key={zone.id}
                className="rounded-[24px] border border-stone-200 bg-stone-50 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{zone.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{zone.description}</p>
                  </div>
                  <span className="rounded-full bg-white px-4 py-2 text-sm text-gray-700">
                    {zone.items.length} 项
                  </span>
                </div>

                {zone.items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {zone.items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[20px] border border-stone-200 bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-gray-700">
                            {LOAD_BEHAVIOR_LABELS[item.load_behavior]}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.editable ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                            {item.editable ? '可编辑' : '系统对象'}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-gray-700">{item.summary}</p>
                        {item.tags.length > 0 ? (
                          <div className="mt-3">
                            {renderChips(item.tags)}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-dashed border-stone-300 bg-white px-4 py-6 text-sm leading-6 text-gray-600">
                    {zone.empty_state}
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                <Sparkles className="h-4 w-4" />
                准备内容 owner
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">用户自己维护准备内容，系统只做压缩和回流</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                把后面要说的全文、提纲或说明放在这里。训练页会按拆句训练，后台会基于目标句和转录句差异整理今日总结、7 天总结和下一轮计划。
              </p>
            </div>
            <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
              {trainingReports?.weeklySummary
                ? `最近 7 天总结基于 ${trainingReports.weeklySummary.sampleCount} 条训练样本`
                : trainingReports?.dailySummary
                  ? `今日总结基于 ${trainingReports.dailySummary.sampleCount} 条训练样本`
                : '先保存准备内容，再去训练页录音'}
            </div>
          </div>

          {preparedExpressionStatus ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">训练总结</h2>
                <p className="mt-1 text-sm text-gray-600">
                  这里沉淀训练页回流的今日总结、7 天总结和下一轮计划，不再混成旧的“纠错总结”口径。
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-gray-700">
                {trainingReports?.weeklySummary
                  ? `最近 7 天 ${trainingReports.weeklySummary.sampleCount} 条`
                  : trainingReports?.dailySummary
                    ? `今天 ${trainingReports.dailySummary.sampleCount} 条`
                    : '等待训练样本回流'}
              </span>
            </div>

            {trainingReports ? (
              <div className="mt-5 space-y-4">
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
              <div className="mt-5 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                现在还没有训练总结。先去训练页按拆句开始录，这里会按时间窗回流今日总结、7 天总结和下一轮计划。
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">自定义重点词</h2>
              <p className="mt-1 text-sm text-gray-600">
                这些词会和准备稿、训练总结一起进入后续沟通上下文。
              </p>
            </div>

            <form className="mt-5 space-y-4 rounded-[24px] bg-stone-50 p-5" onSubmit={handleHotwordSubmit}>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-900">重点词</span>
                <input
                  value={hotwordPhrase}
                  onChange={(event) => setHotwordPhrase(event.target.value)}
                  placeholder="例如：吞咽评估、版本回滚、燃言"
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-900">类别</span>
                  <select
                    value={hotwordCategory}
                    onChange={(event) => setHotwordCategory(event.target.value as HotwordCategory)}
                    className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300"
                  >
                    {Object.entries(HOTWORD_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-900">场景</span>
                  <input
                    value={hotwordScenario}
                    onChange={(event) => setHotwordScenario(event.target.value)}
                    placeholder="例如：interview / work / medical"
                    className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-900">备注</span>
                <input
                  value={hotwordNote}
                  onChange={(event) => setHotwordNote(event.target.value)}
                  placeholder="可写同音词风险、使用提醒或上下文"
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-amber-300"
                />
              </label>

              <button
                type="submit"
                disabled={isSavingHotwords}
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSavingHotwords ? '保存中…' : '加入重点词'}
              </button>
            </form>

            {hotwordStatus ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {hotwordStatus}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {activeHotwordProfiles.length > 0 ? (
                activeHotwordProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{profile.phrase}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-700">
                          {HOTWORD_CATEGORY_LABELS[profile.category]}
                        </span>
                        {profile.scenario ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                            {profile.scenario}
                          </span>
                        ) : null}
                      </div>
                      {profile.note ? (
                        <p className="mt-2 text-sm leading-6 text-gray-600">{profile.note}</p>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-gray-500">这个词会优先进入后续识别和纠错上下文。</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteHotword(profile.id)
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                  这里还没有自定义重点词。先加 3 到 5 个最容易被听错、但在你场景里最关键的词。
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}
