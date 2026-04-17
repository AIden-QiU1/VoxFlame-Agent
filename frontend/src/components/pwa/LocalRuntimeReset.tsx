'use client'

import { useEffect } from 'react'

const allowLocalhostPwa = process.env.NEXT_PUBLIC_PWA_ALLOW_LOCALHOST === '1'

export function LocalRuntimeReset() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const isLocalOrigin =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if (!isLocalOrigin || allowLocalhostPwa) {
      return
    }

    const resetRuntimeState = async () => {
      const registrations =
        'serviceWorker' in navigator
          ? await navigator.serviceWorker.getRegistrations()
          : []
      const cacheNames = 'caches' in globalThis ? await caches.keys() : []
      const hadRuntimeState = registrations.length > 0 || cacheNames.length > 0

      if (registrations.length > 0) {
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }

      if ('caches' in globalThis && cacheNames.length > 0) {
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
      }

      if (hadRuntimeState) {
        window.location.reload()
      }
    }

    void resetRuntimeState().catch((error) => {
      console.error('[LocalRuntimeReset] Failed to clear localhost runtime state:', error)
    })
  }, [])

  return null
}

export default LocalRuntimeReset
