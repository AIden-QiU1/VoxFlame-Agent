import Link from 'next/link'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { redirect } from 'next/navigation'

import { CorpusReviewWorkbench } from '@/components/corpus-review/CorpusReviewWorkbench'
import { buildLoginPath } from '@/lib/auth/navigation'
import workspacePayload from '@/lib/corpus/generated/mandarin-core-gap-review-workspace.json'
import reinforcementWorkspacePayload from '@/lib/corpus/generated/mandarin-reinforcement-review-workspace.json'
import { getCorpusReviewerAccess } from '@/lib/corpus-review/reviewer-access'
import type { CoreGapReviewWorkspace } from '@/lib/corpus-review/types'

export const dynamic = 'force-dynamic'

export default async function CorpusReviewPage() {
  const access = await getCorpusReviewerAccess()
  if (!access.authenticated) {
    redirect(buildLoginPath('/corpus-review'))
  }

  if (!access.authorized || !access.email) {
    if (access.email && access.dualAnnotatorRole) {
      redirect('/corpus-review/dual-spoken-text')
    }
    return (
      <main id="main-content" className="flex min-h-dvh items-center justify-center bg-[#f3efe6] px-5 py-12 text-stone-950">
        <section className="w-full max-w-xl rounded-3xl border border-stone-300 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-stone-950 text-white">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-7 text-sm font-semibold text-amber-800">内部语料工具</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold">当前账号没有审稿权限</h1>
          <p className="mt-4 text-pretty text-sm leading-7 text-stone-600">
            语料审稿台只向列入服务端审核白名单的成员开放。候选句、审核草稿和生产语料不会向普通账号暴露。
          </p>
          <Link
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回首页
          </Link>
        </section>
      </main>
    )
  }

  return (
    <>
      <div className="border-b border-stone-300 bg-[#f3efe6] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] justify-end">
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50" href="/corpus-review/spoken-text">进入真实录音复核 →</Link>
            <Link className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50" href="/corpus-review/dual-spoken-text">进入双人独立复核 →</Link>
          </div>
        </div>
      </div>
      <CorpusReviewWorkbench
        reviewer={access.email}
        workspaces={[
          workspacePayload as CoreGapReviewWorkspace,
          reinforcementWorkspacePayload as CoreGapReviewWorkspace,
        ]}
      />
    </>
  )
}
