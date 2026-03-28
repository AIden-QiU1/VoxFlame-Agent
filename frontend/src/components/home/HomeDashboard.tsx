'use client'

import Link from 'next/link'
import { ArrowRight, ExternalLink, Mic, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildLoginPath } from '@/lib/auth/navigation'
import type { StarterKitScene } from '@/lib/communication/starter-kit'
import {
  CHINESE_COMMUNICATION_RESOURCES,
  GENTLE_USE_PRINCIPLES,
} from '@/lib/support/user-support'
import { UserNav } from '@/components/ui/user-nav'

interface HomeDashboardProps {
  isAuthenticated: boolean
  onStartCommunicate: (sceneId?: StarterKitScene['id']) => void
}

interface ActionCard {
  id: 'communicate' | 'practice' | 'memory'
  eyebrow: string
  title: string
  description: string
  details: string
  tags: string[]
  actionLabel: string
  href?: string
}

interface PressureScenario {
  sceneId: StarterKitScene['id']
  title: string
  description: string
}

const PRESSURE_SCENES: PressureScenario[] = [
  {
    sceneId: 'interview',
    title: '求职 / 面试',
    description: '需要在陌生评委面前把能力说清楚，不能被第一印象直接淘汰。',
  },
  {
    sceneId: 'workplace',
    title: '工作协作',
    description: '在压力大的团队里，先让同事愿意听你把关键判断说完。',
  },
  {
    sceneId: 'medical',
    title: '医疗沟通',
    description: '把症状、需求和风险讲准确，减少“差不多懂了”的误解。',
  },
  {
    sceneId: 'stranger',
    title: '陌生人求助',
    description: '在出行、办事、问路或紧急情况里，更快把最重要的话说出去。',
  },
]

const ACTION_CARDS: ActionCard[] = [
  {
    id: 'communicate',
    eyebrow: '现在就能用',
    title: '现在沟通',
    description: '如果你马上就要和别人说话，先从场景句开始，把第一句话稳稳送出去。',
    details: '适合面试、工作协作、就医问诊和陌生人求助。先开口，再补第二句。',
    tags: ['面试', '工作', '医疗', '陌生人'],
    actionLabel: '进入沟通模式',
  },
  {
    id: 'practice',
    eyebrow: '今天只练一句',
    title: '练习表达',
    description: '选一句这周真会说出口的话，录完马上看重点，不用先懂一堆设置。',
    details: '先看哪里最值得先改，再决定是否上传授权。累了停在一句也算完成。',
    tags: ['真实句子', '即时反馈', '上传授权', '训练画像'],
    actionLabel: '进入练习页',
    href: '/contribute',
  },
  {
    id: 'memory',
    eyebrow: '为下一次准备',
    title: '查看沟通档案',
    description: '把最近说顺的句子、常卡的点和下次要准备的话收在一起。',
    details: '下次面试、工作沟通或就医前，先来这里看一眼，会更有底。',
    tags: ['高频表达', '最近卡点', '热词', '下次准备'],
    actionLabel: '进入沟通档案',
    href: '/memory',
  },
]

