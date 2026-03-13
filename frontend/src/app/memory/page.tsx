'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Brain, CalendarClock, LineChart, Mic, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getAnonymousUserId } from '@/lib/identity/anonymous-user'
import { getValidToken } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import {
  buildMemoryGrowthProfile,
  FeedbackStatus,
  MemoryGrowthProfile,
} from '@/lib/memory/memory-growth'
import { memoryService, Memory, Session } from '@/lib/memory/memory-service'

interface RemoteMemoryProfileResponse {
  growth_profile?: MemoryGrowthProfile
}

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

export default function MemoryPage() {
  const { userId, isAuthenticated, isLoading } = useAuth()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [localMemories, setLocalMemories] = useState<Memory[]>([])
  const [localSessions, setLocalSessions] = useState<Session[]>([])
  const [remoteProfile, setRemoteProfile] = useState<MemoryGrowthProfile | null>(null)

  useEffect(() => {
    if (isLoading) {
      return
    }

    const nextOwnerId = userId || getAnonymousUserId()
    if (!nextOwnerId) {
      return
    }

    setOwnerId(nextOwnerId)
    memoryService.init(nextOwnerId)
    setLocalMemories(memoryService.getAllMemories())
    setLocalSessions(memoryService.getAllSessions())
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
    })
  ), [localMemories, localSessions])

  const profile = useMemo(() => {
    if (isAuthenticated && remoteProfile) {
      return remoteProfile
    }

    return localProfile
  }, [isAuthenticated, localProfile, remoteProfile])

  if (isLoading || !ownerId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#fffaf2_0%,_#fffdf9_46%,_#fff7ed_100%)]">
        <div className="text-center text-sm text-gray-600">正在整理你的进展与记忆...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(180deg,_#fffdf8_0%,_#fff9f0_48%,_#fff5eb_100%)]">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <div className="hidden h-5 w-px bg-gray-200 sm:block" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Growth Profile</div>
              <div className="text-lg font-semibold text-gray-900">进展与记忆</div>
            </div>
          </div>

          <div className="rounded-full bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
            {isAuthenticated ? '已登录，当前优先展示后端 growth profile' : '未登录，当前展示这台设备上的本地成长档案'}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-amber-100 bg-white/90 p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              这里不再只展示零散记忆，而是展示已经沉淀下来的成长档案
            </div>
            <h1 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
              不再只告诉你“录过几次”，而是告诉你最近在变好哪里、还卡在哪里。
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
              这页统一展示训练记录、会话节奏、重点音节、易混声母 / 韵母 / 声调和热词。后续继续在这个 growth profile 上扩成长趋势，不再回到页面里各自拼接。
            </p>

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
                当前记忆边界
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                <li>- 先聚焦真实可解释的 growth profile：训练记录、会话、趋势、热词和常见混淆点。</li>
                <li>- 未登录时只看这台设备上的本地成长档案；登录后才合并后端已同步的数据。</li>
              </ul>
            </div>
          </aside>
        </section>

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
                  const focusSyllables = Array.isArray(metadata?.focus_syllables)
                    ? metadata.focus_syllables.filter((item): item is string => typeof item === 'string')
                    : []
                  const summary =
                    typeof metadata?.pronunciation_summary === 'string'
                      ? metadata.pronunciation_summary
                      : '先看目标句、重点音节和动作提示。'

                  return (
                    <article key={memory.id} className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-900">{memory.content}</div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                          {STATUS_LABELS[(metadata?.feedback_status as FeedbackStatus) ?? 'unclear']}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        {focusSyllables.slice(0, 4).map((syllable) => (
                          <span key={syllable} className="rounded-full bg-white px-3 py-1">
                            {syllable}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{summary}</p>
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
                    {session.topInitialPairs.length > 0 || session.topFocusSyllables.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        {[...session.topInitialPairs, ...session.topFocusSyllables].slice(0, 3).map((item) => (
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
            <div className="text-lg font-semibold text-gray-900">重点音节</div>
            <div className="mt-6">
              {renderLabelChips(
                profile.frequentSyllables,
                '训练积累后，这里会显示最常重复练的音节。',
                'sky',
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">训练重点</div>
            <div className="mt-6">
              {renderLabelChips(
                profile.frequentFocus,
                '这里会汇总你近期最常出现的训练标签。',
                'amber',
              )}
            </div>
          </article>
        </section>

        <section className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
          <div className="text-lg font-semibold text-gray-900">累计混淆模式</div>
          <div className="mt-6">
            {renderLabelChips(
              profile.frequentConfusions,
              '继续积累后，这里会把声母 / 韵母 / 声调的混淆模式一起累计起来。',
              'amber',
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">易混声母</div>
            <div className="mt-6">
              {renderLabelChips(
                profile.frequentInitialPairs,
                '继续积累后，这里会显示系统最常听混的声母对。',
                'rose',
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">易混韵母</div>
            <div className="mt-6">
              {renderLabelChips(
                profile.frequentFinalPairs,
                '继续积累后，这里会显示系统最常听混的韵母对。',
                'emerald',
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">声调提醒</div>
            <div className="mt-6">
              {renderLabelChips(
                profile.frequentTonePairs,
                '继续积累后，这里会显示最值得先盯住的声调差异。',
                'stone',
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[32px] border border-amber-100 bg-white p-8 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
            <div className="text-lg font-semibold text-gray-900">已学到的热词</div>
            <div className="mt-6">
              {profile.hotwords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.hotwords.map((hotword) => (
                    <span key={hotword} className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                      {hotword}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">训练和沟通继续积累后，这里会显示 agent 已经学到的关键词。</div>
              )}
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
          <section className="rounded-[32px] border border-dashed border-amber-200 bg-white/80 p-8 text-center shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
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
