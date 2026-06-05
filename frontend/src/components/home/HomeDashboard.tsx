'use client'

import Link from 'next/link'
import {
  ArrowRight,
  AudioLines,
  BookMarked,
  MessageSquareText,
  Mic,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IcpBeianFooter } from '@/components/legal/IcpBeianFooter'
import { buildLoginPath } from '@/lib/auth/navigation'
import type { StarterKitScene } from '@/lib/communication/starter-kit'
import { UserNav } from '@/components/ui/user-nav'

interface HomeDashboardProps {
  isAuthenticated: boolean
  onStartCommunicate: (sceneId?: StarterKitScene['id']) => void
}

interface CapabilityCard {
  id: 'communicate' | 'practice' | 'memory'
  title: string
  summary: string
  note: string
  href?: string
  actionLabel: string
  icon: typeof MessageSquareText
}

const CAPABILITY_CARDS: CapabilityCard[] = [
  {
    id: 'communicate',
    title: '沟通',
    summary: '现在就要说话时，先把最重要的一句说出去。',
    note: '按场景进入，再勾这次真要带的材料。',
    actionLabel: '进入沟通',
    icon: MessageSquareText,
  },
  {
    id: 'practice',
    title: '训练',
    summary: '练这周真会说出口的句子，不练空泛样本。',
    note: '先做评估，再录真实句子。至少录够 100 句，再开始训练模型。',
    actionLabel: '进入练习',
    href: '/contribute',
    icon: AudioLines,
  },
  {
    id: 'memory',
    title: '记忆',
    summary: '把材料、模板和下次准备提前收好。',
    note: '下次沟通前直接选，不用再从空白开始。',
    actionLabel: '进入记忆页',
    href: '/memory',
    icon: BookMarked,
  },
]

function CapabilityCardView({
  card,
  isAuthenticated,
  onStartCommunicate,
}: {
  card: CapabilityCard
  isAuthenticated: boolean
  onStartCommunicate: () => void
}) {
  const Icon = card.icon
  const href = card.href
    ? (isAuthenticated ? card.href : buildLoginPath(card.href))
    : undefined

  const action = card.id === 'communicate'
    ? (
        <Button
          type="button"
          onClick={() => onStartCommunicate()}
          className="h-11 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {card.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )
    : (
        <Button
          asChild
          type="button"
          className="h-11 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Link href={href || '#'}>{card.actionLabel}<ArrowRight className="h-4 w-4" /></Link>
        </Button>
      )

  return (
    <article className="flex h-full flex-col rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold text-slate-950">{card.title}</h3>
      <p className="mt-3 text-sm leading-7 text-stone-700">{card.summary}</p>
      <div className="mt-5 rounded-[20px] bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-700">
        {card.note}
      </div>
      <div className="mt-auto pt-6">
        {action}
      </div>
    </article>
  )
}

const START_GUIDE = [
  '先选病种，再做评估主题区。',
  '评估后再练真实高频句，先累计到 100 句。',
  '沟通前去记忆页带上材料。',
] as const

const RECORDING_GUIDE = [
  '一句只说一次，慢一点。',
  '麦克风离嘴一拳左右。',
  '卡住就停，不要硬冲。',
] as const

export default function HomeDashboard({
  isAuthenticated,
  onStartCommunicate,
}: HomeDashboardProps) {
  const practiceHref = isAuthenticated ? '/contribute' : buildLoginPath('/contribute')

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[linear-gradient(180deg,_#fcf7ee_0%,_#fffdf9_42%,_#f4efe6_100%)] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.18em] text-amber-700">VOXFLAME</div>
              <div className="text-lg font-semibold text-slate-950">燃言</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onStartCommunicate()}
              className="hidden rounded-full border-stone-300 bg-white px-4 text-sm text-stone-800 hover:bg-stone-50 sm:inline-flex"
            >
              现在沟通
            </Button>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-4xl">
              <div className="text-sm font-medium text-amber-700">让系统更快听懂你</div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                先把最重要的话说出去，
                <span className="block text-amber-600">再让效果一轮轮变好</span>
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-stone-700 text-pretty sm:text-lg">
                燃言把沟通、评估、训练和准备放在同一条主线上。现在能开口，这周能练准，下次也能提前准备。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => onStartCommunicate()}
                  className="h-12 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  现在开始沟通
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full border-stone-300 bg-white px-6 text-sm font-semibold text-stone-800 hover:bg-stone-50"
                >
                  <Link href={practiceHref}>先练一句真实的话</Link>
                </Button>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full border-amber-300 bg-amber-50 px-6 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <Link href="/manual">查看使用手册</Link>
                </Button>
              </div>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {CAPABILITY_CARDS.map((card) => (
                <CapabilityCardView
                  key={card.id}
                  card={card}
                  isAuthenticated={isAuthenticated}
                  onStartCommunicate={onStartCommunicate}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 pt-2 sm:px-8 sm:pb-20">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[26px] border border-stone-200 bg-white px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="text-sm font-medium text-amber-700">新用户先这样开始</div>
              <div className="mt-4 space-y-3">
                {START_GUIDE.map((item, index) => (
                  <div
                    key={item}
                    className="rounded-[18px] bg-stone-50 px-4 py-4 text-sm text-stone-700"
                  >
                    <span className="mr-2 font-semibold text-amber-700">{index + 1}.</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[26px] border border-stone-200 bg-white px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-amber-700">录音只记 3 件事</div>
                  <div className="mt-4 space-y-3">
                    {RECORDING_GUIDE.map((item) => (
                      <div
                        key={item}
                        className="rounded-[18px] bg-stone-50 px-4 py-4 text-sm text-stone-700"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-full border-amber-300 bg-amber-50 px-5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <Link href="/manual">完整手册</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <IcpBeianFooter />
    </div>
  )
}
