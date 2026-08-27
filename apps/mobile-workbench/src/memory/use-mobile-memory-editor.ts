import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  activateMobilePreparedExpression,
  createMobileQuickPhrase,
  deleteMobilePreparedExpression,
  deleteMobileQuickPhrase,
  fetchMobilePreparedExpressionLibrary,
  fetchMobileQuickPhrases,
  fetchMobileSceneTemplates,
  saveMobilePreparedExpression,
  saveMobileHotwordProfiles,
  saveMobileSceneTemplates,
  saveMobileUserProfileMemory,
  updateMobileQuickPhrase,
  type MobileQuickPhrase,
} from '../api/mobile-memory-client'
import type { MobileAuthTokenProvider } from '../api/mobile-workbench-client'
import type {
  MobilePreparedExpressionLibrary,
  MobileHotwordProfile,
  MobileSceneTemplate,
  MobileUserProfileMemory,
} from '../contracts/workspace-read-model'
import { toMobileProductMessage } from '../ui/product-message'

export function useMobileMemoryEditor(params: {
  apiBaseUrl: string | null
  userId: string | null
  tokenProvider: MobileAuthTokenProvider
  enabled: boolean
}) {
  const [library, setLibrary] = useState<MobilePreparedExpressionLibrary | null>(null)
  const [phrases, setPhrases] = useState<MobileQuickPhrase[]>([])
  const [sceneTemplates, setSceneTemplates] = useState<MobileSceneTemplate[]>([])
  const [selectedSceneTemplateIds, setSelectedSceneTemplateIds] = useState<string[]>([])
  const [hotwordProfiles, setHotwordProfiles] = useState<MobileHotwordProfile[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'ready' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const clientOptions = useMemo(() => params.apiBaseUrl ? ({
    apiBaseUrl: params.apiBaseUrl,
    tokenProvider: params.tokenProvider,
  }) : null, [params.apiBaseUrl, params.tokenProvider])

  const refresh = useCallback(async (): Promise<void> => {
    if (!params.enabled || !params.userId || !clientOptions) return
    setStatus('loading')
    setErrorMessage(null)
    try {
      const [nextLibrary, nextPhrases, nextSceneTemplates] = await Promise.all([
        fetchMobilePreparedExpressionLibrary(params.userId, clientOptions),
        fetchMobileQuickPhrases(params.userId, clientOptions),
        fetchMobileSceneTemplates(params.userId, clientOptions),
      ])
      setLibrary(nextLibrary)
      setPhrases(nextPhrases)
      setSceneTemplates(nextSceneTemplates.library)
      setSelectedSceneTemplateIds(nextSceneTemplates.selectedIds)
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setErrorMessage(toMobileProductMessage(error, 'workspace'))
    }
  }, [clientOptions, params.enabled, params.userId])

  useEffect(() => { void refresh() }, [refresh])

  const mutate = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setStatus('saving')
    setErrorMessage(null)
    try {
      const result = await operation()
      setStatus('ready')
      return result
    } catch (error) {
      setStatus('error')
      setErrorMessage(toMobileProductMessage(error, 'workspace'))
      return null
    }
  }, [])

  return {
    library,
    phrases,
    sceneTemplates,
    selectedSceneTemplateIds,
    hotwordProfiles,
    status,
    errorMessage,
    refresh,
    hydrateHotwords(profiles: MobileHotwordProfile[]) {
      setHotwordProfiles(profiles)
    },
    async saveSceneTemplateSelection(selectedIds: string[]) {
      const userId = params.userId
      if (!userId || !clientOptions) return false
      const saved = await mutate(() => saveMobileSceneTemplates(userId, selectedIds, clientOptions))
      if (!saved) return false
      setSelectedSceneTemplateIds(saved)
      return true
    },
    async saveHotwords(profiles: MobileHotwordProfile[]) {
      const userId = params.userId
      if (!userId || !clientOptions) return false
      const saved = await mutate(() => saveMobileHotwordProfiles(userId, profiles, clientOptions))
      if (!saved) return false
      setHotwordProfiles(saved)
      return true
    },
    async saveMaterial(input: { id?: string; title: string; scene?: string | null; source?: string; content: string; make_active?: boolean }) {
      const userId = params.userId
      if (!userId || !clientOptions) return false
      const next = await mutate(() => saveMobilePreparedExpression(userId, input, clientOptions))
      if (!next) return false
      setLibrary(next)
      return true
    },
    async activateMaterial(assetId: string) {
      const userId = params.userId
      if (!userId || !clientOptions) return null
      const next = await mutate(() => activateMobilePreparedExpression(userId, assetId, clientOptions))
      if (!next) return null
      setLibrary(next.library)
      return next.workspaceSnapshot
    },
    async deleteMaterial(assetId: string) {
      const userId = params.userId
      if (!userId || !clientOptions) return false
      const next = await mutate(() => deleteMobilePreparedExpression(userId, assetId, clientOptions))
      if (!next) return false
      setLibrary(next)
      return true
    },
    async saveProfile(input: MobileUserProfileMemory) {
      const userId = params.userId
      if (!userId || !clientOptions) return false
      return Boolean(await mutate(() => saveMobileUserProfileMemory(userId, input, clientOptions)))
    },
    async savePhrase(input: { id?: string; text: string }) {
      const userId = params.userId
      if (!userId || !clientOptions) return false
      const saved = await mutate(() => input.id
        ? updateMobileQuickPhrase(input.id, input.text, clientOptions)
        : createMobileQuickPhrase(userId, input.text, clientOptions))
      if (!saved) return false
      setPhrases((current) => input.id
        ? current.map((phrase) => phrase.id === input.id ? saved : phrase)
        : [...current, saved])
      return true
    },
    async deletePhrase(phraseId: string) {
      if (!clientOptions) return false
      const deleted = await mutate(() => deleteMobileQuickPhrase(phraseId, clientOptions))
      if (deleted === null) return false
      setPhrases((current) => current.filter((phrase) => phrase.id !== phraseId))
      return true
    },
  }
}
