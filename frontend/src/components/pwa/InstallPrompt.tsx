'use client'

import { useState } from 'react'
import { usePWA } from '@/hooks/usePWA'

interface InstallPromptProps {
  className?: string
}

export function InstallPrompt({ className = '' }: InstallPromptProps) {
  const { canInstall, promptInstall, isStandalone } = usePWA()
  const [dismissed, setDismissed] = useState(false)

  // 已安装或已关闭提示，不显示
  if (!canInstall || dismissed || isStandalone) return null

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (!accepted) {
      setDismissed(true)
    }
  }

  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-2xl shadow-xl border border-amber-100 p-4 z-50 animate-slide-up ${className}`}
      role="dialog"
      aria-labelledby="install-title"
      aria-describedby="install-desc"
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 id="install-title" className="font-semibold text-gray-900 text-sm">
            安装燃言到主屏幕
          </h3>
          <p id="install-desc" className="text-xs text-gray-500 mt-0.5">
            一键启动，离线可用，更流畅的体验
          </p>
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              安装
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-400 hover:text-gray-600 text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="稍后再说"
            >
              稍后
            </button>
          </div>
        </div>
        
        {/* 关闭按钮 */}
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-300 hover:text-gray-500 transition-colors p-1 -mt-1 -mr-1"
          aria-label="关闭安装提示"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
