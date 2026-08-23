import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import { isReviewerEmailAllowed, normalizeReviewerEmail, resolveDualAnnotatorRole, type DualAnnotatorRole } from './reviewer-access-core'

export interface CorpusReviewerAccess {
  authenticated: boolean
  authorized: boolean
  email: string | null
  user: User | null
  dualAnnotatorRole: DualAnnotatorRole | null
}

export async function getCorpusReviewerAccess(): Promise<CorpusReviewerAccess> {
  let user: User | null = null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    user = error ? null : data.user
  } catch {
    // Missing or malformed local Supabase configuration must fail closed.
    user = null
  }
  const email = normalizeReviewerEmail(user?.email)
  const dualAnnotatorRole = resolveDualAnnotatorRole(
    email,
    process.env.VOXFLAME_CORPUS_DUAL_ANNOTATOR_A_EMAILS,
    process.env.VOXFLAME_CORPUS_DUAL_ANNOTATOR_B_EMAILS,
  )

  return {
    authenticated: Boolean(user),
    authorized: isReviewerEmailAllowed(
      email,
      process.env.VOXFLAME_CORPUS_REVIEWER_EMAILS,
    ),
    email,
    user,
    dualAnnotatorRole,
  }
}
