'use client'

interface InstallPromptProps {
  mode: 'prompt' | 'manual-ios'
  onDismiss: () => void
  onInstall?: () => Promise<boolean>
  installPlatform?: string | null
  className?: string
}

export function InstallPrompt({
  mode,
  onDismiss,
  onInstall,
  installPlatform,
  className = '',
}: InstallPromptProps) {
  const isManualMode = mode === 'manual-ios'

  const handleInstall = async () => {
    if (!onInstall) {
      onDismiss()
      return
    }

    const accepted = await onInstall()
    if (!accepted) {
      onDismiss()
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
            {isManualMode ? '把燃言固定到主屏幕' : '安装燃言到主屏幕'}
          </h3>
          <p id="install-desc" className="text-xs text-gray-500 mt-0.5">
            {isManualMode
              ? 'iPhone / iPad 可通过浏览器分享菜单手动添加'
              : '一键启动，离线可用，更流畅的体验'}
          </p>

          {isManualMode ? (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <p>1. 点击 Safari 底部的“分享”。</p>
              <p>2. 选择“添加到主屏幕”。</p>
              <p>3. 下次可直接从桌面打开燃言。</p>
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            {isManualMode ? (
              <button
                onClick={onDismiss}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                知道了
              </button>
            ) : (
              <button
                onClick={handleInstall}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {installPlatform === 'web' ? '安装 Web App' : '安装'}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 text-sm py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="稍后再说"
            >
              稍后
            </button>
          </div>
        </div>
        
        {/* 关闭按钮 */}
        <button
          onClick={onDismiss}
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
