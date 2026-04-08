'use client'

import type {
  RtcCapabilityId,
  RtcSessionIntent,
  RtcResolvedSessionIntent,
  RtcSessionReadiness,
  RtcSessionReadinessSummary,
  RtcSessionStrategy,
} from '@/lib/realtime-audio/session-contract'

interface SessionReadinessPanelProps {
  intent: RtcResolvedSessionIntent | null
  readiness: RtcSessionReadiness | null
  grantedCapabilities: RtcCapabilityId[]
  plannedIntent?: RtcSessionIntent
  title?: string
  className?: string
}

const STRATEGY_LABELS: Record<RtcSessionStrategy, string> = {
  heavy_realtime: '实时主链',
  light_voice: '轻语音入口',
}

const CAPABILITY_LABELS: Record<RtcCapabilityId, string> = {
  transport_send_control: '实时发送',
  voice_profile_update: '训练画像同步',
  workspace_snapshot_read: '共享画像读取',
  upload_artifact_persist: '训练样本入链',
}

function sceneLabel(scene: string | undefined): string {
  if (!scene) {
    return '当前未指定'
  }

  return scene
}

function modeLabel(mode: RtcSessionIntent['mode'] | undefined): string {
  if (mode === 'training') {
    return '训练'
  }

  if (mode === 'communication') {
    return '沟通'
  }

  if (mode === 'quick_talk') {
    return '轻入口'
  }

  return '当前'
}

function describeReadiness(
  readiness: RtcSessionReadiness | null,
  plannedIntent: RtcSessionIntent | undefined,
): RtcSessionReadinessSummary & { tone: string } {
  const modeText = modeLabel(plannedIntent?.mode)

  if (!readiness) {
    return {
      status: 'can_start',
      label: '等待开始',
      tone: 'border-stone-200 bg-stone-50 text-stone-700',
      detail:
        plannedIntent?.mode === 'training'
          ? `${modeText}页已经准备好录音、反馈和自动保存，只等你开始这一轮。`
          : `${modeText}页已经准备好连接助手和代播链路，只等你先开口。`,
      nextAction:
        plannedIntent?.mode === 'training'
          ? '先点录音；训练页会自动拉起录音、反馈和保存链路。'
          : '先点连接助手，或者直接点一句场景句开始。',
      blockerSummary: null,
      warningSummary: null,
    }
  }

  const tone =
    readiness.summary.status === 'needs_attention'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : readiness.summary.status === 'can_start'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  return {
    ...readiness.summary,
    tone,
  }
}

export function SessionReadinessPanel({
  intent,
  readiness,
  grantedCapabilities,
  plannedIntent,
  title = '当前准备状态',
  className = '',
}: SessionReadinessPanelProps) {
  const effectiveIntent = intent ?? plannedIntent ?? null
  const effectiveCapabilities = grantedCapabilities.length > 0
    ? grantedCapabilities
    : (plannedIntent?.requestedCapabilities ?? [])
  const readinessCopy = describeReadiness(readiness, plannedIntent)
  const effectiveModeLabel = modeLabel(effectiveIntent?.mode)

  return (
    <section className={`rounded-[28px] border border-stone-200 bg-stone-50 p-5 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-700">{title}</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            这里只回答三件事：现在是否准备好、下一步点哪里、如果没成功大概卡在哪。
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${readinessCopy.tone}`}>
          {readinessCopy.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white px-4 py-4">
          <p className="text-xs uppercase text-stone-500">现在状态</p>
          <p className="mt-2 text-sm font-medium text-stone-900">{readinessCopy.detail}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-4">
          <p className="text-xs uppercase text-stone-500">下一步</p>
          <p className="mt-2 text-sm font-medium text-stone-900">{readinessCopy.nextAction}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-stone-700">
        <p className="font-medium text-stone-900">{effectiveModeLabel}说明</p>
        <p className="mt-2">
          {effectiveModeLabel === '训练'
            ? '这些状态只是在帮你确认这一句会怎么进入反馈和保存链路，不是让你学习系统术语。'
            : '这些状态只是在帮你确认现在能不能直接开口，不是让你学习系统术语。'}
        </p>
        {readinessCopy.blockerSummary ? (
          <p className="mt-2 text-rose-700">阻塞项：{readinessCopy.blockerSummary}</p>
        ) : null}
        {!readinessCopy.blockerSummary && readinessCopy.warningSummary ? (
          <p className="mt-2 text-amber-700">提醒：{readinessCopy.warningSummary}</p>
        ) : null}

        <details className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-800">
            查看技术细节
          </summary>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-stone-500">Surface</p>
              <p className="mt-1 text-sm font-medium text-stone-900">{effectiveIntent?.surface || '尚未解析'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-stone-500">Mode</p>
              <p className="mt-1 text-sm font-medium text-stone-900">{effectiveIntent?.mode || '尚未解析'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-stone-500">Strategy</p>
              <p className="mt-1 text-sm font-medium text-stone-900">
                {readiness
                  ? STRATEGY_LABELS[readiness.resolvedStrategy]
                  : effectiveIntent
                    ? STRATEGY_LABELS[effectiveIntent.sessionStrategy]
                    : '尚未解析'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-stone-500">Scene</p>
              <p className="mt-1 text-sm font-medium text-stone-900">{sceneLabel(effectiveIntent?.scene)}</p>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-xs uppercase text-stone-500">Capability</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {effectiveCapabilities.length > 0 ? effectiveCapabilities.map((capability) => (
                <span
                  key={capability}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700"
                >
                  {CAPABILITY_LABELS[capability]}
                </span>
              )) : (
                <span className="text-sm text-stone-600">还没有拿到可用 capability。</span>
              )}
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}

export default SessionReadinessPanel
