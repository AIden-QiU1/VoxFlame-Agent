import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import type {
  RtcExecutionBackend,
  RtcSessionIntent,
  RtcSessionMode,
} from './session-contract'
import type { StartRtcSessionResponse } from './session-types'

function buildApiUrl(path: string): string {
  return `${config.api.baseUrl}${path}`
}

export async function buildAuthorizedJsonHeaders(): Promise<Record<string, string>> {
  const token = await getValidToken()
  if (!token) {
    throw new Error('请先登录后再使用这个功能。')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

interface StartRtcSessionOptions {
  executionBackend?: RtcExecutionBackend
}

export async function startRtcSession(
  mode: RtcSessionMode,
  intent: RtcSessionIntent,
  options: StartRtcSessionOptions = {},
): Promise<StartRtcSessionResponse> {
  const headers = await buildAuthorizedJsonHeaders()
  const response = await fetch(buildApiUrl('/rtc/session/start'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode,
      intent,
      ...(options.executionBackend
        ? { executionBackend: options.executionBackend }
        : {}),
    }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || 'RTC 会话启动失败')
  }

  return response.json() as Promise<StartRtcSessionResponse>
}

export async function pingRtcSession(channelName: string): Promise<void> {
  const headers = await buildAuthorizedJsonHeaders()
  await fetch(buildApiUrl('/rtc/session/ping'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ channelName }),
  })
}

export async function stopRtcSession(channelName: string): Promise<void> {
  const headers = await buildAuthorizedJsonHeaders()
  await fetch(buildApiUrl('/rtc/session/stop'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ channelName }),
  })
}
