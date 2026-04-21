import assert from 'node:assert/strict'
import test from 'node:test'

import { pickPreferredTrainingTranscriptCandidate } from './final-transcript.ts'

test('training transcript selection prefers final transcript over longer interim noise', () => {
  const selected = pickPreferredTrainingTranscriptCandidate({
    baseline: '',
    latestFinal: '请把地址发给我。',
    latestInterim: '请把地址发给我。大家好，这条线连着那一条线路。',
    bestObserved: '请把地址发给我。大家好，这条线连着那一条线路。',
  })

  assert.equal(selected, '请把地址发给我。')
})

test('training transcript selection falls back to the best observed interim when final is missing', () => {
  const selected = pickPreferredTrainingTranscriptCandidate({
    baseline: '',
    latestFinal: '',
    latestInterim: '请把地',
    bestObserved: '请把地址发给我。',
  })

  assert.equal(selected, '请把地址发给我。')
})

test('training transcript selection ignores unchanged baseline finals', () => {
  const selected = pickPreferredTrainingTranscriptCandidate({
    baseline: '上一次的句子',
    latestFinal: '上一次的句子',
    latestInterim: '',
    bestObserved: '',
  })

  assert.equal(selected, '')
})
