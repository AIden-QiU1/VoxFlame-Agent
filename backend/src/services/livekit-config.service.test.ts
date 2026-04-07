import assert from 'node:assert/strict'
import { TokenVerifier } from 'livekit-server-sdk'
import {
  LiveKitConfigError,
  LiveKitConfigService,
} from './livekit-config.service'
import { LiveKitSessionService } from './livekit-session.service'

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void,
): void {
  const previous = new Map<string, string | undefined>()

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key])
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    fn()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

async function runLiveKitConfigTests(): Promise<void> {
  withEnv(
    {
      LIVEKIT_URL: undefined,
      LIVEKIT_BROWSER_URL: undefined,
      VOXFLAME_PUBLIC_BASE_URL: undefined,
      LIVEKIT_API_KEY: undefined,
      LIVEKIT_API_SECRET: undefined,
      LIVEKIT_AGENT_NAME: undefined,
      RTC_ENABLE_LIVEKIT_EXPERIMENT: undefined,
    },
    () => {
      const service = new LiveKitConfigService()
      const status = service.getStatus()

      assert.equal(status.configured, false)
      assert.equal(status.enabled, false)
      assert.deepEqual(status.missingEnv, [
        'LIVEKIT_URL',
        'LIVEKIT_API_KEY',
        'LIVEKIT_API_SECRET',
      ])
      assert.match(status.detail, /not configured yet/i)
    },
  )

  withEnv(
    {
      LIVEKIT_URL: 'wss://livekit.example.com',
      LIVEKIT_BROWSER_URL: 'wss://browser-livekit.example.com',
      VOXFLAME_PUBLIC_BASE_URL: undefined,
      LIVEKIT_API_KEY: 'lk_api_key',
      LIVEKIT_API_SECRET: 'lk_api_secret',
      RTC_ENABLE_LIVEKIT_EXPERIMENT: '0',
    },
    () => {
      const service = new LiveKitConfigService()

      assert.throws(
        () => service.assertCanStart(),
        (error: unknown) =>
          error instanceof LiveKitConfigError &&
          error.statusCode === 501 &&
          /not enabled yet/i.test(error.message),
      )
    },
  )

  withEnv(
    {
      LIVEKIT_URL: 'wss://livekit.internal.example.com',
      LIVEKIT_BROWSER_URL: 'wss://livekit.example.com',
      VOXFLAME_PUBLIC_BASE_URL: undefined,
      LIVEKIT_API_KEY: 'lk_api_key',
      LIVEKIT_API_SECRET: 'lk_api_secret',
      LIVEKIT_AGENT_NAME: 'voxflame-agent',
      RTC_ENABLE_LIVEKIT_EXPERIMENT: 'true',
    },
    () => {
      const service = new LiveKitConfigService()
      const status = service.getStatus()

      assert.equal(status.configured, true)
      assert.equal(status.enabled, true)
      assert.equal(status.serverUrl, 'wss://livekit.internal.example.com')
      assert.equal(status.browserUrl, 'wss://livekit.example.com')
      assert.equal(status.agentName, 'voxflame-agent')
      assert.deepEqual(status.missingEnv, [])
      assert.doesNotThrow(() => service.assertCanStart())
    },
  )

  withEnv(
    {
      LIVEKIT_URL: 'ws://livekit-server:7880',
      LIVEKIT_BROWSER_URL: undefined,
      VOXFLAME_PUBLIC_BASE_URL: 'https://111.230.35.89.sslip.io',
      LIVEKIT_API_KEY: 'lk_api_key',
      LIVEKIT_API_SECRET: 'lk_api_secret',
      RTC_ENABLE_LIVEKIT_EXPERIMENT: 'true',
    },
    () => {
      const service = new LiveKitConfigService()
      const status = service.getStatus()

      assert.equal(status.serverUrl, 'ws://livekit-server:7880')
      assert.equal(status.browserUrl, 'wss://111.230.35.89.sslip.io')
    },
  )

  const service = new LiveKitSessionService()
  const session = await service.createSession({
    requestId: 'req_livekit_12345678',
    roomName: 'voxflame-room-1',
    userUid: 42,
    timeoutSeconds: 120,
    intent: {
      surface: 'communication_workspace',
      mode: 'communication',
      sessionStrategy: 'heavy_realtime',
      requestedCapabilities: ['transport_send_control'],
      grantedCapabilities: ['transport_send_control'],
      scene: 'medical',
      deviceContext: {
        secureContext: true,
        mediaDevicesSupported: true,
        microphoneStatus: 'unknown',
        networkOnline: true,
      },
    },
    readiness: {
      canStart: true,
      requestedStrategy: 'heavy_realtime',
      resolvedStrategy: 'heavy_realtime',
      recommendedStrategy: 'heavy_realtime',
      microphoneRequired: true,
      blockers: [],
      warnings: [],
      summary: {
        status: 'ready',
        label: '已经准备好',
        detail: '沟通会话可以开始。',
        nextAction: '直接连接并开始表达。',
        blockerSummary: null,
        warningSummary: null,
      },
    },
    serverUrl: 'wss://livekit.example.com',
    apiKey: 'test_api_key',
    apiSecret: 'test_api_secret',
    agentName: 'voxflame-agent',
  })

  assert.equal(session.roomName, 'voxflame-room-1')
  assert.equal(session.participantName, 'voxflame-user-42')
  assert.equal(session.participantAttributes['vox.mode'], 'communication')
  assert.equal(session.agentDispatch?.agentName, 'voxflame-agent')

  const verifier = new TokenVerifier('test_api_key', 'test_api_secret')
  const grants = await verifier.verify(session.participantToken)
  assert.equal(grants.video?.room, 'voxflame-room-1')
  assert.equal(grants.metadata, session.participantMetadata)
  assert.equal(grants.attributes?.['vox.surface'], 'communication_workspace')

  console.log('livekit-session.service tests passed')

  console.log('livekit-config.service tests passed')
}

runLiveKitConfigTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
