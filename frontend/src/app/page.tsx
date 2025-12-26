'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import { ASRClient } from '@/lib/websocket/asr-client'
import { AudioProcessor } from '@/lib/audio/audio-processor'
import { RecognitionResult, WebSocketMessage } from '@/lib/types'
import { InstallPrompt, OfflineNotice, UpdatePrompt } from '@/components/pwa'

/**
 * 主页 - 语音识别体验页面
 * 
 * 设计风格：温暖、简洁、无障碍友好
 * - 大字体、高对比度
 * - 清晰的视觉反馈
 * - 支持键盘导航
 */
export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string>('')
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  const fullTranscriptRef = useRef<string>('')
  const asrClientRef = useRef<ASRClient | null>(null)
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  
  // 获取或创建贡献者ID
  const getContributorId = (): string => {
    const stored = localStorage.getItem('ranyan_contributor_id')
    if (stored) return stored
    
    const newId = `v_${Math.random().toString(36).substring(2, 10)}`
    localStorage.setItem('ranyan_contributor_id', newId)
    return newId
  }

  // 初始化 AudioProcessor
  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor()
    return () => {
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stop()
      }
      if (asrClientRef.current) {
        asrClientRef.current.close()
      }
    }
  }, [])

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 空格键开始/停止录音
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        if (isRecording) {
          stopRecording()
        } else {
          startRecording()
        }
      }
      // ESC 键停止录音
      if (e.code === 'Escape' && isRecording) {
        stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording])

  // 开始录音
  const startRecording = async () => {
    try {
      setStatus('正在连接...')
      setTranscript('')
      fullTranscriptRef.current = ''

      const asrClient = new ASRClient()
      asrClientRef.current = asrClient

      await asrClient.connect(
        () => {
          setStatus('你说，我静静地听着呢！')
        },
        (message: WebSocketMessage) => {
          if (message.type === 'result') {
            const result: RecognitionResult = message.data
            
            if (result.utterances && result.utterances.length > 0) {
              result.utterances.forEach((utterance) => {
                if (utterance.definite) {
                  fullTranscriptRef.current += utterance.text + ' '
                } else {
                  const text = utterance.text
                  if (!text || text === 'undefined') return

                  const lastPunctuation = Math.max(
                    text.lastIndexOf('。'),
                    text.lastIndexOf('？'),
                    text.lastIndexOf('！')
                  )

                  if (lastPunctuation >= 0) {
                    setTranscript(text.substring(lastPunctuation + 1).trim())
                  } else {
                    setTranscript(text)
                  }
                }
              })
            } else if (result.text && result.text !== 'undefined') {
              const text = result.text
              fullTranscriptRef.current = text
              
              const lastPunctuation = Math.max(
                text.lastIndexOf('。'),
                text.lastIndexOf('？'),
                text.lastIndexOf('！')
              )

              if (lastPunctuation >= 0) {
                setTranscript(text.substring(lastPunctuation + 1).trim())
              } else {
                setTranscript(text)
              }
            }
          } else if (message.type === 'error') {
            setStatus('连接出错，请重试')
          }
        },
        () => setStatus('连接错误'),
        () => {}
      )

      if (audioProcessorRef.current) {
        const analyser = await audioProcessorRef.current.start(
          (data) => {
            if (asrClientRef.current?.isOpen()) {
              asrClientRef.current.send(data)
            }
          },
          true
        )
        analyserRef.current = analyser
      }

      setIsRecording(true)
      setStatus('你说，我静静地听着呢！')
    } catch (error) {
      setStatus('启动录音失败，请检查麦克风权限')
    }
  }

  // 保存录音到本地
  const saveRecordingLocally = async (blob: Blob, transcriptText: string, duration: number) => {
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        const recordings = JSON.parse(localStorage.getItem('ranyan_local_recordings') || '[]')
        recordings.push({
          id: `local_${Date.now()}`,
          audioData: base64,
          transcript: transcriptText,
          duration,
          contributorId: getContributorId(),
          source: 'transcription_page',
          createdAt: new Date().toISOString()
        })
        localStorage.setItem('ranyan_local_recordings', JSON.stringify(recordings))
      }
      reader.readAsDataURL(blob)
    } catch (error) {
      console.error('本地保存失败:', error)
    }
  }

  // 停止录音
  const stopRecording = async () => {
    try {
      if (asrClientRef.current?.isOpen()) {
        asrClientRef.current.send(JSON.stringify({ type: 'end' }))
        asrClientRef.current.close()
        asrClientRef.current = null
      }

      let recordingData: { blob: Blob; duration: number } | null = null
      if (audioProcessorRef.current) {
        recordingData = audioProcessorRef.current.stop()
      }

      if (recordingData && recordingData.duration >= 1) {
        setIsSaving(true)
        const finalTranscript = fullTranscriptRef.current.trim() || transcript
        await saveRecordingLocally(recordingData.blob, finalTranscript, recordingData.duration)
        setIsSaving(false)
      }

      setIsRecording(false)
      setTranscript('')
      setStatus('')
    } catch (error) {
      setStatus('停止录音失败')
      setIsSaving(false)
    }
  }

  const handleScreenClick = () => {
    if (isRecording) {
      stopRecording()
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50 relative overflow-hidden"
      onClick={handleScreenClick}
      role="main"
      aria-label="语音识别主页"
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-orange-100/30 rounded-full blur-3xl"></div>
      </div>

      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-amber-100" role="navigation">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label="首页">
              <span className="text-2xl" aria-hidden="true">🔥</span>
              <span className="text-xl font-bold text-gray-900">燃言</span>
            </Link>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Beta
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/contribute" 
              className="text-gray-600 hover:text-amber-600 transition-colors font-medium"
            >
              贡献声音
            </Link>
            <Link 
              href="/ranyan" 
              className="text-gray-600 hover:text-amber-600 transition-colors font-medium"
            >
              关于项目
            </Link>
            <a
              href="https://github.com/AIden-QiU1/dysarthria-voice-assistant"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="GitHub 仓库"
            >
              <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 pt-24">
        <div className="max-w-4xl w-full text-center">
          {/* 识别结果显示 */}
          {transcript ? (
            <div className="animate-fadeIn" role="status" aria-live="polite">
              <p className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                {transcript}
              </p>
            </div>
          ) : isRecording ? (
            <div className="text-gray-500 text-xl md:text-2xl" role="status" aria-live="polite">
              {status}
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                让AI
                <span className="text-amber-500">听懂</span>
                你的声音
              </h1>
              <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto">
                首个专为构音障碍患者打造的开源语音识别项目
              </p>

              {/* 开始录音按钮 */}
              <div className="pt-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startRecording()
                  }}
                  className="group px-10 py-5 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-200 focus:outline-none focus:ring-4 focus:ring-amber-300"
                  aria-label="开始录音，按空格键也可以"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span>开始说话</span>
                  </div>
                </button>
                <p className="text-gray-400 text-sm mt-4">
                  或按 <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600">空格键</kbd> 开始
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 底部用户须知 */}
      {!isRecording && (
        <footer className="fixed bottom-0 left-0 right-0 z-20 py-6 bg-gradient-to-t from-white/80 to-transparent">
          <div className="text-center text-gray-400 text-sm max-w-lg mx-auto px-4">
            <p>
              使用本服务即表示您同意您的语音数据将被匿名存储，用于改进语音识别技术。
              <Link href="/ranyan" className="text-amber-500 hover:underline ml-1">
                了解更多 →
              </Link>
            </p>
          </div>
        </footer>
      )}

      {/* 保存中提示 */}
      {isSaving && (
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center" role="status" aria-live="polite">
          <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            正在保存您的贡献...
          </div>
        </div>
      )}

      {/* 波形可视化 */}
      <WaveformVisualizer analyser={analyserRef.current} isRecording={isRecording} />

      {/* 录音时的提示 */}
      {isRecording && (
        <div className="fixed top-24 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div 
            className="bg-gray-900/80 backdrop-blur-md px-6 py-3 rounded-full text-white text-sm animate-fadeIn"
            role="status"
          >
            点击屏幕任意位置或按 <kbd className="px-2 py-0.5 bg-white/20 rounded">空格</kbd> 停止录音
          </div>
        </div>
      )}

      {/* PWA 组件 */}
      <OfflineNotice />
      <InstallPrompt />
      <UpdatePrompt />

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  )
}
