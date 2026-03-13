'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, Brain, Mic, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/ui/user-nav'

interface HomeDashboardProps {
  isAuthenticated: boolean
  onStartCommunicate: () => void
}

interface ActionCard {
  id: 'communicate' | 'practice' | 'memory'
  eyebrow: string
  title: string
  description: string
  details: string[]
  tags: string[]
  status: string
  actionLabel: string
  href?: string
}

interface EvidenceCard {
  title: string
  summary: string
  href: string
}

const ACTION_CARDS: ActionCard[] = [
  {
    id: 'communicate',
    eyebrow: 'P0 主线',
    title: '现在沟通',
    description: '先把第一句话说出来，再逐步进入实时沟通。主入口围绕医疗、家庭、陌生人和紧急场景。',
    details: [
      '场景卡、常用短语和一键代播先帮用户把最重要的话说出去。',
    ],
    tags: ['医疗', '家庭', '陌生人', '紧急'],
    status: '可直接进入',
    actionLabel: '进入沟通模式',
  },
  {
    id: 'practice',
    eyebrow: '中文语训',
    title: '练习表达',
    description: '训练页将围绕中文普通话设计：汉字、拼音、声母/韵母/声调和混淆模式反馈。',
    details: [
      '每次录音先换回拼音对照、重点音节和动作提示，再决定是否匿名上传。',
    ],
    tags: ['目标句', '拼音', '音节差异', '趋势反馈'],
    status: '重构中',
    actionLabel: '查看训练页',
    href: '/contribute',
  },
  {
    id: 'memory',
    eyebrow: '个体成长',
    title: '查看进展与记忆',
    description: '后续的记忆不是“全量记录一切”，而是积累真正有助于沟通和训练的个体档案。',
    details: [
      '先看最近训练、高频表达、重点音节和热词，不再只停留在首页承诺。',
    ],
    tags: ['高频表达', '混淆模式', '场景偏好', '训练历史'],
    status: '已可查看',
    actionLabel: '进入记忆页',
    href: '/memory',
  },
]

const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    title: 'AAC 补偿沟通',
    summary: 'ASHA 将 AAC 视为对说话和写字困难人群的补充或替代沟通方式，这直接支持“第一句话、场景卡、一键代播”作为首页主入口。',
    href: 'https://www.asha.org/public/speech/disorders/aac/',
  },
  {
    title: '成人构音障碍管理',
    summary: 'ASHA 的 dysarthria 指南强调 compensatory strategies、speech supplementation 和 AAC，说明产品不能只盯识别率，还要先帮助用户被理解。',
    href: 'https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/',
  },
  {
    title: '场景沟通板资源',
    summary: 'Tobii Dynavox 的医院、紧急等沟通板资源说明：医疗和紧急不是边缘功能，而是高价值入口场景。',
    href: 'https://www.tobiidynavox.com/blogs/the-buzz/10-things-to-know-about-aac-and-emergency-preparedness/',
  },
  {
    title: '中文训练规范',
    summary: '中文训练页会参考《汉语拼音方案》和普通话测试规范整理语料与拼音标签，不照搬英文 phonics 或 IPA 教学路径。',
    href: 'http://www.gov.cn/banshi/2005-07/29/content_18279.htm',
  },
]

const MEMORY_PREVIEW = [
  {
    title: '高频表达',
    description: '把用户最常说、最重要的话沉淀出来，优先服务下一次沟通。',
  },
  {
    title: '混淆模式',
    description: '记录常见的中文音节混淆，例如平翘舌、前后鼻音、n/l 和声调波动。',
  },
  {
    title: '训练趋势',
    description: '把单次录音变成长期可见的进展，而不是一次次“上传成功”的空反馈。',
  },
]

