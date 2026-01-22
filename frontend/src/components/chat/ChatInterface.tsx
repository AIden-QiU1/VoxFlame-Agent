/**
 * ChatInterface Component
 * Phase 8: Frontend WebSocket Integration
 * 
 * 对话界面组件 - 温暖、无障碍友好设计
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { useAgent, ConversationMessage } from '@/hooks/useAgent'
import WaveformVisualizer from '@/components/WaveformVisualizer'

interface ChatInterfaceProps {
  userId?: string
}

export default function ChatInterface({ userId }: ChatInterfaceProps) {
  const {
    isConnected,
    isRecording,
    isThinking,
    isSpeaking,
    sessionId,
    currentASRText,
    currentResponseText,
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

  // Audio player ref for TTS playback
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Initialize audio player
  useEffect(() => {
    const audio = new Audio()
    audio.addEventListener('ended', () => setIsPlayingAudio(false))
    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e)
      setIsPlayingAudio(false)
    })
    audioPlayerRef.current = audio
    
    return () => {
      audio.pause()
      audio.src = ''
      audio.removeEventListener('ended', () => setIsPlayingAudio(false))
      audio.removeEventListener('error', () => setIsPlayingAudio(false))
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
      // Escape to stop recording
      if (e.code === 'Escape' && isRecording) {
        stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConnected, isRecording, toggleRecording, stopRecording])

  // Handle text submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (textInput.trim()) {
      sendText(textInput.trim())
      setTextInput('')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
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
            {!isConnected ? (
              <button
                onClick={connect}
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
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && !currentResponseText && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                你好！我是燃言助手
              </h2>
              <p className="text-gray-600 mb-6">
                我会记住你说的每一句话，随时为你提供帮助
              </p>
              {!isConnected && (
                <button
                  onClick={connect}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors"
                >
                  开始对话
                </button>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Current ASR text (partial) */}
          {currentASRText && (
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

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink { animation: blink 1s infinite; }
      `}</style>
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
