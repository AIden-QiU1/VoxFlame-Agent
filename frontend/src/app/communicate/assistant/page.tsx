'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

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

export default function AssistantCommunicationPage() {
  const { userId, session, isAuthenticated, isLoading } = useAuth({
    redirectToLogin: true,
    nextPath: '/communicate/assistant',
  })

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-5">
        <p className="text-pretty text-sm text-stone-600">正在确认登录状态…</p>
      </main>
    )
  }

  return (
    <div className="relative min-h-dvh">
      <Link
        href="/communicate"
        className="fixed left-3 top-3 z-30 inline-flex min-h-11 items-center rounded-xl bg-white px-3 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:left-5 sm:top-5"
      >
        ← 沟通方式
      </Link>
      <ChatInterface
        accessToken={session?.access_token}
        isAuthenticated={isAuthenticated}
        userId={userId || undefined}
      />
    </div>
  )
}
