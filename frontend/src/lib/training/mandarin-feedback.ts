import { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'

export type MandarinFeedbackStatus = 'excellent' | 'close' | 'retry' | 'unclear'

export interface MandarinTrainingFeedback {
  status: MandarinFeedbackStatus
  normalizedTarget: string
  normalizedHeard: string
  missingChars: string[]
  extraChars: string[]
  summary: string
  suggestions: string[]
}

const TAG_HINTS: Record<string, string> = {
  平翘舌: '这句重点看平翘舌，先把“说 / 事 / 处 / 助”这类字放慢。',
  翘舌音: '这句有较多翘舌音，先把卷舌动作做足，再连成整句。',
  前后鼻音: '这句容易把前后鼻音混在一起，先慢读带“ang / eng / ing”的词。',
  边鼻音: '这句可以多留意 n/l 区分，先单独练关键词再回到整句。',
  声调稳定: '先慢一点，把每个关键词的声调说稳，再整体连读。',
  送气对比: '这句里有送气和不送气的对比，起音时可以更清楚一点。',
}

function normalizeChineseText(text: string): string {
  return text.replace(/[，。！？、；：“”‘’（）()\s]/g, '').trim()
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

export function analyzeMandarinAttempt(
  exercise: MandarinTrainingExercise,
  heardText: string,
): MandarinTrainingFeedback {
  const normalizedTarget = normalizeChineseText(exercise.text)
  const normalizedHeard = normalizeChineseText(heardText)

  if (!normalizedHeard) {
    return {
      status: 'unclear',
      normalizedTarget,
      normalizedHeard,
      missingChars: Array.from(normalizedTarget),
      extraChars: [],
      summary: buildSummary('unclear', [], []),
      suggestions: [
        '先确认麦克风权限和环境噪声，再重新录一遍。',
        exercise.coachingTip,
      ],
    }
  }

  const { missingChars, extraChars } = diffChars(normalizedTarget, normalizedHeard)
  const gapCount = missingChars.length + extraChars.length

  let status: MandarinFeedbackStatus = 'retry'
  if (normalizedTarget === normalizedHeard) {
    status = 'excellent'
  } else if (gapCount <= 2) {
    status = 'close'
  }

  const suggestions: string[] = []
  if (status !== 'excellent' && missingChars.length > 0) {
    suggestions.push(`先补齐“${missingChars.join('、')}”这些关键字，再回到整句。`)
  }
  if (status !== 'excellent' && extraChars.length > 0) {
    suggestions.push(`这次多出了“${extraChars.join('、')}”，可以再慢一点，把停顿拉开。`)
  }

  const focusHint = exercise.focusTags.map((tag) => TAG_HINTS[tag]).find(Boolean)
  if (focusHint) {
    suggestions.push(focusHint)
  }

  if (suggestions.length === 0) {
    suggestions.push(exercise.coachingTip)
  }

  return {
    status,
    normalizedTarget,
    normalizedHeard,
    missingChars,
    extraChars,
    summary: buildSummary(status, missingChars, extraChars),
    suggestions: suggestions.slice(0, 2),
  }
}
