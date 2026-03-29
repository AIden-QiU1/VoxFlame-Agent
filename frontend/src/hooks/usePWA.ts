'use client'

import { useState, useEffect, useCallback } from 'react'

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

function isLocalRuntimeOriginHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface PWAState {
  canInstall: boolean
  isInstalled: boolean
  isStandalone: boolean
  isOnline: boolean
  swRegistered: boolean
  hasUpdate: boolean
  installPlatform: string | null
  isIOS: boolean
  needsManualInstall: boolean
}

interface PWAActions {
  promptInstall: () => Promise<boolean>
  updateServiceWorker: () => void
  clearCacheAndReload: () => Promise<void>
}

export type UsePWAReturn = PWAState & PWAActions

export function usePWA(): UsePWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [swRegistered, setSwRegistered] = useState(false)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [installPlatform, setInstallPlatform] = useState<string | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isLocalOrigin, setIsLocalOrigin] = useState(false)

  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      isLocalRuntimeOriginHost(window.location.hostname)
    ) {
      return null
    }

    if (!swRegistrationPromise) {
      swRegistrationPromise = navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error) => {
          swRegistrationPromise = null
          throw error
        })
    }

    return swRegistrationPromise
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsLocalOrigin(isLocalRuntimeOriginHost(window.location.hostname))

    const userAgent = window.navigator.userAgent || ''
    const isiOSDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    setIsIOS(isiOSDevice)

    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
      
      setIsStandalone(isStandaloneMode)
      setIsInstalled(isStandaloneMode)
    }

    checkStandalone()

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches)
      setIsInstalled(e.matches)
    }
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (isLocalRuntimeOriginHost(window.location.hostname)) {
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setInstallPlatform(promptEvent.platforms?.[0] || 'unknown')
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      isLocalRuntimeOriginHost(window.location.hostname)
    ) {
      return
    }

    const registerSW = async () => {
      try {
        const registration = await registerServiceWorker()
        if (!registration) return

        setSwRegistered(true)
        setSwRegistration(registration)

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setHasUpdate(true)
            }
          })
        })

        if (registration.waiting) {
          setHasUpdate(true)
        }
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error)
      }
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
      return () => window.removeEventListener('load', registerSW)
    }
  }, [registerServiceWorker])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return outcome === 'accepted'
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error)
      return false
    }
  }, [deferredPrompt])

  const updateServiceWorker = useCallback(() => {
    if (!swRegistration?.waiting) return

    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      globalThis.location.reload()
    })
  }, [swRegistration])

  const clearCacheAndReload = useCallback(async () => {
    if (typeof window === 'undefined') return
    
    if (!('caches' in globalThis)) {
      globalThis.location.reload()
      return
    }

    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
      globalThis.location.reload()
    } catch {
      globalThis.location.reload()
    }
  }, [])

  return {
    canInstall: !isLocalOrigin && !!deferredPrompt && !isInstalled,
    isInstalled,
    isStandalone,
    isOnline,
    swRegistered,
    hasUpdate,
    installPlatform,
    isIOS,
    needsManualInstall: !isLocalOrigin && isIOS && !isInstalled && !deferredPrompt,
    promptInstall,
    updateServiceWorker,
    clearCacheAndReload,
  }
}

export default usePWA
