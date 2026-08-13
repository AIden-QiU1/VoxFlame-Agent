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
import { toMobileProductMessage } from '../ui/product-message'

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
      setErrorMessage('服务暂不可用，请稍后再试。')
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
        setErrorMessage(toMobileProductMessage(error, 'workspace'))
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
