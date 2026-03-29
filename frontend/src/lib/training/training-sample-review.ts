import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'
import type { MandarinTrainingFeedback } from '@/lib/training/mandarin-feedback'
import type { TrainingSampleQuality } from '@/lib/training/training-sample-quality'

export type TrainingEvaluationStatus = 'ready' | 'sampled_for_review' | 'retry_recommended'
export type TrainingReviewQueue = 'auto_accept' | 'manual_review' | 'retry_recommended'
export type TrainingReviewPriority = 'low' | 'medium' | 'high'

export interface TrainingSampleReviewDecision {
  evaluationStatus: TrainingEvaluationStatus
  reviewQueue: TrainingReviewQueue
  reviewPriority: TrainingReviewPriority
  reviewRequired: boolean
  reasonTags: string[]
  summary: string
}

interface DeriveTrainingSampleReviewOptions {
  feedback: MandarinTrainingFeedback
  sampleQuality: TrainingSampleQuality
  recording: VoxFlameRecordingEnvelope | null
}

function buildReasonTags(
  feedback: MandarinTrainingFeedback,
  sampleQuality: TrainingSampleQuality,
  recording: VoxFlameRecordingEnvelope | null,
): string[] {
  const tags = new Set<string>()

  if (!recording) {
    tags.add('missing_recording')
  } else if (recording.audio.durationMs < 1_500) {
    tags.add('short_recording')
  }

  if (sampleQuality.coverageRatio < 0.75) {
    tags.add('low_transcript_coverage')
  }

  if (sampleQuality.latencyMs > 2_500) {
    tags.add('slow_finalize')
  }

  if (feedback.status === 'unclear') {
    tags.add('unclear_recognition')
  }

  if (feedback.status === 'retry') {
    tags.add('pronunciation_gap')
  }

  if (feedback.missingChars.length > 0) {
    tags.add('missing_target_chars')
  }

  if (feedback.extraChars.length > 0) {
    tags.add('extra_detected_chars')
  }

  if (sampleQuality.tier === 'usable') {
    tags.add('usable_with_minor_gap')
  }

  return Array.from(tags)
}

export function deriveTrainingSampleReviewDecision(
  options: DeriveTrainingSampleReviewOptions,
): TrainingSampleReviewDecision {
  const { feedback, sampleQuality, recording } = options
  const reasonTags = buildReasonTags(feedback, sampleQuality, recording)

  if (sampleQuality.tier === 'ready' || sampleQuality.tier === 'usable') {
    return {
      evaluationStatus: 'ready',
      reviewQueue: 'auto_accept',
      reviewPriority: 'low',
      reviewRequired: false,
      reasonTags,
      summary: sampleQuality.tier === 'ready'
        ? '这条样本可直接进入训练集，不需要额外复核。'
        : '这条样本可直接进入训练集；后续如做抽样质检再回看即可。',
    }
  }

  if (sampleQuality.tier === 'review') {
    return {
      evaluationStatus: 'sampled_for_review',
      reviewQueue: 'manual_review',
      reviewPriority:
        feedback.status === 'unclear' || sampleQuality.coverageRatio < 0.45
          ? 'high'
          : 'medium',
      reviewRequired: true,
      reasonTags,
      summary: '这条样本建议进入 review queue，回看后再决定是否继续保留或补录。',
    }
  }

  return {
    evaluationStatus: 'retry_recommended',
    reviewQueue: 'retry_recommended',
    reviewPriority: 'high',
    reviewRequired: false,
    reasonTags,
    summary: '这条音频仍会进入训练样本链路，但会标记为“建议补录”，方便后续复核和导出筛选。',
  }
}