function ActionCardView({
  card,
  onStartCommunicate,
}: {
  card: ActionCard
  onStartCommunicate: () => void
}) {
  const action = card.id === 'communicate'
    ? (
        <Button
          type="button"
          onClick={onStartCommunicate}
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
          <Link href={card.href || '#'}>{card.actionLabel}<ArrowRight className="h-4 w-4" /></Link>
        </Button>
      )

  return (
    <article className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
            {card.eyebrow}
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">{card.title}</h3>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {card.status}
        </span>
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

      <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
        {card.details.map((detail) => (
          <li key={detail} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">{action}</div>
    </article>
  )
}

export default function HomeDashboard({
  isAuthenticated,
  onStartCommunicate,
}: HomeDashboardProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.16),_transparent_22%),linear-gradient(180deg,_#fffaf2_0%,_#fffdf9_46%,_#fff7ed_100%)] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
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
            <Link href="#evidence" className="hover:text-slate-950">依据</Link>
            <Link href="/memory" className="hover:text-slate-950">进展与记忆</Link>
            <Link href="/contribute" className="hover:text-slate-950">练习表达</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onStartCommunicate}
              className="hidden rounded-full border-slate-300 bg-white/80 px-4 text-sm text-slate-800 hover:bg-slate-50 sm:inline-flex"
            >
              现在沟通
            </Button>
            <UserNav />
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.2fr,0.8fr] lg:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
                近期主线：主动沟通 / 中文语训 / 个体记忆
              </div>

              <h1 className="mt-8 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                先帮用户
                <span className="block text-amber-600">说出第一句话</span>
                再谈系统有多复杂
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                现在先解决三件事：帮你开口、给你更具体的中文训练反馈、把已经学到的个人记忆展示出来。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={onStartCommunicate}
                  className="h-12 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  进入沟通模式
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full border-slate-300 bg-white/85 px-6 text-sm font-semibold text-slate-800 hover:bg-white"
                >
                  <Link href="/contribute">练习表达</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">医疗 / 家庭 / 陌生人 / 紧急</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">中文普通话拼音与音节反馈</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">
                  {isAuthenticated ? '已登录，可继续同步个人记忆' : '未登录也可先查看与试用，登录后再同步个体配置'}
                </span>
              </div>
            </div>

            <aside className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">现在能直接得到什么</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <ShieldCheck className="h-4 w-4" />
                    沟通先行
                  </div>
                  <p className="mt-2 text-sm leading-7 text-amber-900/80">
                    用场景卡、短语和代播把最重要的话先说出去。
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <BookOpen className="h-4 w-4" />
                    训练有回报
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    录完就能看到拼音对照、重点音节和动作提示。
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                    <Brain className="h-4 w-4" />
                    记忆可见
                  </div>
                  <p className="mt-2 text-sm leading-7 text-orange-900/80">
                    最近训练、高频表达和热词会开始沉淀成真正可查看的页面。
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section id="entry-points" className="px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">入口设计</div>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                首页只保留立刻能开始的入口
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                三个入口分别对应先开口、练表达、看进展。底层模型和字幕只是支撑，不再占据首页注意力。
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {ACTION_CARDS.map((card) => (
                <ActionCardView
                  key={card.id}
                  card={card}
                  onStartCommunicate={onStartCommunicate}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="evidence" className="px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white/85 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">设计依据</div>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                方向有依据，但不再把依据堆满首页
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                首页场景排序和训练方向仍然参考 AAC、成人构音障碍和普通话训练资料，但详细依据退到这里和文档里，不再抢首屏注意力。
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {EVIDENCE_CARDS.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-amber-300 hover:bg-amber-50/60"
                >
                  <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.summary}</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                    查看来源
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr,1.05fr] lg:items-start">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">进展与记忆</div>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
                记忆不再只停留在首页说明
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                现在已经可以直接进入记忆页查看最近训练、高频表达、重点音节和热词。首页只保留一个预告，不再替代真正的页面。
              </p>

              <div className="mt-8 rounded-[28px] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  现在可以直接去看的内容
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>最近训练记录和状态分布。</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>高频表达、重点音节和动作提示回顾。</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>agent 已经学到的部分热词。</span>
                  </li>
                </ul>
                <Button
                  asChild
                  type="button"
                  className="mt-6 h-11 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Link href="/memory">进入记忆页</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {MEMORY_PREVIEW.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[28px] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Memory Preview</div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
