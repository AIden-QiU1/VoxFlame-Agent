import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MANDARIN_TRAINING_EXERCISES,
} from './index'
import type { MandarinTrainingExercise } from './index'

function visibleChineseLength(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length
}

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

test('Mandarin training corpus has no duplicate target text per category', () => {
  const seen = new Set<string>()

  for (const exercise of MANDARIN_TRAINING_EXERCISES) {
    const key = `${exercise.category}:${exercise.text}`
    assert.equal(seen.has(key), false, `duplicate target text: ${key}`)
    seen.add(key)
  }
})
