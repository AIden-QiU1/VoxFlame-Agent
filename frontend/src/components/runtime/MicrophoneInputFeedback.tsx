'use client'

import { useMicrophoneInputFeedback } from '@/lib/audio/microphone-input-feedback'
import { cn } from '@/lib/utils'

interface MicrophoneInputFeedbackProps {
  analyser: AnalyserNode | null
  active: boolean
  title?: string
  className?: string
}

const TONE_STYLES = {
  inactive: {
    badge: 'bg-stone-100 text-stone-700',
    meter: 'bg-stone-300',
  },
  quiet: {
    badge: 'bg-amber-100 text-amber-800',
    meter: 'bg-amber-500',
  },
  balanced: {
    badge: 'bg-emerald-100 text-emerald-800',
    meter: 'bg-emerald-500',
  },
  loud: {
    badge: 'bg-rose-100 text-rose-800',
    meter: 'bg-rose-500',
  },
} as const

export function MicrophoneInputFeedback({
  analyser,
  active,
  title = '当前收音质量',
  className,
}: MicrophoneInputFeedbackProps) {
  const feedback = useMicrophoneInputFeedback(analyser, active)
  const tone = TONE_STYLES[feedback.quality]
  const width = `${Math.max(8, Math.min(100, Math.round(feedback.level * 340)))}%`

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-900">{title}</p>
          <p className="mt-1 text-sm text-stone-600">{feedback.hint}</p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', tone.badge)}>
          {feedback.label}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={cn('h-full rounded-full transition-[width] duration-150', tone.meter)}
          style={{ width }}
        />
      </div>
    </div>
  )
}

export default MicrophoneInputFeedback
