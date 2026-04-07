'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Brain, CalendarClock, LineChart, Mic, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import { CommunicationPreferenceCard } from '@/components/chat/CommunicationPreferenceCard'
import { STARTER_KIT_SCENES, type StarterKitScene } from '@/lib/communication/starter-kit'
import { getValidToken } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import {
  buildMemoryGrowthProfile,
  FeedbackStatus,
  MemoryGrowthProfile,
} from '@/lib/memory/memory-growth'
import {
  memoryService,
  Memory,
  Session,
  HotwordCategory,
  HotwordProfile,
} from '@/lib/memory/memory-service'
import {
  getTrainingProfileSnapshot,
  MIN_TRAINING_UPLOADS_FOR_PROFILE,
} from '@/lib/training/training-profile'
import { CHINESE_COMMUNICATION_RESOURCES } from '@/lib/support/user-support'

interface RemoteMemoryProfileResponse {
  growth_profile?: MemoryGrowthProfile
  hotword_profiles?: HotwordProfile[]
  hotwords?: string[]
}

const HOTWORD_CATEGORY_LABELS: Record<HotwordCategory, string> = {
  medical: '医疗康复',
  profession: '专业术语',
  family: '家庭照护',
  daily: '日常表达',
  emergency: '紧急场景',
  custom: '自定义',
}

const HOTWORD_EXAMPLES: Array<{
  title: string
  description: string
  items: string[]
}> = [
  {
    title: '医疗康复',
    description: '同样是“评估”或“训练”，在医院里常常对应完全不同的意思，先记下来会更稳。',
    items: ['吞咽评估', '构音训练', '雾化治疗'],
  },
  {
    title: '工作沟通',
    description: '技术、制造、法律、财会等场景里，同音词一变，句子意思就会完全跑偏。',
    items: ['容器镜像', '版本回滚', '结项汇报'],
  },
  {
    title: '家庭照护',
    description: '家庭里高频词往往短但关键，越早记下来，越不容易在关键时刻说乱。',
    items: ['翻身', '吸痰', '喂药'],
  },
]

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  excellent: '匹配良好',
  close: '接近目标句',
  retry: '建议重练',
  unclear: '系统未稳定听清',
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return '刚开始积累'
  }

  if (seconds < 60) {
    return `${seconds} 秒`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes} 分钟`
  }

  return `${minutes} 分 ${remainingSeconds} 秒`
}

function formatDate(dateValue: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateValue))
}

function formatClarity(score: number): string {
  return `${Math.round(score * 100)}%`
}

function formatSlope(profile: MemoryGrowthProfile): string {
  const value = profile.stats.improvementSlope
  if (value > 0) {
    return `+${value.toFixed(2)} / 次`
  }

  if (value < 0) {
    return `${value.toFixed(2)} / 次`
  }

  return '基本持平'
}

function renderLabelChips(items: Array<{ label: string; count: number }>, emptyText: string, tone = 'stone') {
  const toneClasses: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    sky: 'bg-sky-50 text-sky-800',
    amber: 'bg-amber-50 text-amber-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    rose: 'bg-rose-50 text-rose-800',
  }

  if (items.length === 0) {
    return <div className="text-sm text-gray-600">{emptyText}</div>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded-full px-4 py-2 text-sm ${toneClasses[tone] ?? toneClasses.stone}`}
        >
          {item.label} · {item.count}
        </span>
      ))}
    </div>
  )
}

