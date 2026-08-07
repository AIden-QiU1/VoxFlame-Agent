#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'


const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(SCRIPT_DIR, '..')
const INPUT_PATH = path.join(
  FRONTEND_DIR,
  'src/lib/corpus/generated/mandarin-training-real.json',
)
const OUTPUT_PATH = path.join(
  FRONTEND_DIR,
  'src/lib/corpus/generated/mandarin-phonology-index.json',
)

const GROUPS = [
  {
    id: 'labial',
    label: '双唇与唇齿音',
    shortLabel: 'b p m f',
    description: '练双唇闭合、送气和下唇接触上齿。',
    initials: new Set(['b', 'p', 'm', 'f']),
  },
  {
    id: 'tongue-tip-mid',
    label: '舌尖中音',
    shortLabel: 'd t n l',
    description: '练舌尖抵住上齿龈后的阻塞、送气和鼻音。',
    initials: new Set(['d', 't', 'n', 'l']),
  },
  {
    id: 'velar',
    label: '舌根音',
    shortLabel: 'g k h',
    description: '练舌根抬起后的阻塞、送气和摩擦。',
    initials: new Set(['g', 'k', 'h']),
  },
  {
    id: 'palatal',
    label: '舌面音',
    shortLabel: 'j q x',
    description: '练舌面前部接近硬腭时的细致控制。',
    initials: new Set(['j', 'q', 'x']),
  },
  {
    id: 'sibilants',
    label: '平舌与翘舌音',
    shortLabel: 'z c s / zh ch sh r',
    description: '对照平舌和翘舌位置，减少连续语流中的混淆。',
    initials: new Set(['z', 'c', 's', 'zh', 'ch', 'sh', 'r']),
  },
  {
    id: 'nasal-finals',
    label: '前后鼻韵母',
    shortLabel: 'n / ng 韵尾',
    description: '练前鼻音和后鼻音韵尾的收束位置。',
    finals: new Set(['an', 'en', 'in', 'ian', 'uan', 'üan', 'un', 'ün', 'ang', 'eng', 'ing', 'ong', 'iang', 'uang', 'ueng', 'iong']),
  },
  {
    id: 'compound-finals',
    label: '复韵母',
    shortLabel: 'ai ei ao ou 等',
    description: '练口形在一个音节内平稳滑动，不吞掉韵尾。',
    finals: new Set(['ai', 'ei', 'ao', 'ou', 'ia', 'ie', 'ua', 'uo', 'üe', 'iao', 'iou', 'uai', 'uei']),
  },
  {
    id: 'tones',
    label: '声调与变调',
    shortLabel: '四声 / 一不变调',
    description: '练四声对比、三声连读，以及“一”“不”的语流变调。',
  },
]

function normalizeFinal(value) {
  return value.replace(/[0-5]/g, '').replaceAll('v', 'ü')
}

function unique(values) {
  return [...new Set(values)]
}

export function annotatePhonology(text) {
  const natural = pinyin(text, {
    type: 'all',
    toneType: 'num',
    toneSandhi: true,
    nonZh: 'removed',
  }).filter((item) => item.isZh)
  const citation = pinyin(text, {
    type: 'all',
    toneType: 'num',
    toneSandhi: false,
    nonZh: 'removed',
  }).filter((item) => item.isZh)

  const initials = natural.map((item) => item.initial)
  const finals = natural.map((item) => normalizeFinal(item.final))
  const tones = natural.map((item) => item.num)
  const citationTones = citation.map((item) => item.num)
  const labels = []

  for (const group of GROUPS) {
    if (group.initials) {
      const matches = initials.filter((initial) => group.initials.has(initial))
      if (matches.length >= 2) {
        labels.push({
          id: group.id,
          focus: unique(matches).join(' / '),
          score: matches.length,
        })
      }
      continue
    }

    if (group.finals) {
      const matches = finals.filter((final) => group.finals.has(final))
      if (matches.length >= 2) {
        labels.push({
          id: group.id,
          focus: unique(matches).join(' / '),
          score: matches.length,
        })
      }
      continue
    }

    const lexicalTones = unique(tones.filter((tone) => tone >= 1 && tone <= 4))
    const hasThirdToneSequence = tones.some((tone, index) => tone === 3 && tones[index + 1] === 3)
    const sandhiCharacters = natural
      .filter((item, index) => (
        (item.origin === '一' || item.origin === '不') && item.num !== citationTones[index]
      ))
      .map((item) => item.origin)
    if (lexicalTones.length === 4 || hasThirdToneSequence || sandhiCharacters.length > 0) {
      const focus = [
        lexicalTones.length === 4 ? '四声对比' : null,
        hasThirdToneSequence ? '三声连读' : null,
        ...unique(sandhiCharacters).map((character) => `${character}字变调`),
      ].filter(Boolean).join(' / ')
      labels.push({
        id: group.id,
        focus,
        score: lexicalTones.length + (hasThirdToneSequence ? 2 : 0) + sandhiCharacters.length * 2,
      })
    }
  }

  return labels.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
}

export function buildIndex(payload) {
  const exercises = payload.categories?.['音系强化']?.items ?? []
  const items = {}
  const counts = Object.fromEntries(GROUPS.map((group) => [group.id, 0]))

  for (const exercise of exercises) {
    const labels = annotatePhonology(exercise.text).slice(0, 3)
    if (labels.length === 0) {
      continue
    }
    items[exercise.id] = labels
    for (const label of labels) {
      counts[label.id] += 1
    }
  }

  return {
    kind: 'mandarin_phonology_training_index',
    policy: {
      sentence_can_belong_to_multiple_groups: true,
      maximum_groups_per_sentence: 3,
      consonant_or_final_minimum_hits: 2,
      tone_group_requires: ['all_four_tones', 'third_tone_sequence', 'yi_or_bu_tone_sandhi'],
      ungrouped_sentences_remain_available_in_all: true,
    },
    groups: GROUPS.map(({ id, label, shortLabel, description }) => ({
      id,
      label,
      shortLabel,
      description,
      count: counts[id],
    })),
    indexed_exercise_count: Object.keys(items).length,
    source_exercise_count: exercises.length,
    items,
  }
}

function main() {
  const payload = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'))
  const index = buildIndex(payload)
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  console.log(`indexed: ${index.indexed_exercise_count}/${index.source_exercise_count}`)
  for (const group of index.groups) {
    console.log(`${group.label}: ${group.count}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
