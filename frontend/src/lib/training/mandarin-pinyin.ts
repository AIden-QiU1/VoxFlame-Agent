import {
  MANDARIN_TRAINING_EXERCISES,
  MandarinTrainingExercise,
} from '@/lib/corpus/mandarin-training'

export interface CharacterPinyinDetail {
  char: string
  pinyin: string
  known: boolean
}

export interface PinyinSyllableDetail {
  original: string
  base: string
  initial: string
  final: string
  tone: number | null
}

const PINYIN_TOKEN_REGEX = /[a-zA-Z\u00fc\u0101-\u01dc]+/g
const CHINESE_PUNCTUATION_REGEX = /[，。！？、；：“”‘’（）()\s]/g
const INITIALS = [
  'zh',
  'ch',
  'sh',
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'r',
  'z',
  'c',
  's',
  'y',
  'w',
]
const TONE_MARKS: Record<string, { base: string; tone: number }> = {
  ā: { base: 'a', tone: 1 },
  á: { base: 'a', tone: 2 },
  ǎ: { base: 'a', tone: 3 },
  à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 },
  é: { base: 'e', tone: 2 },
  ě: { base: 'e', tone: 3 },
  è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 },
  í: { base: 'i', tone: 2 },
  ǐ: { base: 'i', tone: 3 },
  ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 },
  ó: { base: 'o', tone: 2 },
  ǒ: { base: 'o', tone: 3 },
  ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 },
  ú: { base: 'u', tone: 2 },
  ǔ: { base: 'u', tone: 3 },
  ù: { base: 'u', tone: 4 },
  ǖ: { base: 'ü', tone: 1 },
  ǘ: { base: 'ü', tone: 2 },
  ǚ: { base: 'ü', tone: 3 },
  ǜ: { base: 'ü', tone: 4 },
  ü: { base: 'ü', tone: 0 },
}

export function normalizeChineseText(text: string): string {
  return text.replace(CHINESE_PUNCTUATION_REGEX, '').trim()
}

export function tokenizePinyin(pinyin: string): string[] {
  return pinyin.match(PINYIN_TOKEN_REGEX) ?? []
}

export function parsePinyinSyllable(pinyin: string): PinyinSyllableDetail {
  let tone: number | null = null
  let base = ''

  for (const char of pinyin.toLowerCase()) {
    const mapped = TONE_MARKS[char]
    if (mapped) {
      base += mapped.base
      if (mapped.tone > 0) {
        tone = mapped.tone
      }
      continue
    }

    if (/[1-5]/.test(char)) {
      const parsed = Number.parseInt(char, 10)
      tone = parsed === 5 ? 0 : parsed
      continue
    }

    base += char
  }

  const normalizedBase = base.replace(/v/g, 'ü')
  const initial = INITIALS.find((candidate) => normalizedBase.startsWith(candidate)) ?? ''
  const final = normalizedBase.slice(initial.length) || normalizedBase

  return {
    original: pinyin,
    base: normalizedBase,
    initial,
    final,
    tone,
  }
}

export function formatToneLabel(tone: number | null): string {
  if (tone === null) {
    return '未知声调'
  }

  if (tone === 0) {
    return '轻声'
  }

  return `${tone}声`
}

export function getExerciseCharPinyinPairs(
  exercise: MandarinTrainingExercise,
): CharacterPinyinDetail[] {
  const chars = Array.from(normalizeChineseText(exercise.text))
  const syllables = tokenizePinyin(exercise.pinyin)

  return chars.map((char, index) => ({
    char,
    pinyin: syllables[index] ?? '',
    known: Boolean(syllables[index]),
  }))
}

function buildCharacterLexicon(): Map<string, string> {
  const lexicon = new Map<string, string>()

  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    for (const pair of getExerciseCharPinyinPairs(exercise)) {
      if (pair.known && !lexicon.has(pair.char)) {
        lexicon.set(pair.char, pair.pinyin)
      }
    }
  }

  return lexicon
}

const CHARACTER_LEXICON = buildCharacterLexicon()

export function getCharacterPinyinDetails(text: string): CharacterPinyinDetail[] {
  return Array.from(normalizeChineseText(text)).map((char) => ({
    char,
    pinyin: CHARACTER_LEXICON.get(char) ?? '',
    known: CHARACTER_LEXICON.has(char),
  }))
}

export function formatPinyinDetails(details: CharacterPinyinDetail[]): string {
  if (details.length === 0) {
    return '未获得有效拼音'
  }

  return details
    .map((detail) => (detail.known ? `${detail.char}(${detail.pinyin})` : `${detail.char}(?)`))
    .join(' ')
}
