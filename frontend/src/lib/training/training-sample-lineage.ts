import type { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'
import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'

export interface TrainingSampleLineage {
  promptGroupKey: string
  promptFingerprint: string
  recordingDedupeKey: string
  duplicatePolicy: 'exact_recording_retry_only'
  repeatedPromptStrategy: 'keep_multiple_attempts'
}

function toKeySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
}

function normalizePromptText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '')
    .replace(/[。，“”‘’！？、,.!?;；:：'"`~()\[\]{}<>《》]/g, '')
}

export function buildTrainingSampleLineage(
  exercise: MandarinTrainingExercise,
  recording: VoxFlameRecordingEnvelope,
): TrainingSampleLineage {
  return {
    promptGroupKey: `mandarin:${toKeySegment(exercise.category)}:${toKeySegment(exercise.id)}`,
    promptFingerprint: normalizePromptText(exercise.text),
    recordingDedupeKey: recording.recordingId,
    duplicatePolicy: 'exact_recording_retry_only',
    repeatedPromptStrategy: 'keep_multiple_attempts',
  }
}
