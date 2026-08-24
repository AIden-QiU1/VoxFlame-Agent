import { pinyin } from 'pinyin-pro'

export const CORE_INITIALS = [
  '∅',
  'b', 'p', 'm', 'f',
  'd', 't', 'n', 'l',
  'g', 'k', 'h',
  'j', 'q', 'x',
  'zh', 'ch', 'sh', 'r',
  'z', 'c', 's',
]

// This is a normalized Hanyu Pinyin final inventory, not a claim that every
// item is a single phoneme. Apical-i is separated because it has a different
// phonetic realization after z/c/s and zh/ch/sh/r.
export const CORE_FINALS = [
  'a', 'o', 'e', 'ê', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er',
  'i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong',
  'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang', 'ueng', 'ong',
  'ü', 'üe', 'üan', 'ün',
  'i_apical_alveolar', 'i_apical_postalveolar',
]

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's']
const ALVEOLAR_APICAL = new Set(['z', 'c', 's'])
const POSTALVEOLAR_APICAL = new Set(['zh', 'ch', 'sh', 'r'])
const BLOCKED_CANDIDATE_CONTENT = /色情|性交|强奸|猥亵|嫖娼|卖淫|赤裸|自杀|杀人|尸体|绑架|黑帮|毒品|赌博|政党|宗教|祈祷|唵嘛|仇恨|种族|枪支|炸弹|癌症|处方|诊断|法律建议/u
const BLOCKED_CANDIDATE_NAMES = /汤姆|玛丽|萨米|约翰|彼得|杰克|爱丽丝|鲍勃/u

const ACCENTED_VOWELS = new Map(Object.entries({
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ê̄: ['ê', 1], ế: ['ê', 2], ê̌: ['ê', 3], ề: ['ê', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['ü', 1], ǘ: ['ü', 2], ǚ: ['ü', 3], ǜ: ['ü', 4],
  ń: ['n', 2], ň: ['n', 3], ǹ: ['n', 4], ḿ: ['m', 2],
}))

export function numberedPinyinFromDiacritics(value) {
  let tone = 0
  let base = ''
  for (const character of value.normalize('NFC').toLowerCase()) {
    const replacement = ACCENTED_VOWELS.get(character)
    if (replacement) {
      base += replacement[0]
      tone = replacement[1]
    } else if (character !== '\u0304' && character !== '\u030c' && character !== '\u0300' && character !== '\u0301') {
      base += character
    }
  }
  return `${base.replaceAll('v', 'ü')}${tone}`
}

export function isBlockedGapCandidate(text) {
  return BLOCKED_CANDIDATE_CONTENT.test(text) || BLOCKED_CANDIDATE_NAMES.test(text)
}

export function splitNumberedSyllable(value) {
  const normalized = value.trim().toLowerCase().replaceAll('v', 'ü')
  const match = normalized.match(/^(.+?)([0-5])?$/u)
  return {
    base: match?.[1] ?? normalized,
    tone: Number(match?.[2] ?? 0),
  }
}

export function normalizePinyinSyllable(value) {
  const { base, tone } = splitNumberedSyllable(value)
  let initial = '∅'
  let final = base

  if (base.startsWith('y')) {
    const zeroInitialY = {
      yi: 'i', ya: 'ia', yao: 'iao', ye: 'ie', you: 'iou',
      yan: 'ian', yin: 'in', yang: 'iang', ying: 'ing', yong: 'iong',
      yu: 'ü', yue: 'üe', yuan: 'üan', yun: 'ün',
    }
    final = zeroInitialY[base] ?? base.slice(1)
  } else if (base.startsWith('w')) {
    const zeroInitialW = {
      wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'uei',
      wan: 'uan', wen: 'uen', wang: 'uang', weng: 'ueng',
    }
    final = zeroInitialW[base] ?? base.slice(1)
  } else {
    initial = INITIALS.find((candidate) => base.startsWith(candidate)) ?? '∅'
    final = initial === '∅' ? base : base.slice(initial.length)

    if (ALVEOLAR_APICAL.has(initial) && final === 'i') {
      final = 'i_apical_alveolar'
    } else if (POSTALVEOLAR_APICAL.has(initial) && final === 'i') {
      final = 'i_apical_postalveolar'
    } else if (['j', 'q', 'x'].includes(initial) && final.startsWith('u')) {
      final = `ü${final.slice(1)}`
    }

    if (final === 'iu') final = 'iou'
    if (final === 'ui') final = 'uei'
    if (final === 'un') final = ['j', 'q', 'x'].includes(initial) ? 'ün' : 'uen'
    if (final === 'ue' && ['j', 'q', 'x'].includes(initial)) final = 'üe'
  }

  return {
    orthographic: base,
    initial,
    final,
    tone,
    syllableTone: `${base}${tone}`,
  }
}

export function annotateMandarinText(text) {
  const citation = pinyin(text, {
    type: 'all',
    toneType: 'num',
    toneSandhi: false,
    nonZh: 'removed',
    initialPattern: 'standard',
  }).filter((item) => item.isZh)
  const surface = pinyin(text, {
    type: 'all',
    toneType: 'num',
    toneSandhi: true,
    nonZh: 'removed',
    initialPattern: 'standard',
  }).filter((item) => item.isZh)

  const syllables = citation.map((item, index) => {
    const normalized = normalizePinyinSyllable(item.pinyin)
    return {
      ...normalized,
      character: item.origin,
      position: index === 0 ? 'initial' : index === citation.length - 1 ? 'final' : 'medial',
      surfaceTone: surface[index]?.num ?? normalized.tone,
    }
  })

  return {
    syllables,
    tonePairs: syllables.slice(0, -1).map((item, index) => `${item.tone}-${syllables[index + 1].tone}`),
    thirdToneSequences: syllables.filter((item, index) => item.tone === 3 && syllables[index + 1]?.tone === 3).length,
    yiSandhi: syllables.filter((item) => item.character === '一' && item.surfaceTone !== item.tone).length,
    buSandhi: syllables.filter((item) => item.character === '不' && item.surfaceTone !== item.tone).length,
    neutralTones: syllables.filter((item) => item.tone === 0).length,
    erhuaCandidates: (text.match(/[\p{Script=Han}]儿(?![\p{Script=Han}])/gu) ?? []).length,
  }
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4))
}

