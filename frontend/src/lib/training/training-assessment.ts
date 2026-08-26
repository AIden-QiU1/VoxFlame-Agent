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
  normalizedHeard: string
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

export function calculateCharacterEditDistance(target: string, heard: string): number {
  const targetChars = Array.from(target)
  const heardChars = Array.from(heard)
  let previous = Array.from({ length: heardChars.length + 1 }, (_, index) => index)

  for (let targetIndex = 1; targetIndex <= targetChars.length; targetIndex += 1) {
    const current = [targetIndex]
    for (let heardIndex = 1; heardIndex <= heardChars.length; heardIndex += 1) {
      const substitutionCost = targetChars[targetIndex - 1] === heardChars[heardIndex - 1] ? 0 : 1
      current[heardIndex] = Math.min(
        current[heardIndex - 1] + 1,
        previous[heardIndex] + 1,
        previous[heardIndex - 1] + substitutionCost,
      )
    }
    previous = current
  }

  return previous[heardChars.length]
}

function buildExerciseScore(attempt: AssessmentAttemptInput): AssessmentExerciseScore {
  const totalChars = Array.from(attempt.normalizedTarget).length
  const editDistance = calculateCharacterEditDistance(attempt.normalizedTarget, attempt.normalizedHeard)
  const matchedChars = Math.max(0, totalChars - editDistance)
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
      severityLabel: '高支持需求',
    }
  }

  if (percent < 50) {
    return {
      severityBand: 'moderate',
      severityLabel: '中支持需求',
    }
  }

  if (percent < 80) {
    return {
      severityBand: 'mild',
      severityLabel: '低支持需求',
    }
  }

  return {
    severityBand: 'observe',
    severityLabel: '继续观察',
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
      severitySummary: '先录完几条筛查词，再看系统听清率和训练支持建议。',
      isComplete: false,
      weakestExercises: [],
    }
  }

  if (!isComplete) {
    return {
      completedCount,
      totalExerciseCount,
      remainingCount,
      matchedChars,
      totalChars,
      accuracyRatio,
      severityBand: 'insufficient',
      severityLabel: '评估中',
      severitySummary: `当前已完成 ${completedCount}/${totalExerciseCount} 条，还差 ${remainingCount} 条。整组完成前不生成训练支持级别。`,
      isComplete: false,
      weakestExercises: exerciseScores
        .slice()
        .sort((left, right) => left.accuracyRatio - right.accuracyRatio)
        .slice(0, 3),
    }
  }

  const severity = resolveSeverityBand(accuracyRatio)

  return {
    completedCount,
    totalExerciseCount,
    remainingCount,
    matchedChars,
    totalChars,
    accuracyRatio,
    severityBand: severity.severityBand,
    severityLabel: severity.severityLabel,
    severitySummary: `本轮系统转写字符准确率约 ${roundToWholePercent(accuracyRatio)}%，建议按“${severity.severityLabel}”安排训练辅助。这反映当前系统听清程度，不是医学严重程度。`,
    isComplete,
    weakestExercises: exerciseScores
      .slice()
      .sort((left, right) => left.accuracyRatio - right.accuracyRatio)
      .slice(0, 3),
  }
}
