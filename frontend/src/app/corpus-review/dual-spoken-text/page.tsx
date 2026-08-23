import { redirect } from 'next/navigation'

import { MandarinDualReviewWorkbench } from '@/components/corpus-review/MandarinDualReviewWorkbench'
import dualWorkspacePayload from '@/lib/corpus/generated/mandarin-dual-spoken-text-review-workspace.json'
import { buildLoginPath } from '@/lib/auth/navigation'
import { getCorpusReviewerAccess } from '@/lib/corpus-review/reviewer-access'
import type { MandarinDualReviewWorkspace } from '@/lib/corpus-review/types'

export const dynamic = 'force-dynamic'

export default async function MandarinDualSpokenTextReviewPage() {
  const access = await getCorpusReviewerAccess()
  if (!access.authenticated) redirect(buildLoginPath('/corpus-review/dual-spoken-text'))
  if (!access.email || !access.dualAnnotatorRole) redirect('/corpus-review')
  return <MandarinDualReviewWorkbench reviewer={access.email} role={access.dualAnnotatorRole} workspace={dualWorkspacePayload as MandarinDualReviewWorkspace} />
}
