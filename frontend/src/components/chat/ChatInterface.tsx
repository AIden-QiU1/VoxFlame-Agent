/**
 * ChatInterface Component
 * Phase 8: Frontend WebSocket Integration
 * 
 * 对话界面组件 - 温暖、无障碍友好设计
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAgent, ConversationMessage, DualLineSubtitle } from '@/hooks/useAgent'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import { QuickPhrasesPanel } from '@/components/phrases'
import { CommunicationStarterKit } from '@/components/chat/CommunicationStarterKit'
import { UserNav } from '@/components/ui/user-nav'
import { ChevronLeftIcon, ChevronRightIcon, EarIcon, BrainIcon } from 'lucide-react'

interface ChatInterfaceProps {
  userId?: string
  homeHref?: string
  onReturnHome?: () => void
}

export default function ChatInterface({ userId, homeHref, onReturnHome }: ChatInterfaceProps) {
  const {
    isConnected,
    isRecording,
    isThinking,
    isSpeaking,
    sessionId,
    currentASRText,
    currentResponseText,
    currentDualLine,
    messages,
    error,
    analyser,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    toggleRecording,
    sendText,
    clearMessages
  } = useAgent({ enableTTS: true, userId })

  const [textInput, setTextInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showPhrasesPanel, setShowPhrasesPanel] = useState(false)
  const [isCaptionMode, setIsCaptionMode] = useState(false)
  const [isLaunchingStarter, setIsLaunchingStarter] = useState(false)

  // Audio player ref for TTS playback
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Initialize audio player
  useEffect(() => {
    const audio = new Audio()
    const handleEnded = () => setIsPlayingAudio(false)
    const handleError = (e: Event) => {
      console.error('Audio playback error:', e)
      setIsPlayingAudio(false)
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audioPlayerRef.current = audio
    
    return () => {
      audio.pause()
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audioPlayerRef.current = null
    }
  }, [])

  // Play TTS audio from response
  const playAudio = (audioData: Blob | string) => {
    if (!audioPlayerRef.current) return
    
    const audio = audioPlayerRef.current
    
    // Stop current playback
    audio.pause()
    
    // Set new source
    if (audioData instanceof Blob) {
      const url = URL.createObjectURL(audioData)
      audio.src = url
    } else if (typeof audioData === 'string') {
      audio.src = audioData
    }
    
    // Play audio
    audio.play()
      .then(() => setIsPlayingAudio(true))
      .catch(err => console.error('Failed to play audio:', err))
  }

  // Stop audio playback
  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      setIsPlayingAudio(false)
    }
  }

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponseText])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to toggle recording (when connected)
      if (e.code === 'Space' && !e.repeat && isConnected && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        toggleRecording()
      }
      // Escape to exit fullscreen caption mode
      if (e.code === 'Escape' && isCaptionMode) {
        setIsCaptionMode(false)
      }
      // Escape to stop recording
      if (e.code === 'Escape' && isRecording) {
        stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCaptionMode, isConnected, isRecording, toggleRecording, stopRecording])

  // Handle text submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (textInput.trim()) {
      sendText(textInput.trim())
      setTextInput('')
    }
  }

  // Handle phrase playback - send as text message
  const handlePhrasePlay = (text: string) => {
    sendText(text)
  }

  const handleStarterPhrase = async (text: string) => {
    if (isConnected) {
      sendText(text)
      return
    }

    setIsLaunchingStarter(true)
    try {
      await connect({ suppressGreeting: true })
      sendText(text)
    } finally {
      setIsLaunchingStarter(false)
    }
  }

  const latestAssistantText = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.content
  const captionText = currentResponseText || currentDualLine?.correctedText || latestAssistantText || currentASRText

  return (
    <div className="flex h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      {/* Toggle button for phrases panel */}
      <button
        onClick={() => setShowPhrasesPanel(!showPhrasesPanel)}
        className={`
          fixed z-20 top-1/2 -translate-y-1/2 transition-all duration-300
          flex items-center justify-center w-10 h-16 rounded-l-lg shadow-lg
          ${showPhrasesPanel ? 'right-80' : 'right-0'}
          bg-amber-500 hover:bg-amber-600 text-white
        `}
        aria-label={showPhrasesPanel ? '隐藏短语板' : '显示短语板'}
      >
        {showPhrasesPanel ? (
          <ChevronRightIcon className="w-5 h-5" />
        ) : (
          <ChevronLeftIcon className="w-5 h-5" />
        )}
      </button>

      {/* Phrases Panel - Slide-in from right */}
      <aside
        className={`
          fixed right-0 top-0 h-full w-80 bg-white border-l border-amber-100 shadow-xl
          transform transition-transform duration-300 z-10 overflow-y-auto
          ${showPhrasesPanel ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="p-4">
          <QuickPhrasesPanel onPhrasePlay={handlePhrasePlay} />
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-amber-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl"></span>
            <span className="text-xl font-bold text-gray-900">燃言助手</span>
            {sessionId && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                已连接
              </span>
            )}
            
            {/* Audio control button */}
            {isConnected && isPlayingAudio && (
              <button
                onClick={stopAudio}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors flex items-center gap-2"
                aria-label="停止音频"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                停止播放
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {homeHref && (
              onReturnHome ? (
                <button
                  type="button"
                  onClick={onReturnHome}
                  className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900"
                >
                  返回首页
                </button>
              ) : (
                <Link href={homeHref} className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
                  返回首页
                </Link>
              )
            )}
            <Link href="/memory" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              进展与记忆
            </Link>
            <Link href="/contribute" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              练习表达
            </Link>
            {!isConnected ? (
              <button
                onClick={() => {
                  void connect()
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-sm font-medium transition-colors"
              >
                连接助手
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full text-sm font-medium transition-colors"
              >
                断开连接
              </button>
            )}
            <button
              onClick={() => setIsCaptionMode(!isCaptionMode)}
              className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium transition-colors hover:bg-gray-800"
            >
              {isCaptionMode ? '退出字幕辅助' : '字幕辅助'}
            </button>
            <UserNav />
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && !currentResponseText && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">
                  先帮你完成第一次有效沟通
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                  进入这里，不是先让你和 AI 聊天，而是先给你一组能立即代播的高价值开口句。
                  你可以先说明自己的说话状态，再表达需求、疼痛、求助或照护安排。
                </p>
                {!isConnected && (
                  <button
                    onClick={() => {
                      void connect()
                    }}
                    className="mt-5 rounded-full bg-amber-500 px-8 py-3 font-medium text-white transition-colors hover:bg-amber-600"
                  >
                    先连接助手
                  </button>
                )}
              </div>

              <CommunicationStarterKit
                disabled={false}
                isConnected={isConnected}
                isLaunching={isLaunchingStarter}
                onSelectPhrase={handleStarterPhrase}
              />
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* 双行字幕镜 - 显示用户说的 vs AI 理解的 */}
          {currentDualLine && (
            <DualLineSubtitleDisplay subtitle={currentDualLine} />
          )}

          {/* Current ASR text (partial) */}
          {currentASRText && !currentDualLine && (
            <div className="flex justify-end">
              <div className="bg-amber-100 text-amber-900 px-4 py-3 rounded-2xl rounded-br-md max-w-[80%] animate-pulse">
                {currentASRText}
                <span className="inline-block w-1.5 h-4 bg-amber-500 ml-1 animate-blink"></span>
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm">{currentResponseText || '思考中...'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Streaming response */}
          {currentResponseText && !isThinking && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-md max-w-[80%] shadow-sm">
                {currentResponseText}
                <span className="inline-block w-1.5 h-4 bg-amber-500 ml-1 animate-blink"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm">
          {error}
        </div>
      )}

      {/* Waveform visualizer */}
      <WaveformVisualizer analyser={analyser} isRecording={isRecording} />

      {/* Input Area */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-amber-100 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Voice button */}
            <button
              onClick={toggleRecording}
              disabled={!isConnected}
              className={`
                flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center
                transition-all duration-300 transform
                ${isRecording 
                  ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse' 
                  : isConnected
                    ? 'bg-amber-500 hover:bg-amber-600 hover:scale-105'
                    : 'bg-gray-300 cursor-not-allowed'
                }
                text-white shadow-lg
              `}
              aria-label={isRecording ? '停止录音' : '开始录音'}
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

            {/* Text input */}
            <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={isConnected ? "输入消息，或按空格键说话..." : "请先连接助手"}
                disabled={!isConnected}
                className="flex-1 px-4 py-3 rounded-full border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!isConnected || !textInput.trim()}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors"
              >
                发送
              </button>
            </form>
          </div>

          {/* Hints */}
          <div className="text-center text-gray-400 text-xs mt-2">
            {isConnected ? (
              isRecording ? (
                '正在录音... 再次点击或按空格停止'
              ) : (
                '按 空格键 开始说话，或输入文字消息'
              )
            ) : (
              '点击"连接助手"开始对话'
            )}
          </div>
        </div>
      </footer>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink { animation: blink 1s infinite; }
      `}</style>

      {isCaptionMode && (
        <div className="fixed inset-0 z-30 bg-black text-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
            <div className="text-sm text-white/80">全屏字幕模式</div>
            <button
              onClick={() => setIsCaptionMode(false)}
              className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90"
            >
              退出
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-8">
            <p className="text-center text-4xl md:text-6xl leading-tight font-semibold max-w-5xl">
              {captionText || '正在等待语音输入...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Message bubble component
function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          px-4 py-3 rounded-2xl max-w-[80%]
          ${isUser
            ? 'bg-amber-500 text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm'
          }
        `}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className={`text-xs mt-1 ${isUser ? 'text-amber-200' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

/**
 * 双行字幕镜组件
 *
 * 帮助用户理解：
 * - 第一行（红色/黄色）：机器听到的声音（ASR 原始结果）
 * - 第二行（绿色）：AI 理解的意图（LLM 纠正后的结果）
 * - 清晰度评分：语音可理解度指标
 */
function DualLineSubtitleDisplay({ subtitle }: { subtitle: DualLineSubtitle }) {
  // 根据清晰度评分决定颜色
  const getClarityColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getClarityBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 50) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getClarityLabel = (score: number) => {
    if (score >= 80) return '清晰'
    if (score >= 50) return '一般'
    return '模糊'
  }

  const clarityColor = getClarityColor(subtitle.clarityScore)
  const clarityBgColor = getClarityBgColor(subtitle.clarityScore)
  const clarityLabel = getClarityLabel(subtitle.clarityScore)

  return (
    <div className="flex justify-center mb-4">
      <div className={`w-full max-w-[90%] rounded-xl border-2 ${clarityBgColor} overflow-hidden shadow-sm`}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/50 border-b border-current/20">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <EarIcon className="w-4 h-4" />
            <span>双行字幕镜</span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${clarityColor}`}>
            <span>清晰度: {subtitle.clarityScore}%</span>
            <span>({clarityLabel})</span>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-4 space-y-3">
          {/* 第一行：机器听到的 */}
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
              <EarIcon className="w-3 h-3 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1">机器听到的</div>
              <div className="text-gray-900 font-medium bg-white/70 rounded-lg px-3 py-2 border border-gray-200">
                {subtitle.originalText || '(无法识别)'}
              </div>
            </div>
          </div>

          {/* 箭头 */}
          {subtitle.isCorrected && (
            <div className="flex justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          )}

          {/* 第二行：AI 理解的意图 */}
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
              <BrainIcon className="w-3 h-3 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1">AI 理解的意图</div>
              <div className="text-gray-900 font-medium bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                {subtitle.correctedText}
              </div>
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        {subtitle.isCorrected && (
          <div className="px-4 py-2 bg-white/30 border-t border-current/10 text-xs text-gray-600">
            💡 您的声音被理解了，但可能需要更清晰的发音
          </div>
        )}
      </div>
    </div>
  )
}
