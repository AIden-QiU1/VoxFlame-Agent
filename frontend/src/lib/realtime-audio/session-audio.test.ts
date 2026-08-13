import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatMicrophoneError,
  getSessionNotReadyMessage,
} from './session-audio.ts'

test('session-audio formats missing microphone errors into user-facing guidance', () => {
  const message = formatMicrophoneError({
    name: 'NotFoundError',
    message: 'Requested device not found',
  })

  assert.equal(message, '未找到麦克风，可先使用文字沟通。')
})

test('session-audio formats insecure-context microphone errors into secure-context guidance', () => {
  const message = formatMicrophoneError({
    name: 'SecurityError',
    message: 'MediaDevices API is only available in secure contexts',
  })

  assert.equal(message, '当前浏览器不支持语音，请使用系统浏览器。')
})

test('session-audio returns mode-specific session not ready copy', () => {
  assert.equal(getSessionNotReadyMessage('training'), '训练会话还没准备好，请重新点击开始录音。')
  assert.equal(getSessionNotReadyMessage('communication'), '请先连接助手。')
})
