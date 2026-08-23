'use client'

import { startTransition } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeDashboard } from '@/components/home'
import { useAuth } from '@/hooks/useAuth'

export default function HomePage() {
  const router = useRouter()
  const [isOpeningCommunicate, setIsOpeningCommunicate] = useState(false)
  const { isLoading: authLoading, isAuthenticated } = useAuth({
    timeoutBehavior: 'guest',
  })
  const openCommunicateView = async () => {
    if (isOpeningCommunicate) {
      return
    }

    setIsOpeningCommunicate(true)
    startTransition(() => {
      router.push('/communicate')
      setIsOpeningCommunicate(false)
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
      isOpeningCommunicate={isOpeningCommunicate}
      onStartCommunicate={openCommunicateView}
    />
  )
}
