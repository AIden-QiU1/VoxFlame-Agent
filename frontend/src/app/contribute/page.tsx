'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useStepAudio } from '@/hooks/useStepAudio'
import { useContributor } from '@/hooks/useContributor'
import { useVoiceUpload } from '@/hooks/useVoiceUpload'
import { getRandomSentence, CATEGORY_NAMES, DIFFICULTY_NAMES, type CorpusSentence as Sentence } from '@/lib/corpus/sentences'
import { AudioProcessor } from '@/lib/audio/audio-processor'
import { InstallPrompt, OfflineNotice, UpdatePrompt } from '@/components/pwa'
/**
 * 数据收集页面
 * 
 * 设计风格：温暖、包容、无障碍友好
 * 功能：
 * 1. AI 对话引导（可选）
 * 2. 引导式录音 - 跟读句子
 * 3. 自由录音 - 说自己想说的话
 */
type PageMode = 'chat' | 'guided' | 'free'
type RecordingState = 'idle' | 'recording' | 'processing' | 'done'
export default function ContributePage() {
  // 页面模式
  const [mode, setMode] = useState<PageMode>('chat')
  
  // AI 对话相关
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([])
  const [showRecordingOption, setShowRecordingOption] = useState(false)
  
  // 录音相关
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [currentSentence, setCurrentSentence] = useState<Sentence | null>(null)
  const [completedCount, setCompletedCount] = useState(0)
  const [freeText, setFreeText] = useState('')
  
  // Hooks
  const { contributor, displayName } = useContributor()
  const { uploadRecording, isUploading, uploadProgress, lastError } = useVoiceUpload()
  
  // AI 语音对话
  const {
    isConnected: isAIConnected,
    isListening: isAIListening,
    isSpeaking: isAISpeaking,
    userTranscript,
    aiTranscript,
    connect: connectAI,
    disconnect: disconnectAI,
    startListening: startAIListening,
    stopListening: stopAIListening,
  } = useStepAudio({
    apiKey: process.env.NEXT_PUBLIC_STEP_API_KEY || '',
    voice: 'wenrounansheng',
    systemPrompt: getContributeSystemPrompt(),
    onError: (error) => console.error('AI Error:', error)
  })
  // Refs
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  // 初始化
  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor()
    setCurrentSentence(getRandomSentence())
    
    // 尝试连接 AI（如果有 API Key）
    if (process.env.NEXT_PUBLIC_STEP_API_KEY) {
      connectAI().catch(() => {
        console.log('AI connection failed, using manual mode')
      })
    }
    return () => {
      audioProcessorRef.current?.stop()
      disconnectAI()
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])
  // 监听 AI 转录
  useEffect(() => {
    if (aiTranscript) {
      setChatMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg?.role === 'ai') {
          return [...prev.slice(0, -1), { role: 'ai', text: aiTranscript }]
        }
        return [...prev, { role: 'ai', text: aiTranscript }]
      })
      
      // 检测 AI 是否提到了录音
      if (aiTranscript.includes('录音') || aiTranscript.includes('开始') || aiTranscript.includes('试试')) {
        setShowRecordingOption(true)
      }
    }
  }, [aiTranscript])
  useEffect(() => {
    if (userTranscript) {
      setChatMessages(prev => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg?.role === 'user') {
          return [...prev.slice(0, -1), { role: 'user', text: userTranscript }]
        }
        return [...prev, { role: 'user', text: userTranscript }]
      })
    }
  }, [userTranscript])
  // 自动滚动到最新消息
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])
  // 开始与 AI 对话
  const startChat = async () => {
    if (isAIConnected) {
      await startAIListening()
    } else {
      setMode('guided')
    }
  }
  // 开始录音
  const startRecording = async () => {
    if (!audioProcessorRef.current) return
    try {
      setRecordingState('recording')
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
      await audioProcessorRef.current.start(() => {}, true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      setRecordingState('idle')
    }
  }
  // 停止录音并上传
  const stopRecording = async () => {
    if (!audioProcessorRef.current) return
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setRecordingState('processing')
    const recordingData = audioProcessorRef.current.stop()
    if (recordingData && recordingData.duration >= 1) {
      const textContent = mode === 'guided' && currentSentence ? currentSentence.text : freeText
      
      const success = await uploadRecording(recordingData.blob, {
        text: textContent,
        duration: recordingData.duration,
        source: mode === 'guided' ? 'guided_recording' : 'free_recording',
        sentenceId: mode === 'guided' && currentSentence ? currentSentence.id : undefined
      })
      if (success) {
        setCompletedCount(c => c + 1)
        if (mode === 'guided') {
          setCurrentSentence(getRandomSentence())
        } else {
          setFreeText('')
        }
      }
    }
    setRecordingState('done')
    setTimeout(() => setRecordingState('idle'), 1500)
  }
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  const switchToRecording = (recordMode: 'guided' | 'free') => {
    stopAIListening()
    setMode(recordMode)
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      {/* 顶部导航 */}
      <nav 
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-amber-100"
        role="navigation"
        aria-label="主导航"
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/ranyan" className="flex items-center gap-2" aria-label="燃言项目首页">
            <span className="text-2xl" aria-hidden="true">🔥</span>
            <span className="font-bold text-gray-900">燃言</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-amber-600 font-medium" aria-live="polite">
              已贡献 {completedCount} 条
            </span>
            <div 
              className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center"
              aria-label={`贡献者: ${displayName}`}
              title={displayName}
            >
              <span className="text-amber-600 text-sm font-bold">
                {displayName?.[0] || '?'}
              </span>
            </div>
          </div>
        </div>
      </nav>
      <main className="pt-24 pb-16 px-6" role="main">
        <div className="max-w-2xl mx-auto">
          
          {/* AI 对话模式 */}
          {mode === 'chat' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-lg p-6 min-h-[400px] flex flex-col">
                {/* 无 AI 时的欢迎界面 */}
                {chatMessages.length === 0 && !isAIConnected && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-6xl mb-4" aria-hidden="true">👋</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">你好！</h1>
                    <p className="text-gray-500 mb-6">
                      感谢你来帮助我们收集语音数据。
                      <br />
                      你的每一句话都很珍贵。
                    </p>
                    <button
                      onClick={() => setMode('guided')}
                      className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold transition-all focus:outline-none focus:ring-4 focus:ring-amber-300"
                      aria-label="开始贡献声音"
                    >
                      开始贡献声音 🎤
                    </button>
                  </div>
                )}
                {/* 有 AI 但未开始对话 */}
                {chatMessages.length === 0 && isAIConnected && !isAIListening && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-6xl mb-4" aria-hidden="true">🎙️</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">准备好了吗？</h1>
                    <p className="text-gray-500 mb-6">
                      点击下方按钮，我会先和你聊聊天，
                      <br />
                      然后再开始录音。
                    </p>
                    <button
                      onClick={startChat}
                      className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold transition-all focus:outline-none focus:ring-4 focus:ring-amber-300"
                    >
                      开始对话 ✨
                    </button>
                  </div>
                )}
                {/* 对话消息列表 */}
                {chatMessages.length > 0 && (
                  <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto space-y-4 mb-4"
                    role="log"
                    aria-label="对话记录"
                  >
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                            msg.role === 'user'
                              ? 'bg-amber-500 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}
                          role={msg.role === 'ai' ? 'status' : undefined}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    
                    {/* AI 正在说话指示 */}
                    {isAISpeaking && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2" role="status" aria-label="AI 正在说话">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* 对话控制按钮 */}
                {isAIConnected && chatMessages.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {showRecordingOption && (
                      <div className="flex gap-3 justify-center flex-wrap">
                        <button
                          onClick={() => switchToRecording('guided')}
                          className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-all focus:outline-none focus:ring-4 focus:ring-amber-300"
                        >
                          好的，开始跟读
                        </button>
                        <button
                          onClick={() => switchToRecording('free')}
                          className="px-6 py-3 bg-white border-2 border-amber-500 text-amber-600 rounded-full font-medium transition-all hover:bg-amber-50 focus:outline-none focus:ring-4 focus:ring-amber-300"
                        >
                          我想自由说话
                        </button>
                      </div>
                    )}
                    
                    {/* 语音输入按钮 */}
                    <div className="flex justify-center">
                      <button
                        onMouseDown={startAIListening}
                        onMouseUp={stopAIListening}
                        onTouchStart={startAIListening}
                        onTouchEnd={stopAIListening}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-4 focus:ring-amber-300 ${
                          isAIListening
                            ? 'bg-red-500 text-white scale-110'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        aria-label={isAIListening ? '松开发送' : '按住说话'}
                        aria-pressed={isAIListening}
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-center text-gray-400 text-sm" aria-hidden="true">
                      {isAIListening ? '松开发送' : '按住说话'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* 引导式录音模式 */}
          {mode === 'guided' && currentSentence && (
            <div className="space-y-6">
              {/* 句子卡片 */}
              <div className="bg-white rounded-3xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                    {CATEGORY_NAMES[currentSentence.category]}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {DIFFICULTY_NAMES[currentSentence.difficulty]}
                  </span>
                </div>
                
                <p 
                  className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 text-center py-8 leading-relaxed"
                  aria-label={`请朗读: ${currentSentence.text}`}
                >
                  {currentSentence.text}
                </p>
                
                <div className="flex justify-center">
                  <button
                    onClick={() => setCurrentSentence(getRandomSentence())}
                    className="text-amber-500 hover:text-amber-600 text-sm font-medium focus:outline-none focus:underline"
                    aria-label="换一句话"
                  >
                    换一句 →
                  </button>
                </div>
              </div>
              {/* 录音控制 */}
              <RecordingControl
                recordingState={recordingState}
                recordingTime={recordingTime}
                onStart={startRecording}
                onStop={stopRecording}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                lastError={lastError}
              />
              {/* 模式切换 */}
              <div className="flex justify-center gap-4 flex-wrap">
                <button
                  onClick={() => setMode('free')}
                  className="text-amber-500 hover:text-amber-600 text-sm font-medium focus:outline-none focus:underline"
                >
                  切换到自由录音 →
                </button>
                {isAIConnected && (
                  <button
                    onClick={() => setMode('chat')}
                    className="text-gray-400 hover:text-gray-600 text-sm font-medium focus:outline-none focus:underline"
                  >
                    返回对话
                  </button>
                )}
              </div>
            </div>
          )}
          {/* 自由录音模式 */}
          {mode === 'free' && (
            <div className="space-y-6">
              {/* 文本输入 */}
              <div className="bg-white rounded-3xl shadow-lg p-8">
                <label htmlFor="free-text" className="block text-gray-700 font-medium mb-2">
                  你想说什么？
                </label>
                <textarea
                  id="free-text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="输入你想说的话，或者直接录音..."
                  className="w-full h-32 p-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 resize-none"
                  aria-describedby="free-text-hint"
                />
                <p id="free-text-hint" className="text-gray-400 text-sm mt-2">
                  可以先写下来，也可以直接录音
                </p>
              </div>
              {/* 录音控制 */}
              <RecordingControl
                recordingState={recordingState}
                recordingTime={recordingTime}
                onStart={startRecording}
                onStop={stopRecording}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                lastError={lastError}
              />
              {/* 模式切换 */}
              <div className="flex justify-center gap-4 flex-wrap">
                <button
                  onClick={() => setMode('guided')}
                  className="text-amber-500 hover:text-amber-600 text-sm font-medium focus:outline-none focus:underline"
                >
                  ← 切换到跟读模式
                </button>
                {isAIConnected && (
                  <button
                    onClick={() => setMode('chat')}
                    className="text-gray-400 hover:text-gray-600 text-sm font-medium focus:outline-none focus:underline"
                  >
                    返回对话
                  </button>
                )}
              </div>
            </div>
          )}
          {/* 底部提示 */}
          <div className="text-center mt-8 text-gray-400 text-sm">
            <p>
              您的语音数据将被匿名存储，用于改进语音识别技术。
              <br />
              <Link href="/ranyan" className="text-amber-500 hover:underline">了解更多</Link>
            </p>
          </div>
        </div>
      </main>
      {/* PWA 组件 */}
      <OfflineNotice />
      <InstallPrompt />
      <UpdatePrompt />
    </div>
  )
}
/**
 * 录音控制组件
 */
interface RecordingControlProps {
  recordingState: RecordingState
  recordingTime: number
  onStart: () => void
  onStop: () => void
  isUploading: boolean
  uploadProgress: number
  lastError: string | null
}
function RecordingControl({
  recordingState,
  recordingTime,
  onStart,
  onStop,
  isUploading,
  uploadProgress,
  lastError
}: RecordingControlProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return (
    <div className="bg-white rounded-3xl shadow-lg p-8">
      <div className="flex flex-col items-center">
        {/* 录音时间 */}
        {recordingState === 'recording' && (
          <div 
            className="text-4xl font-mono text-red-500 mb-4"
            role="timer"
            aria-live="polite"
          >
            {formatTime(recordingTime)}
          </div>
        )}
        {/* 录音按钮 */}
        <button
          onClick={recordingState === 'recording' ? onStop : onStart}
          disabled={recordingState === 'processing'}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-4 focus:ring-amber-300 ${
            recordingState === 'recording'
              ? 'bg-red-500 text-white animate-pulse'
              : recordingState === 'processing'
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
          aria-label={
            recordingState === 'recording' ? '点击停止录音' :
            recordingState === 'processing' ? '正在保存' :
            '点击开始录音'
          }
        >
          {recordingState === 'recording' ? (
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : recordingState === 'processing' ? (
            <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <p className="text-gray-500 mt-4" aria-hidden="true">
          {recordingState === 'recording' ? '点击停止' : 
           recordingState === 'processing' ? '保存中...' : 
           '点击开始录音'}
        </p>
        {/* 上传进度 */}
        {isUploading && (
          <div className="w-full max-w-xs mt-4" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        {/* 错误提示 */}
        {lastError && (
          <p className="text-amber-600 text-sm mt-2" role="alert">{lastError}</p>
        )}
        {/* 完成提示 */}
        {recordingState === 'done' && !lastError && (
          <p className="text-green-500 text-sm mt-2" role="status">✓ 保存成功！</p>
        )}
      </div>
    </div>
  )
}
/**
 * 获取数据收集场景的系统提示词
 */
function getContributeSystemPrompt(): string {
  return `你是燃言的 AI 助手，一个温暖、有同理心的语音伙伴。
你的任务是引导用户参与语音数据收集，帮助改进语音识别技术。
**对话风格：**
- 温暖、耐心、鼓励
- 像朋友一样自然聊天
- 回复简短，每次 1-2 句话
- 不要一开始就提到录音，先聊几句
**对话流程：**
1. 先打招呼，问问用户今天怎么样
2. 简单了解他们为什么来（自己需要？帮家人？想帮忙？）
3. 表达感谢和理解
4. 自然地引出"要不要试试录音"
**重要：**
- 如果用户说话不太清楚，不要纠正，表示理解
- 用鼓励的语气，让用户感到自己的声音很有价值
- 提到"录音"或"开始"时，用户界面会显示录音按钮
**示例开场：**
"你好呀！今天怎么样？"（等待回复）
"原来是这样，很高兴认识你..."（继续对话）`
}
