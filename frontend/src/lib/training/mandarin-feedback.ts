import {
  MandarinTrainingExercise,
  getTrainingTipsForCategory,
} from '@/lib/corpus/mandarin-training'
import { normalizeChineseText } from '@/lib/training/mandarin-text'

export type MandarinFeedbackStatus = 'excellent' | 'close' | 'retry' | 'unclear'

export interface MandarinTrainingFeedback {
  status: MandarinFeedbackStatus
  normalizedTarget: string
  normalizedHeard: string
  missingChars: string[]
  extraChars: string[]
  speechPatterns: string[]
  articulationTips: string[]
  pronunciationTargets: string[]
  pronunciationSummary: string
  summary: string
  suggestions: string[]
}

function buildLcsTable(target: string[], heard: string[]): number[][] {
  const rows = target.length + 1
  const cols = heard.length + 1
  const table = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (target[i - 1] === heard[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1])
      }
    }
  }

  return table
}

function diffChars(target: string, heard: string): { missingChars: string[]; extraChars: string[] } {
  const targetChars = Array.from(target)
  const heardChars = Array.from(heard)
  const table = buildLcsTable(targetChars, heardChars)

  const missingChars: string[] = []
  const extraChars: string[] = []

  let i = targetChars.length
  let j = heardChars.length

  while (i > 0 && j > 0) {
    if (targetChars[i - 1] === heardChars[j - 1]) {
      i -= 1
      j -= 1
      continue
    }

    if (table[i - 1][j] >= table[i][j - 1]) {
      missingChars.unshift(targetChars[i - 1])
      i -= 1
    } else {
      extraChars.unshift(heardChars[j - 1])
      j -= 1
    }
  }

  while (i > 0) {
    missingChars.unshift(targetChars[i - 1])
    i -= 1
  }

  while (j > 0) {
    extraChars.unshift(heardChars[j - 1])
    j -= 1
  }

  return { missingChars, extraChars }
}

