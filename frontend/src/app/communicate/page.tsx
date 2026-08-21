'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { QuickExpressionSurface } from '@/components/chat/QuickExpressionSurface'
import { useAuth } from '@/hooks/useAuth'
import { buildLoginPath } from '@/lib/auth/navigation'

const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface'),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-5">
        <p className="text-pretty text-sm text-stone-600">正在准备日常沟通…</p>
      </main>
    ),
  },
)

type CommunicationMode = 'quick' | 'assistant'

export default function CommunicatePage() {
  const [mode, setMode] = useState<CommunicationMode>('quick')
  const router = useRouter()
  const { userId, session, isAuthenticated } = useAuth({
    timeoutBehavior: 'guest',
  })

  if (mode === 'assistant' && isAuthenticated) {
    return (
      <ChatInterface
        accessToken={session?.access_token}
        isAuthenticated={isAuthenticated}
        onReturnHome={() => setMode('quick')}
        userId={userId || undefined}
      />
    )
  }

  return (
    <QuickExpressionSurface
      onOpenAssistant={() => {
        if (isAuthenticated) {
          setMode('assistant')
          return
        }

        router.push(buildLoginPath('/communicate'))
      }}
    />
  )
}
