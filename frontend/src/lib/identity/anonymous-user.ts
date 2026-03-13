const ANONYMOUS_USER_ID_KEY = 'voxflame_anonymous_user_id'

function generateAnonymousUserId(): string {
  return `anon_${Math.random().toString(36).slice(2, 10)}`
}

export function getAnonymousUserId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const existing = window.localStorage.getItem(ANONYMOUS_USER_ID_KEY)
  if (existing) {
    return existing
  }

  const nextId = generateAnonymousUserId()
  window.localStorage.setItem(ANONYMOUS_USER_ID_KEY, nextId)
  return nextId
}
