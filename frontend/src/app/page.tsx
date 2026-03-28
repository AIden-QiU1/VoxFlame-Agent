'use client'

import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatInterface } from '@/components/chat'
import { HomeDashboard } from '@/components/home'
import { useAuth } from '@/hooks/useAuth'
import { buildLoginPath } from '@/lib/auth/navigation'
import { STARTER_KIT_SCENES, type StarterKitScene } from '@/lib/communication/starter-kit'

function resolveStarterSceneId(value: string | null): StarterKitScene['id'] | undefined {
  return STARTER_KIT_SCENES.find((scene) => scene.id === value)?.id
}

function buildCommunicatePath(sceneId?: StarterKitScene['id']) {
  const params = new URLSearchParams({ mode: 'communicate' })
  if (sceneId) {
    params.set('starter', sceneId)
  }

  return `/?${params.toString()}`
}

export default function HomePage() {
  const router = useRouter()
  const { userId, isLoading: authLoading, isAuthenticated } = useAuth({
    timeoutBehavior: 'guest',
  })
  const [showCommunicateView, setShowCommunicateView] = useState(false)
  const [starterSceneId, setStarterSceneId] = useState<StarterKitScene['id'] | undefined>(undefined)

  useEffect(() => {
    const syncModeFromLocation = () => {
      const params = new URLSearchParams(window.location.search)
      setShowCommunicateView(params.get('mode') === 'communicate')
      setStarterSceneId(resolveStarterSceneId(params.get('starter')))
    }

    syncModeFromLocation()
    window.addEventListener('popstate', syncModeFromLocation)

    return () => window.removeEventListener('popstate', syncModeFromLocation)
  }, [])

  const openCommunicateView = (sceneId?: StarterKitScene['id']) => {
    const communicatePath = buildCommunicatePath(sceneId)

    if (!isAuthenticated) {
      startTransition(() => {
        router.push(buildLoginPath(communicatePath))
      })
      return
    }

    setShowCommunicateView(true)
    setStarterSceneId(sceneId)
    startTransition(() => {
      router.push(communicatePath)
    })
  }

  const returnHome = () => {
    setShowCommunicateView(false)
    setStarterSceneId(undefined)
    startTransition(() => {
      router.push('/')
    })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_28%),linear-gradient(180deg,_#fffaf2_0%,_#fffdf9_46%,_#fff7ed_100%)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在准备燃言首页...</p>
        </div>
      </div>
    )
  }

  if (showCommunicateView) {
    return (
      <ChatInterface
        userId={userId || undefined}
        isAuthenticated={isAuthenticated}
        initialStarterSceneId={starterSceneId}
        homeHref="/"
        onReturnHome={returnHome}
      />
    )
  }

  return (
    <HomeDashboard
      isAuthenticated={isAuthenticated}
      onStartCommunicate={openCommunicateView}
    />
  )
}
