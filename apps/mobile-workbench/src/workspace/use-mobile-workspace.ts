import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { MobileAuthTokenProvider } from '../api/mobile-workbench-client'
import { fetchMobileWorkspaceSnapshot } from '../api/mobile-workbench-client'
import {
  selectMobileWorkspaceReadModel,
  type MobileWorkspaceReadModel,
  type MobileWorkspaceSnapshotContract,
} from '../contracts/workspace-read-model'

export type MobileWorkspaceStatus =
  | 'config_missing'
  | 'auth_required'
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

export interface MobileWorkspaceState {
  snapshot: MobileWorkspaceSnapshotContract | null
  readModel: MobileWorkspaceReadModel
  status: MobileWorkspaceStatus
  errorMessage: string | null
  refresh(): void
}

export interface UseMobileWorkspaceSnapshotOptions {
  apiBaseUrl: string | null
  userId: string | null
  tokenProvider: MobileAuthTokenProvider
  enabled: boolean
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export function useMobileWorkspaceSnapshot(
  options: UseMobileWorkspaceSnapshotOptions,
): MobileWorkspaceState {
  const [snapshot, setSnapshot] =
    useState<MobileWorkspaceSnapshotContract | null>(null)
  const [status, setStatus] = useState<MobileWorkspaceStatus>(
    options.apiBaseUrl ? 'idle' : 'config_missing',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!options.apiBaseUrl) {
      setSnapshot(null)
      setStatus('config_missing')
      setErrorMessage('missing_EXPO_PUBLIC_API_BASE_URL')
      return undefined
    }

    if (!options.enabled || !options.userId) {
      setSnapshot(null)
      setStatus('auth_required')
      setErrorMessage(null)
      return undefined
    }

    let isMounted = true
    setStatus('loading')
    setErrorMessage(null)

    void fetchMobileWorkspaceSnapshot(options.userId, {
      apiBaseUrl: options.apiBaseUrl,
      tokenProvider: options.tokenProvider,
    })
      .then((nextSnapshot) => {
        if (!isMounted) {
          return
        }

        setSnapshot(nextSnapshot)
        setStatus('ready')
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        setSnapshot(null)
        setStatus('error')
        setErrorMessage(getErrorMessage(error, 'workspace_snapshot_failed'))
      })

    return () => {
      isMounted = false
    }
  }, [
    options.apiBaseUrl,
    options.enabled,
    options.tokenProvider,
    options.userId,
    refreshNonce,
  ])

  const readModel = useMemo(() => (
    selectMobileWorkspaceReadModel(snapshot)
  ), [snapshot])

  return {
    snapshot,
    readModel,
    status,
    errorMessage,
    refresh,
  }
}