function buildSummary(
  status: MandarinFeedbackStatus,
  missingChars: string[],
  extraChars: string[],
): string {
  if (status === 'unclear') {
    return '这次系统还没稳定听清，建议换安静一点的环境，再慢一点说。'
  }

  if (status === 'excellent') {
    return '这次系统听到的内容和目标句一致，可以继续保持这个节奏。'
  }

  if (status === 'close') {
    const missing = missingChars.length > 0 ? `少了“${missingChars.join('、')}”` : ''
    const extra = extraChars.length > 0 ? `多了“${extraChars.join('、')}”` : ''
    const detail = [missing, extra].filter(Boolean).join('，')
    return `这次已经比较接近目标句了，${detail || '还有少量差异'}。`
  }

  return '这次和目标句还有明显差异，建议先看关键词，再分段慢练。'
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function buildPronunciationSummary(
  missingChars: string[],
  extraChars: string[],
): {
  targets: string[]
  summary: string
} {
  const targets = unique([
    ...missingChars.map((char) => `补稳“${char}”`),
    ...extraChars.map((char) => `收住“${char}”`),
  ]).slice(0, 4)

  const summaryParts = [
    missingChars.length > 0 ? `漏掉了“${missingChars.join('、')}”` : '',
    extraChars.length > 0 ? `多带出了“${extraChars.join('、')}”` : '',
  ].filter(Boolean)

  return {
    targets,
    summary:
      summaryParts.length > 0
        ? `系统这次最容易出错的是：${summaryParts.join('；')}。`
        : '这次没有看到稳定的固定混淆，先继续看整句节奏和关键字是否完整。',
  }
}

function buildFocusSyllables(
  normalizedTarget: string,
  missingChars: string[],
  extraChars: string[],
): string[] {
  const combined = unique([...missingChars, ...extraChars])
  if (combined.length > 0) {
    return combined.slice(0, 4)
  }

  return Array.from(normalizedTarget).slice(0, 3)
}

function buildArticulationTips(
  exercise: MandarinTrainingExercise,
  missingChars: string[],
  extraChars: string[],
): string[] {
  const observedTips = [
    missingChars.length > 0 ? `先只盯“${missingChars[0]}”这个字，把动作做慢一点。` : '',
    extraChars.length > 0 ? '先把每个字之间留半拍，不要急着把句子连过去。' : '',
  ].filter(Boolean)

  return unique([
    ...observedTips,
    ...getTrainingTipsForCategory(exercise.category),
  ]).slice(0, 3)
}

function buildMotorSuggestions(
  status: MandarinFeedbackStatus,
  missingChars: string[],
  extraChars: string[],
  pronunciationSummary: {
    targets: string[]
  },
  articulationTips: string[],
  categoryTips: string[],
): string[] {
  const suggestions: string[] = []

  if (status === 'unclear') {
    suggestions.push('先把整句缩短一点、说慢一点，先求每个字都清楚出来。')
  }

  if (missingChars.length > 0) {
    suggestions.push(`先只盯“${missingChars.join('、')}”这些字，嘴巴动作放慢，再回到整句。`)
  }

  if (extraChars.length > 0) {
    suggestions.push(`这次有字连在一起了，下一遍每个字之间留半拍，不要急着往下冲。`)
  }

  if (pronunciationSummary.targets[0]) {
    suggestions.push(`先把 ${pronunciationSummary.targets[0]}，再回到整句。`)
  }

  if (articulationTips.length > 0) {
    suggestions.push(articulationTips[0])
  }

  if (suggestions.length === 0) {
    suggestions.push(categoryTips[0] || '先放慢、张口更明确一点，再把整句分成两段练。')
  }

  return unique(suggestions).slice(0, 3)
}

export function analyzeMandarinAttempt(
  exercise: MandarinTrainingExercise,
  heardText: string,
): MandarinTrainingFeedback {
  const normalizedTarget = normalizeChineseText(exercise.text)
  const normalizedHeard = normalizeChineseText(heardText)
  const pronunciationSummary = buildPronunciationSummary([], [])
  const categoryTips = getTrainingTipsForCategory(exercise.category)
  const baseFocus = Array.from(normalizedTarget).slice(0, 3)
  const articulationTips = buildArticulationTips(
    exercise,
    [],
    [],
  )

  if (!normalizedHeard) {
    return {
      status: 'unclear',
      normalizedTarget,
      normalizedHeard,
      missingChars: Array.from(normalizedTarget),
      extraChars: [],
      speechPatterns: baseFocus,
      articulationTips,
      pronunciationTargets: [],
      pronunciationSummary: '这次还没有稳定拿到结果，先换安静环境再录一遍。',
      summary: buildSummary('unclear', [], []),
      suggestions: [
        '先确认麦克风权限和环境噪声，再重新录一遍。',
        articulationTips[0] || categoryTips[0] || '先选安静环境，再慢慢读一遍。',
      ],
    }
  }

  const { missingChars, extraChars } = diffChars(normalizedTarget, normalizedHeard)
  const gapCount = missingChars.length + extraChars.length
  const nextPronunciationSummary = buildPronunciationSummary(missingChars, extraChars)
  const nextArticulationTips = buildArticulationTips(
    exercise,
    missingChars,
    extraChars,
  )

  let status: MandarinFeedbackStatus = 'retry'
  if (normalizedTarget === normalizedHeard) {
    status = 'excellent'
  } else if (gapCount <= 2) {
    status = 'close'
  }

  const suggestions = buildMotorSuggestions(
    status,
    missingChars,
    extraChars,
    nextPronunciationSummary,
    nextArticulationTips,
    categoryTips,
  )

  return {
    status,
    normalizedTarget,
    normalizedHeard,
    missingChars,
    extraChars,
    speechPatterns: buildFocusSyllables(
      normalizedTarget,
      missingChars,
      extraChars,
    ),
    articulationTips: nextArticulationTips,
    pronunciationTargets: nextPronunciationSummary.targets,
    pronunciationSummary: nextPronunciationSummary.summary,
    summary: buildSummary(status, missingChars, extraChars),
    suggestions,
  }
}
