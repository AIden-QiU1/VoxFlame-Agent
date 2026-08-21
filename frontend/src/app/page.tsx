'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HomeDashboard } from '@/components/home'
import { useAuth } from '@/hooks/useAuth'
import { buildLoginPath } from '@/lib/auth/navigation'

export default function HomePage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated } = useAuth({
    timeoutBehavior: 'guest',
  })
  const openCommunicateView = () => {
    startTransition(() => {
      router.push(isAuthenticated ? '/communicate' : buildLoginPath('/communicate'))
    })
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在准备燃言首页...</p>
        </div>
      </div>
    )
  }

  return (
    <HomeDashboard
      isAuthenticated={isAuthenticated}
      onStartCommunicate={openCommunicateView}
    />
  )
}
