export function normalizeReviewerEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase()
  return normalized || null
}

export function parseReviewerAllowlist(value: string | null | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(/[;,\n]/u)
      .map((email) => normalizeReviewerEmail(email))
      .filter((email): email is string => Boolean(email)),
  )
}

export function isReviewerEmailAllowed(
  email: string | null | undefined,
  allowlistValue: string | null | undefined,
): boolean {
  const normalizedEmail = normalizeReviewerEmail(email)
  if (!normalizedEmail) return false
  return parseReviewerAllowlist(allowlistValue).has(normalizedEmail)
}
