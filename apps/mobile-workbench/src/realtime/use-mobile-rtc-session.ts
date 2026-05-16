import {
  useCallback,
  useMemo,
  useState,
} from 'react'

import type {
  MobileAuthTokenProvider,
} from '../api/mobile-workbench-client'
import { startMobileRtcSession } from '../api/mobile-workbench-client'
import type {
  MobileWorkbenchRtcSessionIntent,
  MobileWorkbenchRtcSessionResponse,
} from '../contracts/workbench-contracts'

export type MobileRtcSessionStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'error'

export interface MobileRtcSessionState {
  status: MobileRtcSessionStatus
  session: MobileWorkbenchRtcSessionResponse | null
  errorMessage: string | null
  canStart: boolean
  start(intent: MobileWorkbenchRtcSessionIntent): Promise<MobileWorkbenchRtcSessionResponse | null>
  clear(): void
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export function useMobileRtcSession(params: {
  apiBaseUrl: string | null
  tokenProvider: MobileAuthTokenProvider
  enabled: boolean
}): MobileRtcSessionState {
  const [status, setStatus] = useState<MobileRtcSessionStatus>('idle')
  const [session, setSession] = useState<MobileWorkbenchRtcSessionResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canStart = Boolean(params.apiBaseUrl) && params.enabled

  const start = useCallback(async (
    intent: MobileWorkbenchRtcSessionIntent,
  ): Promise<MobileWorkbenchRtcSessionResponse | null> => {
    setErrorMessage(null)

    if (!params.apiBaseUrl) {
      setStatus('error')
      setErrorMessage('缺少后端 API 配置')
      return null
    }

    if (!params.enabled) {
      setStatus('error')
      setErrorMessage('请先登录再开始沟通会话')
      return null
    }

    setStatus('starting')

    try {
      const nextSession = await startMobileRtcSession(intent, {
        apiBaseUrl: params.apiBaseUrl,
        tokenProvider: params.tokenProvider,
      })
      setSession(nextSession)
      setStatus('ready')
      return nextSession
    } catch (error) {
      setSession(null)
      setStatus('error')
      setErrorMessage(getErrorMessage(error, 'mobile_rtc_session_start_failed'))
      return null
    }
  }, [params.apiBaseUrl, params.enabled, params.tokenProvider])

  const clear = useCallback((): void => {
    setSession(null)
    setErrorMessage(null)
    setStatus('idle')
  }, [])

  return useMemo(() => ({
    status,
    session,
    errorMessage,
    canStart,
    start,
    clear,
  }), [
    canStart,
    clear,
    errorMessage,
    session,
    start,
    status,
  ])
}
