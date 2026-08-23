import { NextResponse } from 'next/server'

import workspacePayload from '@/lib/corpus/generated/mandarin-core-gap-review-workspace.json'
import reinforcementWorkspacePayload from '@/lib/corpus/generated/mandarin-reinforcement-review-workspace.json'
import { getCorpusReviewerAccess } from '@/lib/corpus-review/reviewer-access'
import type { CoreGapReviewWorkspace } from '@/lib/corpus-review/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await getCorpusReviewerAccess()
  if (!access.authenticated) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
  }
  if (!access.authorized) {
    return NextResponse.json({ error: 'reviewer_access_required' }, { status: 403 })
  }

  return NextResponse.json({
    reviewer: access.email,
    workspace: workspacePayload as CoreGapReviewWorkspace,
    workspaces: [
      workspacePayload as CoreGapReviewWorkspace,
      reinforcementWorkspacePayload as CoreGapReviewWorkspace,
    ],
  })
}
