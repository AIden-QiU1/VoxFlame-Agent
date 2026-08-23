import { redirect } from 'next/navigation'

import { SpokenTextReviewWorkbench } from '@/components/corpus-review/SpokenTextReviewWorkbench'
import workspacePayload from '@/lib/corpus/generated/mandarin-spoken-text-review-workspace.json'
import { buildLoginPath } from '@/lib/auth/navigation'
import { getCorpusReviewerAccess } from '@/lib/corpus-review/reviewer-access'
import type { SpokenTextReviewWorkspace } from '@/lib/corpus-review/types'

export const dynamic = 'force-dynamic'

export default async function SpokenTextReviewPage() {
  const access = await getCorpusReviewerAccess()
  if (!access.authenticated) redirect(buildLoginPath('/corpus-review/spoken-text'))
  if (!access.authorized || !access.email) redirect('/corpus-review')

  return (
    <SpokenTextReviewWorkbench
      reviewer={access.email}
      workspace={workspacePayload as SpokenTextReviewWorkspace}
    />
  )
}
