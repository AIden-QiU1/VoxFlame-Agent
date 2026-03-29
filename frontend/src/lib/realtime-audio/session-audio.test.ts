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

  assert.equal(message, '当前设备未检测到可用麦克风，可先用文字或短语沟通。')
})

test('session-audio formats insecure-context microphone errors into secure-context guidance', () => {
  const message = formatMicrophoneError({
    name: 'SecurityError',
    message: 'MediaDevices API is only available in secure contexts',
  })

  assert.equal(message, '当前环境暂时无法访问麦克风，请确认使用 HTTPS 或本地地址访问。')
})

test('session-audio returns mode-specific session not ready copy', () => {
  assert.equal(getSessionNotReadyMessage('training'), '训练会话还没准备好，请重新点击开始录音。')
  assert.equal(getSessionNotReadyMessage('communication'), '请先连接助手。')
})
