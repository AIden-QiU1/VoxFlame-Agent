import { memoryService } from '@/lib/memory/memory-service'
import type { StartRtcSessionResponse } from './session-types'

interface SyncRtcSessionProfileOptions {
  session: StartRtcSessionResponse
  userId: string | undefined
  suppressGreeting?: boolean
  sendControl: (type: string, payload?: Record<string, unknown>) => Promise<void>
}

export async function syncRtcSessionProfile({
  session,
  userId,
  suppressGreeting,
  sendControl,
}: SyncRtcSessionProfileOptions): Promise<void> {
  const voiceProfilePayload = memoryService.buildVoiceProfileSyncPayload()

  if (!userId) {
    throw new Error('请先登录后再使用这个功能。')
  }

  await sendControl('system_init', {
    user: { id: userId },
    suppress_greeting: Boolean(suppressGreeting),
    session_intent: {
      surface: session.intent.surface,
      mode: session.intent.mode,
      session_strategy: session.intent.sessionStrategy,
      requested_capabilities: session.intent.requestedCapabilities,
      granted_capabilities: session.intent.grantedCapabilities,
      scene: session.intent.scene,
    },
    session_readiness: session.readiness,
  })

  if (voiceProfilePayload) {
    await sendControl('update_voice_profile', voiceProfilePayload)
  }
}
