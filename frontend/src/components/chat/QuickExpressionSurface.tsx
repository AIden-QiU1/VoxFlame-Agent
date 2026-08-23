'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Volume2 } from 'lucide-react'
import { QuickPhrasesPanel } from '@/components/phrases'
import { UserNav } from '@/components/ui/user-nav'
import { QUICK_EXPRESSION_PHRASES } from '@/lib/communication/quick-expression-phrases'

export function QuickExpressionSurface() {
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = (value: string) => {
    const text = value.trim()
    if (!text) {
      setStatus('先选择或输入一句要说的话。')
      return
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatus('当前浏览器不支持本机朗读，请改用系统浏览器。')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.onend = () => {
      setIsSpeaking(false)
      setStatus('已经说完。')
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      setStatus('朗读中断了，可以再点一次。')
    }

    setDraft(text)
    setIsSpeaking(true)
    setStatus('正在用本机语音说出这句话。')
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link
            href="/communicate"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回沟通方式
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/memory#memory-scene-template-selector"
              className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-950 sm:inline-flex"
            >
              管理我的准备
            </Link>
            <UserNav />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold text-orange-700">快速表达</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight sm:text-5xl">
            点一句，直接替你说出来
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-stone-600 sm:text-lg">
            不连接助手，不上传声音。适合问候、点餐、出行和临时求助。
          </p>
        </section>

        <section aria-label="通用快速短语" className="mt-7 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-balance text-xl font-semibold">马上要用</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_EXPRESSION_PHRASES.map((phrase) => (
              <button
                key={phrase.id}
                type="button"
                onClick={() => speak(phrase.text)}
                className="min-h-16 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left text-base font-medium leading-6 text-stone-900 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                {phrase.text}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <label htmlFor="quick-expression-draft" className="text-balance text-xl font-semibold">
            自己输入一句
          </label>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <textarea
              id="quick-expression-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="输入要让手机替你说的话"
              className="min-h-24 flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base leading-7 outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
            <button
              type="button"
              onClick={() => speak(draft)}
              disabled={!draft.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-6 text-sm font-semibold text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-300 sm:self-end"
            >
              <Volume2 className="size-5" aria-hidden="true" />
              {isSpeaking ? '重新朗读' : '语音发送'}
            </button>
          </div>
          {status ? (
            <p aria-live="polite" className="mt-3 text-pretty text-sm text-stone-600">
              {status}
            </p>
          ) : null}
        </section>

        <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <QuickPhrasesPanel mode="use" onPhrasePlay={speak} />
        </section>

      </main>
    </div>
  )
}