function sortedCounts(map) {
  return Object.fromEntries([...map.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])))
}

function inventoryCoverage(expected, counts, minimumHits) {
  const present = expected.filter((item) => (counts.get(item) ?? 0) > 0)
  const robust = expected.filter((item) => (counts.get(item) ?? 0) >= minimumHits)
  return {
    expected: expected.length,
    present: present.length,
    robust: robust.length,
    presence_ratio: ratio(present.length, expected.length),
    robust_ratio: ratio(robust.length, expected.length),
    missing: expected.filter((item) => !present.includes(item)),
    below_minimum: expected.filter((item) => present.includes(item) && !robust.includes(item)),
  }
}

export function auditEntries(entries, reference, { minimumHits = 20 } = {}) {
  const initials = new Map()
  const finals = new Map()
  const tones = new Map()
  const syllables = new Map()
  const syllableTones = new Map()
  const tonePairs = new Map()
  const categories = new Map()
  const positions = new Map()
  const explicitRecordingTargets = new Map()
  let syllableCount = 0
  let thirdToneSequences = 0
  let yiSandhi = 0
  let buSandhi = 0
  let neutralTones = 0
  let erhuaCandidates = 0

  for (const entry of entries) {
    const text = String(entry.text ?? '').trim()
    if (!text) continue
    increment(categories, String(entry.category ?? '未分区'))
    const annotation = annotateMandarinText(text)
    syllableCount += annotation.syllables.length
    thirdToneSequences += annotation.thirdToneSequences
    yiSandhi += annotation.yiSandhi
    buSandhi += annotation.buSandhi
    neutralTones += annotation.neutralTones
    erhuaCandidates += annotation.erhuaCandidates

    for (const syllable of annotation.syllables) {
      increment(initials, syllable.initial)
      increment(finals, syllable.final)
      increment(tones, String(syllable.tone))
      increment(syllables, syllable.orthographic)
      increment(syllableTones, syllable.syllableTone)
      increment(positions, `${syllable.position}:${syllable.initial}`)
      increment(positions, `${syllable.position}:${syllable.final}`)
    }
    for (const pair of annotation.tonePairs) increment(tonePairs, pair)

    // Recording-ready packs may carry a verified whole-word or whole-sentence
    // reading that differs from the generic grapheme-to-pinyin fallback (for
    // example, polyphonic characters such as 阿胶/心脏/炸鱼). Keep this as a
    // separate, auditable coverage channel instead of silently replacing the
    // ordinary linguistic annotation for every prompt.
    if (entry.recording_readiness === 'ready_for_recording' && Array.isArray(entry.coverage_targets)) {
      for (const target of new Set(entry.coverage_targets.filter((value) => typeof value === 'string' && value.trim()))) {
        increment(explicitRecordingTargets, target)
      }
    }
  }

  const referenceSyllables = reference?.syllables ?? []
  const referenceSyllableTones = reference?.syllable_tones ?? []
  return {
    summary: {
      entries: entries.length,
      unique_texts: new Set(entries.map((entry) => String(entry.text ?? '').trim()).filter(Boolean)).size,
      syllables: syllableCount,
      categories: categories.size,
      minimum_hits_for_robust_coverage: minimumHits,
    },
    coverage: {
      initials: inventoryCoverage(CORE_INITIALS, initials, minimumHits),
      finals: inventoryCoverage(CORE_FINALS, finals, minimumHits),
      tones: inventoryCoverage(['0', '1', '2', '3', '4'], tones, minimumHits),
      common_syllables: inventoryCoverage(referenceSyllables, syllables, minimumHits),
      common_syllable_tones: inventoryCoverage(referenceSyllableTones, syllableTones, minimumHits),
      explicit_recording_targets: inventoryCoverage(referenceSyllableTones, explicitRecordingTargets, minimumHits),
      citation_tone_pairs: inventoryCoverage(
        ['1', '2', '3', '4'].flatMap((left) => ['1', '2', '3', '4', '0'].map((right) => `${left}-${right}`)),
        tonePairs,
        minimumHits,
      ),
    },
    connected_speech: {
      third_tone_sequences: thirdToneSequences,
      yi_sandhi_tokens: yiSandhi,
      bu_sandhi_tokens: buSandhi,
      neutral_tone_tokens: neutralTones,
      orthographic_erhua_candidates: erhuaCandidates,
    },
    distributions: {
      initials: sortedCounts(initials),
      finals: sortedCounts(finals),
      tones: sortedCounts(tones),
      categories: sortedCounts(categories),
      tone_pairs: sortedCounts(tonePairs),
      positions: sortedCounts(positions),
      syllables: sortedCounts(syllables),
      syllable_tones: sortedCounts(syllableTones),
    },
  }
}
