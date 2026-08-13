'use client'

import type {
  RtcCapabilityId,
  RtcSessionIntent,
  RtcResolvedSessionIntent,
  RtcSessionReadiness,
  RtcSessionReadinessSummary,
} from '@/lib/realtime-audio/session-contract'
import { toProductMessage } from '@/lib/ui/product-message'

interface SessionReadinessPanelProps {
  intent: RtcResolvedSessionIntent | null
  readiness: RtcSessionReadiness | null
  grantedCapabilities: RtcCapabilityId[]
  plannedIntent?: RtcSessionIntent
  title?: string
  className?: string
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
          ? `${modeText}已准备好。`
          : `${modeText}助手等待连接。`,
      nextAction:
        plannedIntent?.mode === 'training'
          ? '点击录音开始。'
          : '连接助手或选择一句短语。',
      blockerSummary: null,
      warningSummary: null,
    }
  }

  if (readiness.summary.status === 'needs_attention') {
    const diagnostic = [...readiness.blockers, ...readiness.warnings].join(' ')
    return {
      status: 'needs_attention',
      label: '暂时不可用',
      tone: 'border-rose-200 bg-rose-50 text-rose-800',
      detail: toProductMessage(diagnostic, 'realtime'),
      nextAction: '检查权限或网络后重试。',
      blockerSummary: null,
      warningSummary: null,
    }
  }

  return readiness.summary.status === 'ready'
    ? {
        status: 'ready',
        label: '可以开始',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        detail: `${modeText}已准备好。`,
        nextAction: plannedIntent?.mode === 'training' ? '点击录音开始。' : '现在可以开始沟通。',
        blockerSummary: null,
        warningSummary: null,
      }
    : {
        status: 'can_start',
        label: '等待开始',
        tone: 'border-amber-200 bg-amber-50 text-amber-800',
        detail: `${modeText}助手等待连接。`,
        nextAction: '点击连接后开始。',
        blockerSummary: null,
        warningSummary: null,
      }
}

export function SessionReadinessPanel({
  readiness,
  plannedIntent,
  title = '当前准备状态',
  className = '',
}: SessionReadinessPanelProps) {
  const readinessCopy = describeReadiness(readiness, plannedIntent)

  return (
    <section className={`rounded-[28px] border border-stone-200 bg-stone-50 p-5 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-700">{title}</p>
          <p className="mt-1 text-sm leading-6 text-pretty text-stone-600">{readinessCopy.detail}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${readinessCopy.tone}`}>
          {readinessCopy.label}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-white px-4 py-4">
        <p className="text-xs text-stone-500">下一步</p>
        <p className="mt-2 text-sm font-medium text-pretty text-stone-900">{readinessCopy.nextAction}</p>
      </div>
    </section>
  )
}

export default SessionReadinessPanel
