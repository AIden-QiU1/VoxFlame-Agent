'use client'

import Link from 'next/link'
import { ArrowRight, AudioLines, BrainCircuit } from 'lucide-react'

export default function CommunicatePage() {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-stone-700 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
            <span aria-hidden="true">←</span>
            返回首页
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold text-orange-700">沟通</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-5xl">你现在想怎么表达？</h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-8 text-stone-600 sm:text-lg">选一种方式进入，不需要先进入另一种模式。</p>

        <section aria-label="选择沟通方式" className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/communicate/quick" className="group rounded-3xl border border-orange-200 bg-orange-50 p-6 shadow-sm transition-colors duration-150 hover:border-orange-400 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
            <AudioLines className="size-7 text-orange-700" aria-hidden="true" />
            <h2 className="mt-6 text-2xl font-semibold">快速表达</h2>
            <p className="mt-3 text-pretty text-sm leading-7 text-stone-700">选一句或自己输入，让设备直接替你说出来。不连接助手，不上传声音。</p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-orange-800">进入快速表达 <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
          <Link href="/communicate/assistant" className="group rounded-3xl border border-stone-800 bg-stone-950 p-6 text-white shadow-sm transition-colors duration-150 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">
            <BrainCircuit className="size-7 text-orange-300" aria-hidden="true" />
            <h2 className="mt-6 text-2xl font-semibold">日常沟通</h2>
            <p className="mt-3 text-pretty text-sm leading-7 text-stone-300">需要语音识别、意图纠错、上下文记忆或连续对话时，进入沟通助手。</p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-orange-200">进入日常沟通 <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        </section>
      </main>
    </div>
  )
}
