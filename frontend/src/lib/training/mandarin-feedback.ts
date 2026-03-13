import { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'
import {
  CharacterPinyinDetail,
  formatToneLabel,
  formatPinyinDetails,
  getCharacterPinyinDetails,
  getExerciseCharPinyinPairs,
  normalizeChineseText,
  parsePinyinSyllable,
} from '@/lib/training/mandarin-pinyin'

export type MandarinFeedbackStatus = 'excellent' | 'close' | 'retry' | 'unclear'

export interface MandarinTrainingFeedback {
  status: MandarinFeedbackStatus
  normalizedTarget: string
  normalizedHeard: string
  missingChars: string[]
  extraChars: string[]
  targetDetails: CharacterPinyinDetail[]
  heardDetails: CharacterPinyinDetail[]
  targetPinyinDisplay: string
  heardPinyinDisplay: string
  focusSyllables: string[]
  articulationTips: string[]
  pronunciationInitialPairs: string[]
  pronunciationFinalPairs: string[]
  pronunciationTonePairs: string[]
  pronunciationTargets: string[]
  pronunciationSummary: string
  summary: string
  suggestions: string[]
}

interface AlignmentPair {
  target: CharacterPinyinDetail | null
  heard: CharacterPinyinDetail | null
}

const TAG_HINTS: Record<string, string> = {
  平翘舌: '这句重点看平翘舌，先把“说 / 事 / 处 / 助”这类字放慢。',
  翘舌音: '这句有较多翘舌音，先把卷舌动作做足，再连成整句。',
  前后鼻音: '这句容易把前后鼻音混在一起，先慢读带“ang / eng / ing”的词。',
  边鼻音: '这句可以多留意 n/l 区分，先单独练关键词再回到整句。',
  声调稳定: '先慢一点，把每个关键词的声调说稳，再整体连读。',
  送气对比: '这句里有送气和不送气的对比，起音时可以更清楚一点。',
}

const ARTICULATION_HINTS: Record<string, string> = {
  平翘舌: '发翘舌音时，舌尖轻轻往上卷一点，再把音送出来。',
  翘舌音: '先慢起音，舌尖往上抬，避免舌头平着往前推。',
  前后鼻音: '句尾鼻音先收住，给 ang / eng / ing 留一点鼻腔共鸣。',
  边鼻音: '练 n/l 时先把舌尖顶住上牙龈，再分清鼻腔还是口腔出气。',
  声调稳定: '先把元音拉稳，再落声调，不要一口气把整句冲过去。',
  送气对比: '送气音起音前多留一点气流，不送气音则把起音收紧。',
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

function buildAlignment(
  targetDetails: CharacterPinyinDetail[],
  heardDetails: CharacterPinyinDetail[],
): AlignmentPair[] {
  const rows = targetDetails.length + 1
  const cols = heardDetails.length + 1
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 0; i < rows; i += 1) {
    dp[i][0] = i
  }

  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost =
        targetDetails[i - 1].char === heardDetails[j - 1].char ? 0 : 1

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitutionCost,
      )
    }
  }

  const alignment: AlignmentPair[] = []
  let i = targetDetails.length
  let j = heardDetails.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const substitutionCost =
        targetDetails[i - 1].char === heardDetails[j - 1].char ? 0 : 1

      if (dp[i][j] === dp[i - 1][j - 1] + substitutionCost) {
        alignment.unshift({
          target: targetDetails[i - 1],
          heard: heardDetails[j - 1],
        })
        i -= 1
        j -= 1
        continue
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      alignment.unshift({
        target: targetDetails[i - 1],
        heard: null,
      })
      i -= 1
      continue
    }

    alignment.unshift({
      target: null,
      heard: heardDetails[j - 1],
    })
    j -= 1
  }

  return alignment
}

function buildPronunciationSummary(
  targetDetails: CharacterPinyinDetail[],
  heardDetails: CharacterPinyinDetail[],
): {
  initialPairs: string[]
  finalPairs: string[]
  tonePairs: string[]
  targets: string[]
  summary: string
} {
  const initialPairs: string[] = []
  const finalPairs: string[] = []
  const tonePairs: string[] = []

  for (const pair of buildAlignment(targetDetails, heardDetails)) {
    if (!pair.target?.known || !pair.heard?.known) {
      continue
    }

    const target = parsePinyinSyllable(pair.target.pinyin)
    const heard = parsePinyinSyllable(pair.heard.pinyin)

    if (target.initial && heard.initial && target.initial !== heard.initial) {
      initialPairs.push(`${target.initial} → ${heard.initial}`)
    }

    if (target.final && heard.final && target.final !== heard.final) {
      finalPairs.push(`${target.final} → ${heard.final}`)
    }

    if (
      target.tone !== null &&
      heard.tone !== null &&
      target.tone !== heard.tone
    ) {
      tonePairs.push(`${formatToneLabel(target.tone)} → ${formatToneLabel(heard.tone)}`)
    }
  }

  const uniqueInitialPairs = unique(initialPairs).slice(0, 3)
  const uniqueFinalPairs = unique(finalPairs).slice(0, 3)
  const uniqueTonePairs = unique(tonePairs).slice(0, 3)
  const targets = unique([
    ...uniqueInitialPairs.map((item) => `声母 ${item}`),
    ...uniqueFinalPairs.map((item) => `韵母 ${item}`),
    ...uniqueTonePairs.map((item) => `声调 ${item}`),
  ]).slice(0, 4)

  const summaryParts: string[] = []
  if (uniqueInitialPairs[0]) {
    summaryParts.push(`声母先看 ${uniqueInitialPairs[0]}`)
  }
  if (uniqueFinalPairs[0]) {
    summaryParts.push(`韵母先看 ${uniqueFinalPairs[0]}`)
  }
  if (uniqueTonePairs[0]) {
    summaryParts.push(`声调先看 ${uniqueTonePairs[0]}`)
  }

  return {
    initialPairs: uniqueInitialPairs,
    finalPairs: uniqueFinalPairs,
    tonePairs: uniqueTonePairs,
    targets,
    summary:
      summaryParts.length > 0
        ? `系统这次最容易混的是：${summaryParts.join('；')}。`
        : '这次没有看到稳定的声母 / 韵母 / 声调差异，先继续看重点音节和整句节奏。',
  }
}

