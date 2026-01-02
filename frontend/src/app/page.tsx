'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import { useAgent } from '@/hooks/useAgent'
import { InstallPrompt, OfflineNotice, UpdatePrompt } from '@/components/pwa'

/**
 * 主页 - 燃言语音助手
 * 简化设计：自动连接，一键开始对话
 */
export default function Home() {
  const {
    isConnected,
    isRecording,
    isThinking,
    sessionId,
    currentASRText,
    currentResponseText,
    messages,
    error,
    analyser,
    connect,
    disconnect,
    toggleRecording,
    sendText,
  } = useAgent({ enableTTS: true, autoConnect: true })

  const [textInput, setTextInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponseText])

  // 键盘快捷键
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

  // Handle text submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (textInput.trim()) {
      sendText(textInput.trim())
      setTextInput('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 relative overflow-hidden flex flex-col">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-orange-100/30 rounded-full blur-3xl"></div>
      </div>

      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <span className="text-xl font-bold text-gray-900">燃言</span>
            </Link>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Beta</span>
            {isConnected && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">已连接</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contribute" className="text-gray-600 hover:text-amber-600 transition-colors font-medium">贡献声音</Link>
            <Link href="/ranyan" className="text-gray-600 hover:text-amber-600 transition-colors font-medium">关于项目</Link>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <main className="relative z-10 flex-1 flex flex-col pt-20 pb-24">
        {/* 品牌展示（无消息时） */}
        {messages.length === 0 && !currentASRText && !currentResponseText && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-4">
              让AI<span className="text-amber-500">听懂</span>你的声音
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto mb-8">
              首个专为构音障碍患者打造的开源语音识别项目
            </p>
            
            {/* 大录音按钮 */}
            <button
              onClick={toggleRecording}
              disabled={!isConnected}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : isConnected
                  ? 'bg-amber-500 hover:bg-amber-600 hover:scale-105'
                  : 'bg-gray-300 cursor-not-allowed'
              } text-white shadow-xl`}
            >
              {isRecording ? (
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <p className="text-gray-400 text-sm mt-4">
              {!isConnected ? '正在连接...' : isRecording ? '松开停止' : '点击或按空格开始说话'}
            </p>
          </div>
        )}

        {/* 对话界面（有消息时） */}
        {(messages.length > 0 || currentASRText || currentResponseText) && (
          <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {messages.map((message, index) => (
                <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-amber-500 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-amber-100'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {/* 当前 ASR */}
              {currentASRText && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-amber-200 text-amber-800 rounded-br-md">
                    <p>{currentASRText}</p>
                    <span className="text-xs text-amber-600">识别中...</span>
                  </div>
                </div>
              )}

              {/* 思考中 */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-white text-gray-600 rounded-bl-md shadow-sm border border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-sm">思考中...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 响应文本 */}
              {!isThinking && currentResponseText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white text-gray-900 rounded-bl-md shadow-sm border border-amber-100">
                    <p className="whitespace-pre-wrap">{currentResponseText}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="border-t border-amber-100 bg-white/80 backdrop-blur-md p-4">
              {error && <div className="mb-3 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

              <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`p-4 rounded-full transition-all ${
                    isRecording ? 'bg-red-500 animate-pulse' : 'bg-amber-500 hover:bg-amber-600'
                  } text-white`}
                >
                  {isRecording ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="输入消息或按空格说话..."
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className={`p-4 rounded-full transition-colors ${
                    textInput.trim() ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* 波形 */}
      <WaveformVisualizer analyser={analyser} isRecording={isRecording} />

      {/* PWA */}
      <OfflineNotice />
      <InstallPrompt />
      <UpdatePrompt />
    </div>
  )
}