function renderStringChips(items: string[], emptyText: string, tone = 'stone') {
  const toneClasses: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    sky: 'bg-sky-50 text-sky-800',
    amber: 'bg-amber-50 text-amber-800',
    emerald: 'bg-emerald-50 text-emerald-800',
  }

  if (items.length === 0) {
    return <div className="text-sm text-gray-600">{emptyText}</div>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-full px-4 py-2 text-sm ${toneClasses[tone] ?? toneClasses.stone}`}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export default function MemoryPage() {
  const { userId, isAuthenticated, isLoading } = useAuth({
    redirectToLogin: true,
    nextPath: '/memory',
  })
  const [localMemories, setLocalMemories] = useState<Memory[]>([])
  const [localSessions, setLocalSessions] = useState<Session[]>([])
  const [localHotwordProfiles, setLocalHotwordProfiles] = useState<HotwordProfile[]>([])
  const [remoteProfile, setRemoteProfile] = useState<MemoryGrowthProfile | null>(null)
  const [remoteHotwordProfiles, setRemoteHotwordProfiles] = useState<HotwordProfile[]>([])
  const [localTrainingProfile, setLocalTrainingProfile] = useState(() => (
    userId ? getTrainingProfileSnapshot(userId) : null
  ))
  const [hotwordPhrase, setHotwordPhrase] = useState('')
  const [hotwordCategory, setHotwordCategory] = useState<HotwordCategory>('custom')
  const [hotwordScenario, setHotwordScenario] = useState('')
  const [hotwordNote, setHotwordNote] = useState('')
  const [hotwordStatus, setHotwordStatus] = useState<string | null>(null)
  const [isSavingHotwords, setIsSavingHotwords] = useState(false)
  const [prepSceneId, setPrepSceneId] = useState<StarterKitScene['id']>('interview')
  const {
    snapshot: workspaceSnapshot,
    isLoading: isWorkspaceLoading,
    refresh: refreshWorkspaceSnapshot,
  } = useWorkspaceMemorySnapshot({
    userId,
    isAuthenticated,
    sceneId: prepSceneId,
  })

  useEffect(() => {
    if (isLoading || !userId) {
      return
    }

    memoryService.init(userId)
    setLocalMemories(memoryService.getAllMemories())
    setLocalSessions(memoryService.getAllSessions())
    setLocalHotwordProfiles(memoryService.getHotwordProfiles())
    setLocalTrainingProfile(getTrainingProfileSnapshot(userId))
  }, [isLoading, userId])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setRemoteProfile(null)
      return
    }

    let cancelled = false

    async function loadRemoteProfile() {
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

        setRemoteProfile(data.growth_profile ?? null)
        const syncedProfiles = data.hotword_profiles ?? []
        setRemoteHotwordProfiles(syncedProfiles)
        if (memoryService.getHotwordProfiles().length === 0 && syncedProfiles.length > 0) {
          const localProfiles = memoryService.replaceHotwordProfiles(syncedProfiles)
          setLocalHotwordProfiles(localProfiles)
        }
      } catch (error) {
        console.error('[MemoryPage] Failed to load unified memory profile:', error)
      }
    }

    void loadRemoteProfile()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, userId])

  const localProfile = useMemo(() => (
    buildMemoryGrowthProfile({
      memories: localMemories,
      sessions: localSessions,
      hotwords: Array.from(new Set(localHotwordProfiles.map((profile) => profile.phrase))),
    })
  ), [localHotwordProfiles, localMemories, localSessions])

  const profile = useMemo(() => {
    if (isAuthenticated && remoteProfile) {
      return remoteProfile
    }

    return localProfile
  }, [isAuthenticated, localProfile, remoteProfile])

  const activeHotwordProfiles = useMemo(() => {
    if (isAuthenticated && remoteProfile) {
      return localHotwordProfiles.length > 0 ? localHotwordProfiles : remoteHotwordProfiles
    }

    return localHotwordProfiles
  }, [isAuthenticated, localHotwordProfiles, remoteHotwordProfiles, remoteProfile])
  const activePrepScene = useMemo(
    () => STARTER_KIT_SCENES.find((scene) => scene.id === (workspaceSnapshot?.expression_kit.active_scene_id ?? prepSceneId)),
    [prepSceneId, workspaceSnapshot?.expression_kit.active_scene_id],
  )

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

  function resetHotwordDraft() {
    setHotwordPhrase('')
    setHotwordCategory('custom')
    setHotwordScenario('')
    setHotwordNote('')
  }

  async function syncHotwordsToBackend(nextProfiles: HotwordProfile[]) {
    if (!isAuthenticated || !userId) {
      setHotwordStatus('已保存到当前设备，并会在这台设备后续连接时参与理解。')
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
      void refreshWorkspaceSnapshot(prepSceneId)
      setHotwordStatus('热词已保存，并会在后续连接时同步到 agent 个体画像。')
    } catch (error) {
      console.error('[MemoryPage] Failed to sync hotwords:', error)
      setHotwordStatus('已保存到当前设备；后端同步暂时失败。')
    }
  }

  async function handleHotwordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const phrase = hotwordPhrase.trim()
    if (!phrase) {
      setHotwordStatus('先填写一个你想让 agent 优先理解的词。')
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
    resetHotwordDraft()
    setIsSavingHotwords(false)
  }

  async function handleDeleteHotword(profileId: string) {
    setIsSavingHotwords(true)
    const nextProfiles = memoryService.deleteHotwordProfile(profileId)
    setLocalHotwordProfiles(nextProfiles)
    await syncHotwordsToBackend(nextProfiles)
    setIsSavingHotwords(false)
  }

  if (isLoading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center text-sm text-gray-600">正在整理你的进展与记忆...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <div className="hidden h-5 w-px bg-gray-200 sm:block" />
            <div>
              <div className="text-sm font-medium text-amber-700">沟通档案</div>
              <div className="text-lg font-semibold text-gray-900 text-balance">进展、复盘与下一次沟通准备</div>
            </div>
          </div>

          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-gray-600">
            下次面试、工作或就医前，先来这里看一眼
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              先把对下次真的有用的内容带走
            </div>
            <h1 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
              这里先看三件事：最近更顺了什么、还卡在哪里、下次先准备哪一句。
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600 text-pretty">
              来这里不是为了看报表，而是为了在下次高压沟通前少一点慌、少一点临场硬撑。
            </p>

            {localTrainingProfile && !localTrainingProfile.profileReady ? (
              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                当前已累计 {localTrainingProfile.totalUploadedRecordings} 条训练样本，再积累 {localTrainingProfile.uploadsUntilReady} 条，后面的建议会更稳一些。
              </div>
            ) : null}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-3xl bg-amber-50 px-5 py-4">
                <p className="text-sm text-amber-700">训练记录</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{profile.stats.totalTrainingAttempts}</p>
              </div>
              <div className="rounded-3xl bg-stone-100 px-5 py-4">
                <p className="text-sm text-stone-700">连续训练</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{profile.stats.currentTrainingStreak}</p>
                <p className="mt-2 text-xs text-gray-500">最佳 {profile.stats.bestTrainingStreak} 天</p>
              </div>
              <div className="rounded-3xl bg-sky-50 px-5 py-4">
                <p className="text-sm text-sky-700">近 7 次清晰度</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{formatClarity(profile.stats.rollingClarityAverage)}</p>
              </div>
              <div className="rounded-3xl bg-rose-50 px-5 py-4">
                <p className="text-sm text-rose-700">改善斜率</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">{formatSlope(profile)}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {profile.stats.improvementDirection === 'improving'
                    ? '最近在上升'
                    : profile.stats.improvementDirection === 'declining'
                      ? '最近有回落'
                      : '最近较稳定'}
                </p>
              </div>
              <div className="rounded-3xl bg-emerald-50 px-5 py-4">
                <p className="text-sm text-emerald-700">下一步建议</p>
                <p className="mt-2 text-sm leading-6 text-gray-900">{profile.nextStep}</p>
              </div>
            </div>
          </div>

          <aside className="rounded-[32px] border border-amber-100 bg-[#fffaf2] p-7 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <LineChart className="h-5 w-5 text-amber-600" />
              最近趋势
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(profile.statusCounts).map(([status, count]) => (
                <div key={status} className="rounded-3xl border border-white bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                    {STATUS_LABELS[status as FeedbackStatus]}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{count}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">会话数</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{profile.stats.totalSessions}</div>
              </div>
              <div className="rounded-3xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">活跃天数</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{profile.stats.activeDays}</div>
              </div>
              <div className="rounded-3xl border border-white bg-white px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">累计混淆模式</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{profile.stats.totalConfusionPatterns}</div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {profile.trends.length > 0 ? (
                profile.trends.map((point) => (
                  <div key={point.date} className="rounded-3xl border border-white bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">{point.date}</div>
                      <div className="text-xs text-gray-500">
                        {point.trainingAttempts} 次训练 / {point.sessionCount} 个会话
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-stone-100">
                      <div
                        className="h-2 rounded-full bg-amber-500"
                        style={{
                          width: `${Math.min(
                            100,
                            point.trainingAttempts > 0
                              ? (point.excellent / point.trainingAttempts) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      优秀 {point.excellent} / 接近 {point.close} / 重练 {point.retry} / 均值 {formatClarity(point.avgClarityScore)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-amber-200 bg-white px-4 py-4 text-sm leading-6 text-gray-600">
                  训练和沟通继续积累后，这里会开始长出按天的趋势。
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-dashed border-amber-200 bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Brain className="h-4 w-4 text-amber-600" />
                如果你今天不想看太多数据
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                <li>- 先看最近说顺了哪些句子。</li>
                <li>- 再看最影响理解的一个卡点。</li>
                <li>- 最后带走下一次最该先准备的那句话。</li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-medium text-amber-700">下一次高压沟通前</div>
                <h2 className="mt-2 text-3xl font-semibold text-gray-900 text-balance">
                  先准备场景，再准备表达
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 text-pretty">
                  先把这次最可能用到的句子、最近的提醒和补救方式看一眼，再去沟通会更稳。
                </p>
              </div>
              <Link
                href={`/?mode=communicate${activePrepScene ? `&starter=${activePrepScene.id}` : ''}`}
                className="inline-flex rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white"
              >
                按这个场景进入沟通
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {STARTER_KIT_SCENES.map((scene) => {
                const isActive = scene.id === activePrepScene?.id

                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setPrepSceneId(scene.id)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      isActive
                        ? 'bg-amber-500 text-white'
                        : 'border border-stone-200 bg-stone-50 text-stone-700 hover:border-amber-300 hover:text-amber-800'
                    }`}
                  >
                    {scene.title}
                  </button>
                )
              })}
            </div>

            {isWorkspaceLoading ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-stone-100 p-5">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-stone-200" />
                  <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-stone-200" />
                  <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-stone-200" />
                </div>
                <div className="rounded-3xl bg-stone-100 p-5">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="h-9 w-28 animate-pulse rounded-full bg-stone-200" />
                    <div className="h-9 w-32 animate-pulse rounded-full bg-stone-200" />
                    <div className="h-9 w-24 animate-pulse rounded-full bg-stone-200" />
                  </div>
                </div>
              </div>
            ) : workspaceSnapshot ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <div className="text-sm font-medium text-stone-700">
                      我的表达画像
                    </div>
                    <p className="mt-3 text-sm leading-7 text-gray-700 text-pretty">
                      {workspaceSnapshot.preparation.profile_summary}
                    </p>
                    {workspaceSnapshot.preparation.listener_guidance.length > 0 ? (
                      <div className="mt-4">
                        {renderStringChips(
                          workspaceSnapshot.preparation.listener_guidance,
                          '继续积累后，这里会压缩出最适合你的现场配合方式。',
                          'sky',
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-amber-200 bg-[#fffaf2] p-5">
                    <div className="text-sm font-medium text-amber-800">当前重要表达准备</div>
                    <p className="mt-3 text-sm leading-7 text-gray-700 text-pretty">
                      {workspaceSnapshot.preparation.overview}
                    </p>
                    {workspaceSnapshot.preparation.immediate_goal ? (
                      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-gray-800">
                        现在最该先准备：{workspaceSnapshot.preparation.immediate_goal}
                      </div>
                    ) : null}
                    {workspaceSnapshot.preparation.support_strategies.length > 0 ? (
                      <div className="mt-4">
                        {renderStringChips(
                          workspaceSnapshot.preparation.support_strategies,
                          '继续积累后，这里会给出最适合你自己的补救和节奏策略。',
                          'emerald',
                        )}
                      </div>
                    ) : null}
                  </div>

                  {workspaceSnapshot.prepared_expression ? (
                    <div className="rounded-3xl border border-stone-200 bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-stone-700">本次重要表达结构</div>
                          <div className="mt-1 text-lg font-semibold text-gray-900">
                            {workspaceSnapshot.prepared_expression.title}
                          </div>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                          已练 {workspaceSnapshot.prepared_expression.rehearsal_count} 次
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-gray-700 text-pretty">
                        {workspaceSnapshot.prepared_expression.summary}
                      </p>
                      {workspaceSnapshot.prepared_expression.last_rehearsed_at ? (
                        <div className="mt-3 text-sm text-gray-600">
                          最近一次 rehearsal：{formatDate(new Date(workspaceSnapshot.prepared_expression.last_rehearsed_at).getTime())}
                        </div>
                      ) : null}
                      {workspaceSnapshot.prepared_expression.next_focus.length > 0 ? (
                        <div className="mt-4">
                          {renderStringChips(
                            workspaceSnapshot.prepared_expression.next_focus,
                            '继续积累后，这里会自动浮出下一次上台前最该复习的内容。',
                            'amber',
                          )}
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-3">
                        {workspaceSnapshot.prepared_expression.sections.slice(0, 4).map((section) => (
                          <div key={section.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-sm font-medium text-gray-900">{section.title}</div>
                              <div className="flex flex-wrap gap-2">
                                {section.is_priority ? (
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                    优先收口
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                  {section.rehearsal_count > 0 ? `已练 ${section.rehearsal_count} 次` : '待开始'}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{section.summary}</p>
                            <p className="mt-3 text-sm leading-6 text-gray-800">锚点句：{section.anchor_line}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[...section.high_risk_phrases, ...section.fallback_phrases].slice(0, 4).map((item) => (
                                <span key={`${section.id}-${item}`} className="rounded-full bg-white px-3 py-1 text-xs text-stone-700">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-stone-200 bg-white p-5">
                    <div className="text-sm font-medium text-stone-700">
                      {workspaceSnapshot.session_review.headline}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-gray-700 text-pretty">
                      {workspaceSnapshot.session_review.summary}
                    </p>
                    {workspaceSnapshot.session_review.recent_win ? (
                      <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        最近亮点：{workspaceSnapshot.session_review.recent_win}
                      </div>
                    ) : null}
                    {workspaceSnapshot.session_review.next_step ? (
                      <div className="mt-4 text-sm text-gray-600">
                        下一步：{workspaceSnapshot.session_review.next_step}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-white p-5">
                    <div className="text-sm font-medium text-stone-700">当前最值得先记住的事</div>
                    <div className="mt-4 space-y-3">
                      {[
                        ...workspaceSnapshot.profile_bundle.static,
                        ...workspaceSnapshot.profile_bundle.dynamic,
                      ].slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-2xl bg-stone-50 px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.title}</div>
                          <p className="mt-2 text-sm leading-6 text-gray-600 text-pretty">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-stone-200 bg-white p-5">
                    <div className="text-sm font-medium text-stone-700">对这次最有用的规律</div>
                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">最稳表达</div>
                        <div className="mt-3">
                          {renderStringChips(
                            workspaceSnapshot.preparation.strong_phrases,
                            '继续积累后，这里会浮出你最稳、最适合直接带走的表达。',
                            'amber',
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">常见场景</div>
                        <div className="mt-3">
                          {renderStringChips(
                            workspaceSnapshot.preparation.common_scenarios,
                            '继续积累后，这里会开始浮出你最常面对、最该提前准备的场景。',
                            'sky',
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">高风险词和发音点</div>
                        <div className="mt-3">
                          {renderStringChips(
                            [
                              ...workspaceSnapshot.preparation.risky_terms,
                              ...workspaceSnapshot.preparation.pronunciation_patterns,
                            ],
                            '继续积累后，这里会告诉你哪些词和哪些规律最容易让系统听偏。',
                            'stone',
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-stone-700">个体化表达建议</div>
                        <div className="mt-1 text-lg font-semibold text-gray-900">
                          {activePrepScene ? `${activePrepScene.title} 场景优先` : '按当前场景优先'}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                        直接可用
                      </span>
                    </div>
                    {workspaceSnapshot.expression_kit.personalized_phrases.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {workspaceSnapshot.expression_kit.personalized_phrases.slice(0, 6).map((phrase) => (
                          <span
                            key={phrase.id}
                            className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-800"
                            title={phrase.note}
                          >
                            {phrase.text}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4 text-sm leading-6 text-gray-600">
                        还没有长出稳定的个体化表达建议。先去沟通页保存三句最重要的话，或者继续积累真实样本。
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <div className="text-sm font-medium text-stone-700">这次优先准备</div>
                    <div className="mt-4">
                      {renderStringChips(
                        [
                          ...workspaceSnapshot.expression_kit.recommended_focus,
                          ...workspaceSnapshot.preparation.hotwords,
                        ].slice(0, 8),
                        '继续积累后，这里会告诉你下次高压沟通前最该先准备的词和提醒。',
                        'amber',
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-6 text-sm leading-7 text-gray-600">
                沟通画像还在同步中。先去沟通模式说出第一句话，或者继续完成今天的练习，这里会逐步长出更贴身的场景准备。
              </div>
            )}
          </article>

          <aside className="rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
            <div className="text-sm font-medium text-amber-700">你的个人沟通约定</div>
            <h3 className="mt-2 text-2xl font-semibold text-gray-900 text-balance">
              先留住那三句最能帮你减压的话
            </h3>
            <p className="mt-3 text-sm leading-7 text-gray-600 text-pretty">
              比如陌生人先听到什么、别人该怎么配合你、没听清时怎么补救。先把这三句固定下来，会很有用。
            </p>

            <div className="mt-6 space-y-3">
              {workspaceSnapshot?.expression_kit.communication_preferences.opening_phrase ? (
                <div className="rounded-3xl bg-amber-50 px-4 py-4">
                  <div className="text-sm font-medium text-amber-800">陌生人先听到</div>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    {workspaceSnapshot.expression_kit.communication_preferences.opening_phrase}
                  </p>
                </div>
              ) : null}
              {workspaceSnapshot?.expression_kit.communication_preferences.pace_hint ? (
                <div className="rounded-3xl bg-stone-100 px-4 py-4">
                  <div className="text-sm font-medium text-stone-800">我希望别人这样配合</div>
                  <p className="mt-2 text-sm leading-6 text-stone-800">
                    {workspaceSnapshot.expression_kit.communication_preferences.pace_hint}
                  </p>
                </div>
              ) : null}
              {workspaceSnapshot?.expression_kit.communication_preferences.repair_phrase ? (
                <div className="rounded-3xl bg-emerald-50 px-4 py-4">
                  <div className="text-sm font-medium text-emerald-800">没听清时怎么办</div>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">
                    {workspaceSnapshot.expression_kit.communication_preferences.repair_phrase}
                  </p>
                </div>
              ) : null}
            </div>

            {!workspaceSnapshot?.expression_kit.communication_preferences.opening_phrase &&
            !workspaceSnapshot?.expression_kit.communication_preferences.pace_hint &&
            !workspaceSnapshot?.expression_kit.communication_preferences.repair_phrase ? (
              <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm leading-6 text-gray-600">
                你还没有固定自己的沟通偏好。直接在下面填好这三句后，这里和首屏表达建议都会马上跟上。
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-sm font-medium text-stone-800">顺手带走几个中文资源</div>
              <div className="mt-3 space-y-3">
                {CHINESE_COMMUNICATION_RESOURCES.slice(0, 3).map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-stone-200 bg-white px-4 py-3 transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <div className="text-sm font-medium text-gray-900">{resource.title}</div>
                    <p className="mt-1 text-sm leading-6 text-gray-600 text-pretty">{resource.summary}</p>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {userId ? (
          <CommunicationPreferenceCard
            userId={userId}
            initialPreferences={workspaceSnapshot?.expression_kit.communication_preferences}
            onSaved={() => {
              void refreshWorkspaceSnapshot(prepSceneId)
            }}
          />
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Mic className="h-5 w-5 text-amber-600" />
              最近训练
            </div>

            {profile.recentTraining.length > 0 ? (
              <div className="mt-6 space-y-4">
                {profile.recentTraining.map((memory) => {
                  const metadata = memory.metadata as Record<string, unknown> | undefined
                  const isTrainingProfileSummary = metadata?.kind === 'training_profile_summary'
                  const focusPatterns = Array.isArray(metadata?.speech_patterns)
                    ? metadata.speech_patterns.filter((item): item is string => typeof item === 'string')
                    : []
                  const summaryPatterns = Array.isArray(metadata?.speech_patterns)
                    ? metadata.speech_patterns
                        .map((item) =>
                          item && typeof item === 'object' && 'label' in item && typeof item.label === 'string'
                            ? item.label
                            : null,
                        )
                        .filter((item): item is string => item !== null)
                    : []
                  const summary =
                    typeof metadata?.pronunciation_summary === 'string'
                      ? metadata.pronunciation_summary
                      : typeof metadata?.last_pronunciation_summary === 'string'
                        ? metadata.last_pronunciation_summary
                      : '先看目标句、用户发音规律和动作提示。'
                  const uploadedCount =
                    typeof metadata?.total_training_uploads === 'number' ? metadata.total_training_uploads : null
                  const nextStep =
                    typeof metadata?.next_step === 'string' ? metadata.next_step : null

                  return (
                    <article key={memory.id} className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-900">{memory.content}</div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                          {isTrainingProfileSummary
                            ? `画像摘要${uploadedCount ? ` · ${uploadedCount} 条` : ''}`
                            : STATUS_LABELS[(metadata?.feedback_status as FeedbackStatus) ?? 'unclear']}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        {(isTrainingProfileSummary ? summaryPatterns : focusPatterns).slice(0, 4).map((pattern) => (
                          <span key={pattern} className="rounded-full bg-white px-3 py-1">
                            {pattern}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{summary}</p>
                      {nextStep ? (
                        <p className="mt-2 text-sm leading-6 text-amber-800">下一步：{nextStep}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-sm leading-6 text-gray-600">
                这里还没有训练记录。先去 <Link href="/contribute" className="font-medium text-amber-700 underline underline-offset-4">练习表达</Link>，录一条就会开始生成你的成长档案。
              </div>
            )}
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <CalendarClock className="h-5 w-5 text-amber-600" />
              最近会话
            </div>

            <div className="mt-6 space-y-3">
              {profile.recentSessions.length > 0 ? (
                profile.recentSessions.map((session) => (
                  <div key={session.id} className="rounded-3xl bg-stone-100 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">
                        {session.kind === 'training' ? '训练会话' : '沟通会话'}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(session.startedAt)}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-gray-600">
                      {session.trainingAttempts} 次训练 / {session.turnCount} 轮对话 / {formatDuration(session.durationSeconds)}
                    </div>
                    {session.avgClarityScore > 0 ? (
                      <div className="mt-1 text-xs text-gray-500">
                        会话清晰度均值 {formatClarity(session.avgClarityScore)}
                      </div>
                    ) : null}
                    {session.topSpeechPatterns.length > 0 || session.topFocusTags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        {[...session.topFocusTags, ...session.topSpeechPatterns].slice(0, 3).map((item) => (
                          <span key={item} className="rounded-full bg-white px-3 py-1">{item}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-stone-100 px-4 py-4 text-sm leading-6 text-gray-600">
                  训练和沟通继续积累后，这里会开始显示最近会话的节奏和重点。
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">高频表达</div>
            <div className="mt-6 space-y-3">
              {profile.frequentExpressions.length > 0 ? (
                profile.frequentExpressions.map((item) => (
                  <div key={item.label} className="rounded-3xl bg-stone-100 px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="mt-1 text-xs text-gray-500">出现 {item.count} 次</div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-stone-100 px-4 py-4 text-sm leading-6 text-gray-600">
                  这里会逐渐沉淀你最常说、最该优先代播的内容。
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">用户发音规律</div>
            <div className="mt-6">
              {renderLabelChips(
                profile.frequentSpeechPatterns,
                '训练积累后，这里会显示最该优先记住的发音规律和高频卡点。',
                'sky',
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">场景总结</div>
            <div className="mt-6">
              <div className="space-y-3 text-sm leading-7 text-gray-700">
                <p>{workspaceSnapshot?.preparation.overview ?? '继续积累后，这里会压缩出你最近最需要准备的场景与目标。'}</p>
                {renderStringChips(
                  workspaceSnapshot?.preparation.common_scenarios ?? [],
                  '继续积累后，这里会总结你最常面对的场景。',
                  'amber',
                )}
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
          <div className="text-lg font-semibold text-gray-900">当前最该先记住的提醒</div>
          <div className="mt-6">
            {renderLabelChips(
              profile.frequentConfusions,
              '继续积累后，这里会把系统最容易听偏的内容和最常出现的风险点累计起来。',
              'amber',
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-900">热词与场景词表</div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                {activeHotwordProfiles.length} 条自定义
              </span>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              中文里同音词很多，医疗、工作、家庭和紧急场景里更容易因为一个词听偏，整句就偏掉。
              把自己的专业词、场景词和高频表达直接记下来，后面开口会更省力。
            </p>

            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              {HOTWORD_EXAMPLES.map((example) => (
                <div key={example.title} className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="text-sm font-semibold text-gray-900">{example.title}</div>
                  <p className="mt-2 text-xs leading-6 text-gray-600">{example.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {example.items.map((item) => (
                      <span key={item} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <form className="mt-6 grid gap-4 rounded-[28px] border border-amber-200 bg-[#fffaf2] p-5" onSubmit={handleHotwordSubmit}>
              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <label className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">热词</div>
                  <input
                    value={hotwordPhrase}
                    onChange={(event) => setHotwordPhrase(event.target.value)}
                    placeholder="例如：吞咽评估、版本回滚、吸痰"
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400"
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">词类</div>
                  <select
                    value={hotwordCategory}
                    onChange={(event) => setHotwordCategory(event.target.value as HotwordCategory)}
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400"
                  >
                    {Object.entries(HOTWORD_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <label className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">场景 / 专业</div>
                  <input
                    value={hotwordScenario}
                    onChange={(event) => setHotwordScenario(event.target.value)}
                    placeholder="例如：住院沟通、DevOps、家庭护理"
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400"
                  />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">备注</div>
                  <input
                    value={hotwordNote}
                    onChange={(event) => setHotwordNote(event.target.value)}
                    placeholder="可写常见搭配、同音词风险、使用提醒"
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs leading-6 text-gray-600">
                  保存后，这些词会先留在你的沟通档案里，后面做场景准备、表达建议和练习提醒时都会优先用到。
                </div>
                <button
                  type="submit"
                  disabled={isSavingHotwords}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isSavingHotwords ? '保存中…' : '加入词表'}
                </button>
              </div>
            </form>

            {hotwordStatus ? (
              <div className="mt-4 rounded-3xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                {hotwordStatus}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              {activeHotwordProfiles.length > 0 ? (
                activeHotwordProfiles.map((profileItem) => (
                  <div key={profileItem.id} className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900">{profileItem.phrase}</div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-700">
                          {HOTWORD_CATEGORY_LABELS[profileItem.category]}
                        </span>
                        {profileItem.scenario ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                            {profileItem.scenario}
                          </span>
                        ) : null}
                      </div>
                      {profileItem.note ? (
                        <div className="mt-2 text-sm leading-6 text-gray-600">{profileItem.note}</div>
                      ) : (
                        <div className="mt-2 text-sm leading-6 text-gray-500">
                          这个词会在后续识别和纠错时作为个人词表提示被优先考虑。
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteHotword(profileItem.id)
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-rose-300 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-6 text-sm leading-6 text-gray-600">
                  这里还没有自定义词表。你可以先加 3 到 5 个最容易被听错、但在自己场景里最关键的词。
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="text-sm font-semibold text-gray-900">当前已进入 growth profile 的热词</div>
              <div className="mt-3">
                {profile.hotwords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.hotwords.map((hotword) => (
                      <span key={hotword} className="rounded-full bg-white px-4 py-2 text-sm text-emerald-800">
                        {hotword}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">训练和沟通继续积累后，这里会显示 agent 已经学到并开始优先参考的关键词。</div>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">动作提示回顾</div>
            <div className="mt-6 grid gap-4">
              {profile.articulationTips.length > 0 ? (
                profile.articulationTips.map((item) => (
                  <div key={item.label} className="rounded-3xl bg-emerald-50 px-5 py-4 text-sm leading-6 text-gray-700">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="mt-1 text-xs text-gray-500">出现 {item.count} 次</div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-stone-100 px-5 py-4 text-sm leading-6 text-gray-600">
                  训练积累后，这里会回顾对你最有用的发声动作提示。
                </div>
              )}
            </div>
          </article>
        </section>

        {profile.expressionMemories.length === 0 && profile.trainingMemories.length === 0 ? (
          <section className="rounded-[32px] border border-dashed border-amber-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">你的成长档案还没有开始积累</div>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              先去沟通模式说出第一句话，或者去训练页练一条最常用的句子，这里就会开始长出真正属于你的进展与记忆。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/?mode=communicate" className="rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white">
                现在沟通
              </Link>
              <Link href="/contribute" className="rounded-full border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700">
                练习表达
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
