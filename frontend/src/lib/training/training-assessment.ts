export type AssessmentSeverityBand =
  | 'insufficient'
  | 'severe'
  | 'moderate'
  | 'mild'
  | 'observe'

export interface AssessmentAttemptInput {
  exerciseId: string
  targetText: string
  heardText: string
  normalizedTarget: string
  missingChars: string[]
}

export interface AssessmentExerciseScore {
  exerciseId: string
  targetText: string
  heardText: string
  matchedChars: number
  totalChars: number
  accuracyRatio: number
}

export interface AssessmentSummary {
  completedCount: number
  totalExerciseCount: number
  remainingCount: number
  matchedChars: number
  totalChars: number
  accuracyRatio: number
  severityBand: AssessmentSeverityBand
  severityLabel: string
  severitySummary: string
  isComplete: boolean
  weakestExercises: AssessmentExerciseScore[]
}

function roundToWholePercent(value: number): number {
  return Math.round(value * 100)
}

function buildExerciseScore(attempt: AssessmentAttemptInput): AssessmentExerciseScore {
  const totalChars = attempt.normalizedTarget.length
  const matchedChars = Math.max(0, totalChars - attempt.missingChars.length)
  const accuracyRatio = totalChars > 0 ? matchedChars / totalChars : 0

  return {
    exerciseId: attempt.exerciseId,
    targetText: attempt.targetText,
    heardText: attempt.heardText,
    matchedChars,
    totalChars,
    accuracyRatio,
  }
}

function resolveSeverityBand(accuracyRatio: number): {
  severityBand: AssessmentSeverityBand
  severityLabel: string
} {
  const percent = roundToWholePercent(accuracyRatio)

  if (percent < 30) {
    return {
      severityBand: 'severe',
      severityLabel: '重度',
    }
  }

  if (percent < 50) {
    return {
      severityBand: 'moderate',
      severityLabel: '中度',
    }
  }

  if (percent < 80) {
    return {
      severityBand: 'mild',
      severityLabel: '轻度',
    }
  }

  return {
    severityBand: 'observe',
    severityLabel: '待观察',
  }
}

export function summarizeAssessmentAttempts(
  attempts: AssessmentAttemptInput[],
  totalExerciseCount: number,
): AssessmentSummary {
  const exerciseScores = attempts
    .map((attempt) => buildExerciseScore(attempt))
    .filter((score) => score.totalChars > 0)

  const completedCount = exerciseScores.length
  const totalChars = exerciseScores.reduce((sum, score) => sum + score.totalChars, 0)
  const matchedChars = exerciseScores.reduce((sum, score) => sum + score.matchedChars, 0)
  const accuracyRatio = totalChars > 0 ? matchedChars / totalChars : 0
  const isComplete = totalExerciseCount > 0 && completedCount >= totalExerciseCount
  const remainingCount = Math.max(totalExerciseCount - completedCount, 0)

  if (completedCount === 0 || totalChars === 0) {
    return {
      completedCount,
      totalExerciseCount,
      remainingCount,
      matchedChars: 0,
      totalChars: 0,
      accuracyRatio: 0,
      severityBand: 'insufficient',
      severityLabel: '待开始',
      severitySummary: '先录完几条筛查词，再看字符准确率和初步等级。',
      isComplete: false,
      weakestExercises: [],
    }
  }

  const severity = resolveSeverityBand(accuracyRatio)
  const prefix = isComplete ? '本轮筛查完成后' : '当前只根据已完成的筛查词'
  const suffix = isComplete
    ? '这只是训练用分层，不替代医学评估。'
    : `还差 ${remainingCount} 条，录完这一组后结果会更稳。`

  return {
    completedCount,
    totalExerciseCount,
    remainingCount,
    matchedChars,
    totalChars,
    accuracyRatio,
    severityBand: severity.severityBand,
    severityLabel: severity.severityLabel,
    severitySummary: `${prefix}，字符准确率约 ${roundToWholePercent(accuracyRatio)}%，当前落在“${severity.severityLabel}”。${suffix}`,
    isComplete,
    weakestExercises: exerciseScores
      .slice()
      .sort((left, right) => left.accuracyRatio - right.accuracyRatio)
      .slice(0, 3),
  }
}