function ActionCardView({
  card,
  isAuthenticated,
  onStartCommunicate,
}: {
  card: ActionCard
  isAuthenticated: boolean
  onStartCommunicate: () => void
}) {
  const actionHref =
    card.id === 'communicate'
      ? undefined
      : isAuthenticated
        ? card.href || '#'
        : buildLoginPath(card.href)

  const action = card.id === 'communicate'
    ? (
        <Button
          type="button"
          onClick={() => onStartCommunicate()}
          className="mt-6 h-11 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {card.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )
    : (
        <Button
          asChild
          type="button"
          className="mt-6 h-11 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Link href={actionHref || '#'}>{card.actionLabel}<ArrowRight className="h-4 w-4" /></Link>
        </Button>
      )

  return (
    <article className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
            {card.eyebrow}
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">{card.title}</h3>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-600">{card.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {card.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
        {card.details}
      </div>

      <div className="mt-auto">{action}</div>
    </article>
  )
}

export default function HomeDashboard({
  isAuthenticated,
  onStartCommunicate,
}: HomeDashboardProps) {
  const practiceHref = isAuthenticated ? '/contribute' : buildLoginPath('/contribute')
  const memoryHref = isAuthenticated ? '/memory' : buildLoginPath('/memory')

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,_#fdf8ef_0%,_#fffdf8_40%,_#f8f5ef_100%)] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.2em] text-amber-600">VOXFLAME</div>
              <div className="text-lg font-semibold text-slate-950">燃言</div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <Link href="#entry-points" className="hover:text-slate-950">入口</Link>
            <Link href={memoryHref} className="hover:text-slate-950">沟通档案</Link>
            <Link href={practiceHref} className="hover:text-slate-950">练习表达</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onStartCommunicate()}
              className="hidden rounded-full border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50 sm:inline-flex"
            >
              现在沟通
            </Button>
            <UserNav />
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr,0.85fr] lg:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
                先做一件小事，把第一句话说出去
              </div>

              <h1 className="mt-8 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                今天先把一句
                <span className="block text-amber-600">最重要的话说出去</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 text-pretty sm:text-lg">
                紧张、被催、怕别人没听懂的时候，先选一个场景，点一句开口句。等对方停下来，再补第二句、第三句。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => onStartCommunicate()}
                  className="h-12 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  进入沟通模式
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Link href={practiceHref}>练习表达</Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {PRESSURE_SCENES.map((scene) => (
                  <article
                    key={scene.title}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-950">{scene.title}</div>
                      <button
                        type="button"
                        onClick={() => onStartCommunicate(scene.sceneId)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-amber-300 hover:text-amber-700"
                      >
                        直接进入
                      </button>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{scene.description}</p>
                  </article>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600 text-pretty shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                {isAuthenticated
                  ? '你已经可以直接开口、练习和查看沟通档案了。'
                  : '登录后可以同步你的常用表达、练习进展和下次要准备的话。'}
              </div>
            </div>

            <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.1)]">
              <div className="text-sm font-medium text-amber-700">如果你现在有点紧张</div>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950">
                先按这三个顺序来
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 text-pretty">
                不用先想得很完整，也不用一次说很多。先把沟通节奏稳下来。
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-800">1. 选场景</div>
                  <p className="mt-2 text-sm leading-7 text-amber-900/80 text-pretty">
                    面试、工作、就医或陌生人求助，先选最接近的一种，不用从空白开始。
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">2. 先说核心句</div>
                  <p className="mt-2 text-sm leading-7 text-slate-700 text-pretty">
                    先用一句开口句或常用短语把重点说出去，等对方开始听了，再继续补充。
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <div className="text-sm font-semibold text-orange-800">3. 对方没听清就补救</div>
                  <p className="mt-2 text-sm leading-7 text-orange-900/80 text-pretty">
                    让对方重复、写下来，或者换一种方式说。先把沟通继续下去，不急着解释所有细节。
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {GENTLE_USE_PRINCIPLES.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-sm font-semibold text-stone-950">{item.title}</div>
                    <p className="mt-2 text-sm leading-7 text-stone-600 text-pretty">{item.description}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section id="entry-points" className="px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <div className="text-sm font-medium text-amber-700">三个入口</div>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                今天先从这三个入口开始
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 text-pretty">
                一个负责先开口，一个负责练今天要说的话，一个负责把下次要准备的内容收起来。
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {ACTION_CARDS.map((card) => (
                <ActionCardView
                  key={card.id}
                  card={card}
                  isAuthenticated={isAuthenticated}
                  onStartCommunicate={onStartCommunicate}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 pt-4 sm:px-8 sm:pb-20 sm:pt-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <div className="text-sm font-medium text-amber-700">中文资源</div>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                需要时顺手带走这些链接
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 text-pretty">
                不想看大段说明时，就留几个真正可能用得上的入口。需要练句子、就医沟通或临时求助时，都能少一点手忙脚乱。
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-4">
              {CHINESE_COMMUNICATION_RESOURCES.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="text-sm font-medium text-amber-700">{resource.label}</div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950 text-balance">{resource.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 text-pretty">{resource.summary}</p>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    打开链接
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
