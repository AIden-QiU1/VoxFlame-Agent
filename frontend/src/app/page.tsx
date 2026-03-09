'use client'

import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatInterface } from '@/components/chat'
import { HomeDashboard } from '@/components/home'
import { useAuth } from '@/hooks/useAuth'

export default function HomePage() {
  const router = useRouter()
  const { userId, isLoading: authLoading, isAuthenticated } = useAuth()
  const [showCommunicateView, setShowCommunicateView] = useState(false)

  useEffect(() => {
    const syncModeFromLocation = () => {
      const params = new URLSearchParams(window.location.search)
      setShowCommunicateView(params.get('mode') === 'communicate')
    }

    syncModeFromLocation()
    window.addEventListener('popstate', syncModeFromLocation)

    return () => window.removeEventListener('popstate', syncModeFromLocation)
  }, [])

  const openCommunicateView = () => {
    setShowCommunicateView(true)
    startTransition(() => {
      router.push('/?mode=communicate')
    })
  }

  const returnHome = () => {
    setShowCommunicateView(false)
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
