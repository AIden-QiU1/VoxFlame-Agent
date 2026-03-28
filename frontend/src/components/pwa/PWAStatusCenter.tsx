'use client'

import { useEffect, useState } from 'react'
import { usePWA } from '@/hooks/usePWA'
import { InstallPrompt } from './InstallPrompt'
import { OfflineNotice } from './OfflineNotice'
import { UpdatePrompt } from './UpdatePrompt'

const INSTALL_DISMISS_KEY = 'voxflame:pwa-install-dismissed:v1'
const IOS_DISMISS_KEY = 'voxflame:pwa-ios-install-dismissed:v1'

export function PWAStatusCenter() {
  const {
    canInstall,
    hasUpdate,
    installPlatform,
    isInstalled,
    isIOS,
    isOnline,
    isStandalone,
    needsManualInstall,
    promptInstall,
    updateServiceWorker,
  } = usePWA()
  const [installDismissed, setInstallDismissed] = useState(false)
  const [manualDismissed, setManualDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setInstallDismissed(window.localStorage.getItem(INSTALL_DISMISS_KEY) === '1')
    setManualDismissed(window.localStorage.getItem(IOS_DISMISS_KEY) === '1')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !isInstalled) return

    window.localStorage.removeItem(INSTALL_DISMISS_KEY)
    window.localStorage.removeItem(IOS_DISMISS_KEY)
    setInstallDismissed(false)
    setManualDismissed(false)
  }, [isInstalled])

  const dismissInstallPrompt = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, '1')
    }
    setInstallDismissed(true)
  }

  const dismissManualPrompt = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(IOS_DISMISS_KEY, '1')
    }
    setManualDismissed(true)
  }

  const showNativeInstallPrompt = canInstall && !isStandalone && !installDismissed
  const showManualInstallPrompt =
    !showNativeInstallPrompt &&
    needsManualInstall &&
    isIOS &&
    !isStandalone &&
    !manualDismissed

  return (
    <>
      <OfflineNotice isOnline={isOnline} />
      {showNativeInstallPrompt ? (
        <InstallPrompt
          mode="prompt"
          installPlatform={installPlatform}
          onDismiss={dismissInstallPrompt}
          onInstall={promptInstall}
        />
      ) : null}
      {showManualInstallPrompt ? (
        <InstallPrompt
          mode="manual-ios"
          onDismiss={dismissManualPrompt}
        />
      ) : null}
      <UpdatePrompt hasUpdate={hasUpdate} onUpdate={updateServiceWorker} />
    </>
  )
}

export default PWAStatusCenter
