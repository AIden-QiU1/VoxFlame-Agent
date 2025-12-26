'use client'

import { usePWA } from '@/hooks/usePWA'

interface UpdatePromptProps {
  className?: string
}

export function UpdatePrompt({ className = '' }: UpdatePromptProps) {
  const { hasUpdate, updateServiceWorker } = usePWA()

  if (!hasUpdate) return null

  return (
    <div 
      className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-xl p-4 z-50 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">有新版本可用</p>
          <p className="text-white/80 text-xs">点击更新获取最新功能</p>
        </div>
        
        <button
          onClick={updateServiceWorker}
          className="bg-white text-amber-600 text-sm font-medium py-2 px-4 rounded-lg hover:bg-amber-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        >
          更新
        </button>
      </div>
    </div>
  )
}

export default UpdatePrompt
