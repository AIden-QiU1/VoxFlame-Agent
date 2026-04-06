import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateNormalizedInputLevel,
  classifyMicrophoneInputFeedback,
} from './microphone-input-feedback.ts'

test('calculateNormalizedInputLevel returns 0 for silence-like samples', () => {
  const data = new Uint8Array([128, 128, 128, 128])
  assert.equal(calculateNormalizedInputLevel(data), 0)
})

test('classifyMicrophoneInputFeedback marks low level input as quiet', () => {
  const feedback = classifyMicrophoneInputFeedback(0.02, true)
  assert.equal(feedback.quality, 'quiet')
  assert.match(feedback.hint, /麦克风靠近一点/)
})

test('classifyMicrophoneInputFeedback marks mid level input as balanced', () => {
  const feedback = classifyMicrophoneInputFeedback(0.08, true)
  assert.equal(feedback.quality, 'balanced')
})

test('classifyMicrophoneInputFeedback marks high level input as loud', () => {
  const feedback = classifyMicrophoneInputFeedback(0.28, true)
  assert.equal(feedback.quality, 'loud')
  assert.match(feedback.hint, /远一点/)
})
