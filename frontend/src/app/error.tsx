'use client'

import { useEffect } from 'react'
import { reportFrontendDiagnostic } from '@/lib/ui/product-message'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportFrontendDiagnostic('page-error', error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-6">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-balance text-stone-950">页面暂时无法打开</h1>
        <p className="mt-2 text-sm text-pretty text-stone-600">请稍后重试。</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
        >
          重新加载
        </button>
      </section>
    </main>
  )
}
