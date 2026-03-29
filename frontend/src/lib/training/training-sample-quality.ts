import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'
import type { MandarinTrainingFeedback } from '@/lib/training/mandarin-feedback'

export type TrainingSampleQualityTier = 'ready' | 'usable' | 'review' | 'retry'
export type TrainingSampleQualityAction = 'keep' | 'review' | 'retry'

export interface TrainingSampleQuality {
  score: number
  tier: TrainingSampleQualityTier
  action: TrainingSampleQualityAction
  confidence: number
  latencyMs: number
  coverageRatio: number
  summary: string
  reasons: string[]
}

interface AssessTrainingSampleQualityOptions {
  feedback: MandarinTrainingFeedback
  recording: VoxFlameRecordingEnvelope | null
  transcriptLatencyMs: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

function deriveTier(score: number): {
  tier: TrainingSampleQualityTier
  action: TrainingSampleQualityAction
  summary: string
} {
  if (score >= 85) {
    return {
      tier: 'ready',
      action: 'keep',
      summary: '这条样本已经适合继续进入训练语料，可以把精力放回下一句。',
    }
  }

  if (score >= 65) {
    return {
      tier: 'usable',
      action: 'keep',
      summary: '这条样本可以保留进训练链路，但后面最好再补一条更稳的版本。',
    }
  }

  if (score >= 40) {
    return {
      tier: 'review',
      action: 'review',
      summary: '这条样本已经留下来了，但建议先结合目标句和反馈再判断要不要补录。',
    }
  }

  return {
    tier: 'retry',
    action: 'retry',
    summary: '这条样本已被记录为一次尝试，但更建议马上重录一遍更稳的版本。',
  }
}

export function assessTrainingSampleQuality(
  options: AssessTrainingSampleQualityOptions,
): TrainingSampleQuality {
  const { feedback, recording, transcriptLatencyMs } = options
  const targetLength = feedback.normalizedTarget.length
  const heardLength = feedback.normalizedHeard.length
  const coverageRatio = targetLength > 0
    ? clamp(heardLength / targetLength, 0, 1)
    : 0

  const statusBaseScore: Record<MandarinTrainingFeedback['status'], number> = {
    excellent: 92,
    close: 76,
    retry: 54,
    unclear: 18,
  }

  let score = statusBaseScore[feedback.status]
  const reasons: string[] = []

  if (recording) {
    if (recording.audio.durationMs < 900) {
      score -= 18
      reasons.push('录音过短，建议把整句完整说完再停。')
    } else if (recording.audio.durationMs < 1_500) {
      score -= 8
      reasons.push('录音略短，下一条可以把尾音留完整一点。')
    } else {
      reasons.push('录音时长基本够支撑这一句继续进入训练链路。')
    }
  } else {
    score -= 24
    reasons.push('当前没有完整录音 envelope，只能先当作一次反馈尝试。')
  }

  if (coverageRatio >= 0.95) {
    score += 4
    reasons.push('系统听到的内容和目标句覆盖度很高。')
  } else if (coverageRatio >= 0.75) {
    reasons.push('系统已经听到了大部分关键词。')
  } else if (coverageRatio >= 0.45) {
    score -= 8
    reasons.push('系统只听到了部分关键词，后面最好补一条更完整的录音。')
  } else {
    score -= 18
    reasons.push('系统听到的关键词偏少，这条样本更像一次需要回看的尝试。')
  }

  if (feedback.missingChars.length === 0 && feedback.extraChars.length === 0 && feedback.status === 'excellent') {
    score += 4
  }

  if (feedback.status === 'unclear') {
    reasons.push('这次识别结果不稳定，适合保留为一次尝试，但不适合作为高质量样本。')
  } else if (feedback.status === 'retry') {
    reasons.push('这次和目标句还有明显差异，建议继续以目标句为准补录。')
  } else if (feedback.status === 'close') {
    reasons.push('这次已经接近目标句，可保留，也值得后续补一条更稳的版本。')
  }

  if (transcriptLatencyMs > 4_500) {
    score -= 8
    reasons.push('最终 transcript 返回偏慢，这条样本的收尾稳定性一般。')
  } else if (transcriptLatencyMs > 2_500) {
    score -= 4
    reasons.push('最终 transcript 返回稍慢，但仍可继续保留。')
  } else {
    reasons.push('最终 transcript 返回速度正常。')
  }

  const normalizedScore = clamp(Math.round(score), 0, 100)
  const confidence = roundToTwo(
    clamp(0.16 + normalizedScore / 100 * 0.78, 0.16, 0.94),
  )
  const derived = deriveTier(normalizedScore)

  return {
    score: normalizedScore,
    tier: derived.tier,
    action: derived.action,
    confidence,
    latencyMs: transcriptLatencyMs,
    coverageRatio: roundToTwo(coverageRatio),
    summary: derived.summary,
    reasons,
  }
}
