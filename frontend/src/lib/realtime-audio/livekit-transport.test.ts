import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatRtcConnectionError,
  resolveBrowserLiveKitUrl,
} from './livekit-transport.ts'

function withWindowOrigin(origin: string, fn: () => void): void {
  const previousWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        origin,
      },
    },
  })

  try {
    fn()
  } finally {
    if (previousWindow === undefined) {
      // @ts-expect-error cleanup test shim
      delete globalThis.window
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      })
    }
  }
}

test('resolveBrowserLiveKitUrl keeps remote non-loopback origins unchanged', () => {
  withWindowOrigin('http://127.0.0.1:3000', () => {
    assert.equal(
      resolveBrowserLiveKitUrl('wss://livekit.example.com'),
      'wss://livekit.example.com',
    )
  })
})

test('resolveBrowserLiveKitUrl aligns localhost loopback url to current page origin host', () => {
  withWindowOrigin('http://127.0.0.1:3000', () => {
    assert.equal(
      resolveBrowserLiveKitUrl('ws://localhost:3000'),
      'ws://127.0.0.1:3000',
    )
  })
})

test('resolveBrowserLiveKitUrl upgrades to wss when page origin is https', () => {
  withWindowOrigin('https://localhost', () => {
    assert.equal(
      resolveBrowserLiveKitUrl('ws://127.0.0.1:3000'),
      'wss://localhost',
    )
  })
})

test('formatRtcConnectionError rewrites pc connection failures into actionable guidance', () => {
  const message = formatRtcConnectionError(
    new Error('ConnectionError: could not establish pc connection'),
  )

  assert.match(message, /实时语音连接/)
  assert.match(message, /手机热点/)
})
