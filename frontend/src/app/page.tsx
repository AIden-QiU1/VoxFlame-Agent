'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAgent } from '@/hooks/useAgent'

/**
 * 燃言 - 语音转换助手
 * Google 风格简洁设计
 * 核心功能：语音 → 纠正 → 字幕 + 语音输出
 * 交互：点击开始/结束，自动检测说话轮次
 */
export default function Home() {
  const {
    isConnected,
    isRecording,
    currentResponseText,
    messages,
    error,
    toggleRecording,
  } = useAgent({ enableTTS: true, autoConnect: true })

  // 空格键切换录音（点击式，不是按住）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        toggleRecording()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleRecording])

  // 获取最近的纠正后字幕（只显示 assistant 的消息）
  const recentSubtitles = messages
    .filter(m => m.role === 'assistant')
    .slice(-3)
    .map(m => m.content)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 顶部导航 - 极简 */}
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/ranyan" className="text-sm text-gray-600 hover:text-gray-900">
            关于燃言
          </Link>
          <Link href="/contribute" className="text-sm text-gray-600 hover:text-gray-900">
            贡献声音
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {isConnected ? (
            <span className="w-2 h-2 bg-green-500 rounded-full" title="已连接" />
          ) : (
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" title="连接中" />
          )}
        </div>
      </nav>

      {/* 主内容区 - Google 风格居中布局 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo 和标题 */}
        <div className="mb-12 text-center">
          <h1 className="text-6xl font-normal text-gray-800 tracking-tight mb-2">
            <span className="text-amber-500">燃</span>
            <span className="text-orange-500">言</span>
          </h1>
          <p className="text-gray-500 text-lg">让每一个声音都被听见</p>
        </div>

        {/* 字幕显示区域 */}
        <div className="w-full max-w-2xl min-h-[160px] mb-12 text-center">
          {/* 历史字幕（淡出效果） */}
          {recentSubtitles.slice(0, -1).map((text, i) => (
            <p
              key={i}
              className="text-gray-300 text-xl mb-2 transition-opacity"
              style={{ opacity: 0.3 + (i * 0.2) }}
            >
              {text}
            </p>
          ))}

          {/* 当前/最新字幕 */}
          {(currentResponseText || recentSubtitles[recentSubtitles.length - 1]) && (
            <p className="text-gray-800 text-3xl font-light animate-fade-in">
              {currentResponseText || recentSubtitles[recentSubtitles.length - 1]}
            </p>
          )}

          {/* 录音中提示 */}
          {isRecording && !currentResponseText && (
            <div className="flex items-center justify-center gap-2 text-amber-500 mt-4">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-lg">正在聆听...</span>
            </div>
          )}
        </div>

        {/* 录音按钮 - 点击切换 */}
        <button
          onClick={toggleRecording}
          disabled={!isConnected}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 ease-out
            ${isRecording
              ? 'bg-red-500 scale-110 shadow-xl shadow-red-200 animate-pulse'
              : isConnected
                ? 'bg-amber-500 hover:bg-amber-600 hover:scale-105 shadow-lg'
                : 'bg-gray-200 opacity-50 cursor-not-allowed'
            }
          `}
          aria-label={isRecording ? '停止录音' : '开始录音'}
        >
          {isRecording ? (
            // 停止图标
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            // 麦克风图标
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
        </button>

        {/* 提示文字 */}
        <p className="mt-6 text-sm text-gray-400">
          {!isConnected
            ? '正在连接服务...'
            : isRecording
              ? '点击停止'
              : '点击开始说话 或 按空格键'
          }
        </p>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-400">
          首个专为构音障碍患者打造的开源语音项目
        </p>
      </footer>

      {/* 自定义动画样式 */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
