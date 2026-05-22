import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
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

test('Mandarin training corpus stays within the guided prompt size', () => {
  const nonAssessmentPrompts = MANDARIN_TRAINING_EXERCISES.filter(
    (exercise: MandarinTrainingExercise) => exercise.category !== '评估筛查',
  )

  assert.ok(
    nonAssessmentPrompts.length >= 1_000 && nonAssessmentPrompts.length <= 2_000,
    `expected 1000-2000 trainable prompts, got ${nonAssessmentPrompts.length}`,
  )

  for (const exercise of nonAssessmentPrompts) {
    const length = visibleChineseLength(exercise.text)
    assert.ok(
      length >= 6 && length <= 16,
      `${exercise.id} should be 6-16 chars, got ${length}: ${exercise.text}`,
    )
  }
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

test('Mandarin training corpus has no duplicate target text per category', () => {
  const seen = new Set<string>()

  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    const key = `${exercise.category}:${exercise.text}`
    assert.equal(seen.has(key), false, `duplicate target text: ${key}`)
    seen.add(key)
  }
})
