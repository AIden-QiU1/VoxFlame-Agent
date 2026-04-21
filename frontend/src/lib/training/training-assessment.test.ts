import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeAssessmentAttempts } from './training-assessment'

test('summarizeAssessmentAttempts calculates character accuracy across completed screening words', () => {
  const summary = summarizeAssessmentAttempts([
    {
      exerciseId: 'a',
      targetText: '爸爸',
      heardText: '爸爸',
      normalizedTarget: '爸爸',
      missingChars: [],
    },
    {
      exerciseId: 'b',
      targetText: '刷牙',
      heardText: '刷',
      normalizedTarget: '刷牙',
      missingChars: ['牙'],
    },
  ], 2)

  assert.equal(summary.completedCount, 2)
  assert.equal(summary.matchedChars, 3)
  assert.equal(summary.totalChars, 4)
  assert.equal(summary.accuracyRatio, 0.75)
  assert.equal(summary.severityLabel, '轻度')
  assert.equal(summary.weakestExercises[0]?.targetText, '刷牙')
})

test('summarizeAssessmentAttempts keeps incomplete screening results provisional', () => {
  const summary = summarizeAssessmentAttempts([
    {
      exerciseId: 'a',
      targetText: '医生',
      heardText: '',
      normalizedTarget: '医生',
      missingChars: ['医', '生'],
    },
  ], 20)

  assert.equal(summary.completedCount, 1)
  assert.equal(summary.remainingCount, 19)
  assert.equal(summary.isComplete, false)
  assert.equal(summary.severityLabel, '重度')
})
