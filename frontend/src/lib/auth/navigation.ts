const DEFAULT_NEXT_PATH = '/'

export function normalizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) {
    return DEFAULT_NEXT_PATH
  }

  if (!nextPath.startsWith('/')) {
    return DEFAULT_NEXT_PATH
  }

  if (nextPath.startsWith('//')) {
    return DEFAULT_NEXT_PATH
  }

  return nextPath
}

export function buildLoginPath(nextPath?: string | null, loginPath = '/login'): string {
  const normalizedNextPath = normalizeNextPath(nextPath)
  const params = new URLSearchParams({
    next: normalizedNextPath,
  })

  return `${loginPath}?${params.toString()}`
}

export function getCurrentPathWithSearch(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_NEXT_PATH
  }

  return normalizeNextPath(`${window.location.pathname}${window.location.search}`)
}
