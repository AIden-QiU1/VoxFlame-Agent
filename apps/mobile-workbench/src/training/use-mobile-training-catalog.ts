import { useCallback, useEffect, useState } from 'react'

import type { MobileAuthTokenProvider } from '../api/mobile-workbench-client'
import { toMobileProductMessage } from '../ui/product-message'
import {
  fetchMobileTrainingCatalog,
  type MobileTrainingCategory,
  type MobileTrainingExercise,
  type MobileReadingArticleSummary,
} from './training-catalog'

export function useMobileTrainingCatalog(params: {
  apiBaseUrl: string | null
  enabled: boolean
  tokenProvider: MobileAuthTokenProvider
}) {
  const [categories, setCategories] = useState<MobileTrainingCategory[]>([])
  const [exercises, setExercises] = useState<MobileTrainingExercise[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [readingArticles, setReadingArticles] = useState<MobileReadingArticleSummary[]>([])
  const [selectedReadingArticle, setSelectedReadingArticle] = useState<MobileReadingArticleSummary | null>(null)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async (category?: string, readingArticleId?: string): Promise<void> => {
    if (!params.enabled || !params.apiBaseUrl) {
      return
    }
    setStatus('loading')
    setErrorMessage(null)
    try {
      const catalog = await fetchMobileTrainingCatalog(
        params.apiBaseUrl,
        params.tokenProvider,
        category || readingArticleId ? { category, readingArticleId, limit: 120 } : undefined,
      )
      setCategories(catalog.categories)
      setExercises(catalog.exercises)
      setSelectedCategory(catalog.selectedCategory)
      setReadingArticles(catalog.readingArticles)
      setSelectedReadingArticle(catalog.selectedReadingArticle)
      setTotal(catalog.total)
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setErrorMessage(toMobileProductMessage(error, 'recording'))
    }
  }, [params.apiBaseUrl, params.enabled, params.tokenProvider])

  const loadMore = useCallback(async (): Promise<void> => {
    if (
      !params.enabled
      || !params.apiBaseUrl
      || (!selectedCategory && !selectedReadingArticle)
      || exercises.length >= total
    ) {
      return
    }
    setStatus('loading')
    try {
      const catalog = await fetchMobileTrainingCatalog(
        params.apiBaseUrl,
        params.tokenProvider,
        {
          category: selectedCategory ?? undefined,
          readingArticleId: selectedReadingArticle?.id,
          limit: 120,
          offset: exercises.length,
        },
      )
      setExercises((current) => [...current, ...catalog.exercises])
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setErrorMessage(toMobileProductMessage(error, 'recording'))
    }
  }, [
    exercises.length,
    params.apiBaseUrl,
    params.enabled,
    params.tokenProvider,
    selectedCategory,
    selectedReadingArticle,
    total,
  ])

  useEffect(() => {
    void load()
  }, [load])

  return {
    categories,
    exercises,
    selectedCategory,
    readingArticles,
    selectedReadingArticle,
    total,
    status,
    errorMessage,
    selectCategory: load,
    selectReadingArticle: (articleId: string) => load(undefined, articleId),
    loadMore,
  }
}