function buildFocusSyllables(
  targetDetails: CharacterPinyinDetail[],
  heardDetails: CharacterPinyinDetail[],
  missingChars: string[],
  extraChars: string[],
): string[] {
  const targetFocus = targetDetails
    .filter((detail) => detail.known && missingChars.includes(detail.char))
    .map((detail) => `${detail.char}(${detail.pinyin})`)

  const heardFocus = heardDetails
    .filter((detail) => detail.known && extraChars.includes(detail.char))
    .map((detail) => `${detail.char}(${detail.pinyin})`)

  const combined = unique([...targetFocus, ...heardFocus])
  if (combined.length > 0) {
    return combined.slice(0, 4)
  }

  return targetDetails
    .filter((detail) => detail.known)
    .slice(0, 3)
    .map((detail) => `${detail.char}(${detail.pinyin})`)
}

function buildArticulationTips(exercise: MandarinTrainingExercise): string[] {
  const tips = exercise.focusTags
    .map((tag) => ARTICULATION_HINTS[tag])
    .filter(Boolean)

  return unique(tips).slice(0, 2)
}

export function analyzeMandarinAttempt(
  exercise: MandarinTrainingExercise,
  heardText: string,
): MandarinTrainingFeedback {
  const normalizedTarget = normalizeChineseText(exercise.text)
  const normalizedHeard = normalizeChineseText(heardText)
  const targetDetails = getExerciseCharPinyinPairs(exercise)
  const heardDetails = getCharacterPinyinDetails(heardText)
  const articulationTips = buildArticulationTips(exercise)
  const pronunciationSummary = buildPronunciationSummary(targetDetails, heardDetails)

  if (!normalizedHeard) {
    return {
      status: 'unclear',
      normalizedTarget,
      normalizedHeard,
      missingChars: Array.from(normalizedTarget),
      extraChars: [],
      targetDetails,
      heardDetails,
      targetPinyinDisplay: formatPinyinDetails(targetDetails),
      heardPinyinDisplay: '系统未稳定听清',
      focusSyllables: targetDetails
        .filter((detail) => detail.known)
        .slice(0, 3)
        .map((detail) => `${detail.char}(${detail.pinyin})`),
      articulationTips,
      pronunciationInitialPairs: [],
      pronunciationFinalPairs: [],
      pronunciationTonePairs: [],
      pronunciationTargets: [],
      pronunciationSummary: '这次还没有稳定拿到结果，先换安静环境再录一遍。',
      summary: buildSummary('unclear', [], []),
      suggestions: [
        '先确认麦克风权限和环境噪声，再重新录一遍。',
        articulationTips[0] || exercise.coachingTip,
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

  if (pronunciationSummary.initialPairs[0]) {
    suggestions.push(`先把声母 ${pronunciationSummary.initialPairs[0]} 拆到单音节慢练。`)
  }

  if (pronunciationSummary.finalPairs[0]) {
    suggestions.push(`先把韵母 ${pronunciationSummary.finalPairs[0]} 的口型和收尾做稳。`)
  }

  if (pronunciationSummary.tonePairs[0]) {
    suggestions.push(`先把声调 ${pronunciationSummary.tonePairs[0]} 单独拉开，再回到整句。`)
  }

  if (suggestions.length === 0) {
    suggestions.push(exercise.coachingTip)
  }

  if (articulationTips.length > 0) {
    suggestions.push(articulationTips[0])
  }

  return {
    status,
    normalizedTarget,
    normalizedHeard,
    missingChars,
    extraChars,
    targetDetails,
    heardDetails,
    targetPinyinDisplay: formatPinyinDetails(targetDetails),
    heardPinyinDisplay: formatPinyinDetails(heardDetails),
    focusSyllables: buildFocusSyllables(
      targetDetails,
      heardDetails,
      missingChars,
      extraChars,
    ),
    articulationTips,
    pronunciationInitialPairs: pronunciationSummary.initialPairs,
    pronunciationFinalPairs: pronunciationSummary.finalPairs,
    pronunciationTonePairs: pronunciationSummary.tonePairs,
    pronunciationTargets: pronunciationSummary.targets,
    pronunciationSummary: pronunciationSummary.summary,
    summary: buildSummary(status, missingChars, extraChars),
    suggestions: unique(suggestions).slice(0, 3),
  }
}
