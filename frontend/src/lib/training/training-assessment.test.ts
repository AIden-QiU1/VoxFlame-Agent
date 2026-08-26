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
      normalizedHeard: '爸爸',
    },
    {
      exerciseId: 'b',
      targetText: '刷牙',
      heardText: '刷',
      normalizedTarget: '刷牙',
      normalizedHeard: '刷',
    },
  ], 2)

  assert.equal(summary.completedCount, 2)
  assert.equal(summary.matchedChars, 3)
  assert.equal(summary.totalChars, 4)
  assert.equal(summary.accuracyRatio, 0.75)
  assert.equal(summary.severityLabel, '低支持需求')
  assert.equal(summary.weakestExercises[0]?.targetText, '刷牙')
})

test('summarizeAssessmentAttempts keeps incomplete screening results provisional', () => {
  const summary = summarizeAssessmentAttempts([
    {
      exerciseId: 'a',
      targetText: '医生',
      heardText: '',
      normalizedTarget: '医生',
      normalizedHeard: '',
    },
  ], 20)

  assert.equal(summary.completedCount, 1)
  assert.equal(summary.remainingCount, 19)
  assert.equal(summary.isComplete, false)
  assert.equal(summary.severityBand, 'insufficient')
  assert.equal(summary.severityLabel, '评估中')
  assert.match(summary.severitySummary, /不生成训练支持级别/)
})

test('summarizeAssessmentAttempts penalizes substitutions and extra characters', () => {
  const summary = summarizeAssessmentAttempts([
    {
      exerciseId: 'substitution',
      targetText: '医生',
      heardText: '衣生',
      normalizedTarget: '医生',
      normalizedHeard: '衣生',
    },
    {
      exerciseId: 'insertion',
      targetText: '爸爸',
      heardText: '爸爸好',
      normalizedTarget: '爸爸',
      normalizedHeard: '爸爸好',
    },
  ], 2)

  assert.equal(summary.matchedChars, 2)
  assert.equal(summary.totalChars, 4)
  assert.equal(summary.accuracyRatio, 0.5)
  assert.equal(summary.severityLabel, '低支持需求')
})
