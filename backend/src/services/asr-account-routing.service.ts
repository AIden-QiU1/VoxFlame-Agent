export interface AuthenticatedAccountIdentity {
  userId: string
  email?: string | null
}

const LEGACY_QQ_ACCOUNT_PATTERN = /^([0-9]{5,32})@qq\.com$/i

/**
 * Returns the stable account key understood by the personalized ASR gateway.
 * Existing numeric QQ accounts retain their historical model key; all other
 * accounts use the immutable Supabase user ID so onboarding needs no app deploy.
 */
export function resolveAsrAccountId(
  identity: AuthenticatedAccountIdentity,
): string | null {
  const userId = identity.userId.trim()
  if (!userId) {
    return null
  }

  const email = identity.email?.trim() ?? ''
  const legacyQqAccount = email.match(LEGACY_QQ_ACCOUNT_PATTERN)?.[1]
  return legacyQqAccount || userId
}
