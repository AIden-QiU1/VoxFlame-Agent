import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MANDARIN_TRAINING_CATEGORIES,
  MANDARIN_TRAINING_EXERCISES,
} from './index'
import type { MandarinTrainingExercise } from './index'

function visibleChineseLength(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length
}

const TRADITIONAL_CHINESE_BLOCKLIST = Array.from(
  '國與雲觀賊適於傷靈聞騎陰陽賢後內異稱謹計難補闕氣餘論詔吳違據敗鈍損無興陳諸則聖臨遠離隂敘並開關書讀處語聲韻歲夢歸風華東萬長學臺蘭懷懐扵爲為覺說聽應醫藥婦兒時間現點帶幫請讓這個們會來車話發電號門樓亂傳兩冊勝喚嘗圖報壯將宮廬張從復慮憶戰戶撲攬敵暢業極樂機殤洩漢濺營爺猶畢畫當盡簡紅終絕絲織脫腳蓋虛見視親觴討託許訴詩該誕誠諮豬責買賞跡軍載轡辭連週達遺邊錄鐵閣際隨雖韉領頭願類顧飛馬馳駿騁驅鳴黃齊龜僞創娛妝爾窺舊舎衞覩遊歎羣円脩稧',
)

const MODERN_READING_WEB_NOISE = [
  '刷题',
  '在线老师',
  '咨询在线',
  '初中学科',
  '学科知识',
  '综合素质',
  '教师资格',
  '题库',
  '课程',
  '资料',
  '证书',
  '报名',
  '希赛',
  'app下载',
]

const LOW_QUALITY_TERMS = [
  '女尸',
  '尸体',
  '自杀',
  '死亡',
  '杀人',
  '毒品',
  '战争',
  '总统',
  '汤姆',
  '玛丽',
  '上帝',
  '维基',
  '版权',
  '隐私',
  '协议',
  '我要听',
  '给我听',
  '我想听',
  '支持文章',
  '月经',
  '谋杀',
  '癌细胞',
  '手足口病',
]

function repeatSignature(text: string): string {
  return text
    .replace(/[零一二三四五六七八九十百千万亿两幺]+/g, '数')
    .replace(/第[数]+/g, '第数')
    .replace(/[年月日号点分秒周星期公里元块楼层号]/g, '量')
    .replace(/(我|你|您|他|她|我们|你们|他们|大家)/g, '人')
    .replace(/(医生|护士|老师|同学|妈妈|爸爸|朋友|同事|客服|司机|乘务员)/g, '角色')
}

test('Mandarin training corpus stays within the guided prompt size', () => {
  const nonAssessmentPrompts = MANDARIN_TRAINING_EXERCISES.filter(
    (exercise: MandarinTrainingExercise) => exercise.category !== '评估筛查',
  )

  assert.ok(
    nonAssessmentPrompts.length >= 8_000,
    `expected at least 8000 trainable prompts, got ${nonAssessmentPrompts.length}`,
  )

  for (const exercise of nonAssessmentPrompts) {
    const length = visibleChineseLength(exercise.text)
    assert.ok(
      length >= 7 && length <= 18,
      `${exercise.id} should be 7-18 chars, got ${length}: ${exercise.text}`,
    )
  }
})

test('Mandarin training corpus removes the classical Chinese category', () => {
  assert.equal((MANDARIN_TRAINING_CATEGORIES as readonly string[]).includes('文言文节奏'), false)
  assert.equal(MANDARIN_TRAINING_CATEGORIES.includes('音系强化'), true)
  assert.equal(
    MANDARIN_TRAINING_EXERCISES.some((exercise) => String(exercise.category) === '文言文节奏'),
    false,
  )
})

test('Mandarin training corpus target text is Simplified Chinese only', () => {
  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    const leaked = TRADITIONAL_CHINESE_BLOCKLIST.filter((char) => exercise.text.includes(char))
    assert.deepEqual(leaked, [], `${exercise.id} contains Traditional Chinese: ${exercise.text}`)
  }
})

test('Modern article reading corpus excludes page and training-site noise', () => {
  const modernReadingPrompts = MANDARIN_TRAINING_EXERCISES.filter(
    (exercise: MandarinTrainingExercise) => exercise.category === '现代文章朗读',
  )

  assert.ok(modernReadingPrompts.length >= 500, `expected modern reading prompts, got ${modernReadingPrompts.length}`)

  for (const exercise of modernReadingPrompts) {
    const leaked = MODERN_READING_WEB_NOISE.filter((term) => exercise.text.includes(term))
    assert.deepEqual(leaked, [], `${exercise.id} contains web noise: ${exercise.text}`)
  }
})

test('Mandarin training corpus excludes low-quality and sensitive fragments', () => {
  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    const leaked = LOW_QUALITY_TERMS.filter((term) => exercise.text.includes(term))
    assert.deepEqual(leaked, [], `${exercise.id} contains low-quality term: ${exercise.text}`)
  }
})

test('Mandarin training corpus has no duplicate target text per category', () => {
  const seen = new Set<string>()

  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    const key = exercise.text
    assert.equal(seen.has(key), false, `duplicate target text: ${key}`)
    seen.add(key)
  }
})

test('Mandarin training corpus limits near-duplicate sentence structures', () => {
  const counts = new Map<string, number>()

  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    if (exercise.category === '评估筛查') {
      continue
    }

    const key = `${exercise.category}:${repeatSignature(exercise.text)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const overLimit = Array.from(counts.entries()).filter(([, count]) => count > 8)
  assert.deepEqual(overLimit, [], `near-duplicate structures exceeded limit: ${JSON.stringify(overLimit.slice(0, 5))}`)
})
