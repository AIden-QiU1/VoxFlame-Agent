/**
 * ChatInterface Component
 * Current RTC/RTM communication surface
 * 
 * 对话界面组件 - 温暖、无障碍友好设计
 */

'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRtcAgentSession, ConversationMessage, DualLineSubtitle } from '@/hooks/useRtcAgentSession'
import { useWorkspaceMemorySnapshot } from '@/hooks/useWorkspaceMemorySnapshot'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import { CommunicationStarterKit } from '@/components/chat/CommunicationStarterKit'
import { QuickPhrasesPanel } from '@/components/phrases'
import { UserNav } from '@/components/ui/user-nav'
import { SessionReadinessPanel } from '@/components/runtime/SessionReadinessPanel'
import {
  STARTER_KIT_SCENES,
  type StarterKitScene,
} from '@/lib/communication/starter-kit'
import {
  defaultCapabilitiesForMode,
  defaultStrategyForMode,
  type RtcScene,
} from '@/lib/realtime-audio/session-contract'
import { cn } from '@/lib/utils'
import { BrainIcon, EarIcon, XIcon } from 'lucide-react'

interface ChatInterfaceProps {
  userId?: string
  isAuthenticated?: boolean
  initialStarterSceneId?: StarterKitScene['id']
  homeHref?: string
  onReturnHome?: () => void
}

function mapStarterSceneToRuntimeScene(
  sceneId: StarterKitScene['id'] | undefined,
): RtcScene | undefined {
  if (sceneId === 'workplace') {
    return 'work'
  }

  if (sceneId === 'caregiver') {
    return 'family'
  }

  return sceneId
}

export default function ChatInterface({
  userId,
  isAuthenticated = false,
  initialStarterSceneId,
  homeHref,
  onReturnHome,
}: ChatInterfaceProps) {
  const requestedRuntimeScene = mapStarterSceneToRuntimeScene(initialStarterSceneId)
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
    sessionIntent,
    sessionReadiness,
    grantedCapabilities,
    analyser,
    connect,
    disconnect,
    stopRecording,
    toggleRecording,
    sendText,
  } = useRtcAgentSession({
    userId,
    surface: 'communication_workspace',
    scene: requestedRuntimeScene,
  })

  const [textInput, setTextInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showPhrasesPanel, setShowPhrasesPanel] = useState(false)
  const [isCaptionMode, setIsCaptionMode] = useState(false)
  const [isLaunchingStarter, setIsLaunchingStarter] = useState(false)
  const [microphoneEnvironmentWarning, setMicrophoneEnvironmentWarning] = useState<string | null>(null)
  const [activeStarterSceneId, setActiveStarterSceneId] = useState<StarterKitScene['id'] | undefined>(initialStarterSceneId)
  const {
    snapshot: workspaceSnapshot,
    isLoading: isWorkspaceLoading,
  } = useWorkspaceMemorySnapshot({
    userId,
    isAuthenticated,
    sceneId: activeStarterSceneId,
  })

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponseText])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!window.isSecureContext) {
      setMicrophoneEnvironmentWarning('当前页面不是安全连接。麦克风只会在 HTTPS 或本机地址下可用。')
      return
    }

    if (!navigator.mediaDevices) {
      setMicrophoneEnvironmentWarning('当前浏览器暂时不支持麦克风访问，请换到较新的浏览器再试。')
      return
    }

    setMicrophoneEnvironmentWarning(null)
  }, [])

  useEffect(() => {
    setActiveStarterSceneId(initialStarterSceneId)
  }, [initialStarterSceneId])

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
      void sendText(textInput.trim())
      setTextInput('')
    }
  }

  const handlePhrasePlay = async (text: string) => {
    setIsLaunchingStarter(true)

    try {
      if (!isConnected) {
        await connect({ suppressGreeting: true })
      }

      await sendText(text)
      setShowPhrasesPanel(false)
    } finally {
      setIsLaunchingStarter(false)
    }
  }

  const latestAssistantText = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.content
  const captionText = currentResponseText || currentDualLine?.correctedText || latestAssistantText || currentASRText
  const hasConversationStarted = messages.length > 0 || Boolean(currentResponseText) || Boolean(currentASRText)
  const statusText = isRecording
    ? '正在听你说话'
    : isSpeaking
      ? '正在为你代播'
      : isThinking
        ? '正在整理回应'
        : isConnected
          ? '已经准备好沟通'
          : '还没连接助手'
  const personalizedPhrases = useMemo(
    () => workspaceSnapshot?.expression_kit.personalized_phrases ?? [],
    [workspaceSnapshot],
  )
  const recommendedFocus = useMemo(
    () => workspaceSnapshot?.expression_kit.recommended_focus ?? [],
    [workspaceSnapshot],
  )
  const sessionReview = workspaceSnapshot?.session_review ?? null
  const effectiveSceneId = workspaceSnapshot?.expression_kit.active_scene_id ?? activeStarterSceneId
  const activeStarterScene = useMemo(
    () => STARTER_KIT_SCENES.find((scene) => scene.id === effectiveSceneId),
    [effectiveSceneId],
  )
  const hasWorkspaceGuidance = useMemo(
    () => personalizedPhrases.length > 0 || recommendedFocus.length > 0 || Boolean(sessionReview),
    [personalizedPhrases.length, recommendedFocus.length, sessionReview],
  )
  const runtimeScene = useMemo<RtcScene | undefined>(
    () => mapStarterSceneToRuntimeScene(effectiveSceneId),
    [effectiveSceneId],
  )
  const plannedIntent = useMemo(() => ({
    surface: 'communication_workspace' as const,
    mode: 'communication' as const,
    sessionStrategy: defaultStrategyForMode('communication'),
    requestedCapabilities: defaultCapabilitiesForMode('communication'),
    scene: runtimeScene,
  }), [runtimeScene])

  return (
    <div className="flex h-dvh bg-stone-50">
      <WaveformVisualizer analyser={analyser} isRecording={isRecording} />
      {showPhrasesPanel ? (
        <button
          type="button"
          aria-label="关闭表达工具箱"
          onClick={() => setShowPhrasesPanel(false)}
          className="fixed inset-0 z-20 bg-stone-950/20"
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-xl transition-transform duration-200',
          showPhrasesPanel ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-700">表达工具箱</p>
            <h2 className="text-lg font-semibold text-stone-950">常用短语与个人表达</h2>
            <p className="text-sm text-stone-600 text-pretty">
              这里放你的高频短语和补救句。需要时少打字、少切换，直接补一句就行。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭表达工具箱"
            onClick={() => setShowPhrasesPanel(false)}
            className="flex size-10 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-950"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <QuickPhrasesPanel onPhrasePlay={handlePhrasePlay} />
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
      <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              燃
            </div>
            <div>
              <div className="text-lg font-semibold text-stone-950">燃言助手</div>
              <div className="text-sm text-stone-500">沟通工作台</div>
            </div>
            {sessionId && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                已连接
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {homeHref && (
              onReturnHome ? (
                <button
                  type="button"
                  onClick={onReturnHome}
                  className="hidden text-sm text-stone-600 hover:text-stone-950 sm:inline"
                >
                  返回首页
                </button>
              ) : (
                <Link href={homeHref} className="hidden text-sm text-stone-600 hover:text-stone-950 sm:inline">
                  返回首页
                </Link>
              )
            )}
            <Link href="/memory" className="hidden text-sm text-stone-600 hover:text-stone-950 lg:inline">
              沟通档案
            </Link>
            <Link href="/contribute" className="hidden text-sm text-stone-600 hover:text-stone-950 lg:inline">
              练习表达
            </Link>
            <button
              type="button"
              onClick={() => setShowPhrasesPanel(true)}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-950"
            >
              表达工具箱
            </button>
            {!isConnected ? (
              <button
                onClick={() => {
                  void connect()
                }}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                连接助手
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="rounded-full bg-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-300"
              >
                断开连接
              </button>
            )}
            <button
              onClick={() => setIsCaptionMode(!isCaptionMode)}
              className="hidden rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 md:inline-flex"
            >
              {isCaptionMode ? '退出字幕辅助' : '字幕辅助'}
            </button>
            <UserNav />
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-amber-700">先点一句，再继续说</div>
                  <h1 className="max-w-3xl text-3xl font-semibold text-stone-950 text-balance">
                    先把关键一句送出去，后面再慢慢补充
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-stone-600 text-pretty">
                    如果现在不想从零开始，先点一句场景句。对方听清后，再说第二句、第三句会轻松很多。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPhrasesPanel(true)}
                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-950"
                  >
                    打开表达工具箱
                  </button>
                  {!isConnected ? (
                    <button
                      type="button"
                      onClick={() => {
                        void connect()
                      }}
                      className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                    >
                      先连接助手
                    </button>
                  ) : null}
                </div>
              </div>
              {microphoneEnvironmentWarning ? (
                <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {microphoneEnvironmentWarning}
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-stone-200 bg-stone-100 p-5 shadow-sm">
              <div className="text-sm font-medium text-stone-700">如果你这会儿有点紧张</div>
              <div className="mt-3 text-2xl font-semibold text-stone-950">{statusText}</div>
              <div className="mt-2 space-y-2 text-sm text-stone-600">
                <p>先选一个最接近的场景，再点一句开口句。</p>
                <p>对方停下来后，再用语音、文字或短语继续补充。</p>
                <p>如果被打断，就打开表达工具箱先补一句。</p>
              </div>
            </div>
          </section>

          <SessionReadinessPanel
            intent={sessionIntent}
            readiness={sessionReadiness}
            grantedCapabilities={grantedCapabilities}
            plannedIntent={plannedIntent}
            title="沟通前准备"
          />

          {hasWorkspaceGuidance ? (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-stone-700">为你准备的表达</div>
                      <h2 className="mt-1 text-xl font-semibold text-stone-950">个体化表达建议</h2>
                      <p className="mt-2 text-sm leading-6 text-stone-600 text-pretty">
                      这里不是说明文案。点一下下面任一句，助手就会直接帮你代播；紧张时先点一句，比临场组织更轻松。
                      </p>
                    {activeStarterScene ? (
                      <div className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                        当前按 {activeStarterScene.title} 场景优先排序
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPhrasesPanel(true)}
                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-950"
                  >
                    编辑表达工具箱
                  </button>
                </div>

                {isWorkspaceLoading ? (
                  <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                    正在整理你的个体化表达建议...
                  </div>
                ) : null}

                <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
                  这排句子可以直接点，不用先输入文字。
                  {isConnected
                    ? ' 现在点一下就会代播。'
                    : ' 还没连接时，系统会先帮你连上，再把这句送出去。'}
                </div>

                {personalizedPhrases.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {personalizedPhrases.map((phrase) => (
                      <button
                        key={phrase.id}
                        type="button"
                        onClick={() => {
                          void handlePhrasePlay(phrase.text)
                        }}
                        disabled={isLaunchingStarter}
                        title={phrase.note}
                        className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-left text-sm font-medium text-stone-800 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {phrase.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                    你的常用句还在慢慢长出来。先用下面的场景句开口，后面这里会越来越像你自己。
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-stone-200 bg-stone-100 p-5 shadow-sm">
                <div className="text-sm font-medium text-stone-700">
                  {sessionReview?.headline ?? '这次对话后留给你的提醒'}
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700 text-pretty">
                  {sessionReview?.summary ?? '这次沟通结束后，这里会留下下一次最该先准备的一件事。'}
                </p>
                {sessionReview?.recent_win ? (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    最近亮点：{sessionReview.recent_win}
                  </div>
                ) : null}
                {recommendedFocus.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recommendedFocus.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                {sessionReview?.next_step ? (
                  <div className="mt-4 text-sm text-stone-600">
                    下一步：{sessionReview.next_step}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Welcome message */}
          {!hasConversationStarted && (
            <div className="space-y-4">
              <CommunicationStarterKit
                disabled={isLaunchingStarter}
                initialSceneId={initialStarterSceneId}
                isConnected={isConnected}
                isLaunching={isLaunchingStarter}
                onSceneChange={setActiveStarterSceneId}
                onSelectPhrase={(text) => {
                  void handlePhrasePlay(text)
                }}
              />
              <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                如果这会儿不方便自己先说，也可以先点一句场景句代播，再慢慢补充。
              </div>
            </div>
          )}

          {hasConversationStarted ? (
            <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-stone-900">沟通已经开始</div>
                  <p className="mt-1 text-sm text-stone-600 text-pretty">
                    需要补一句高频表达、常用需求或个人短语时，随时打开表达工具箱。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhrasesPanel(true)}
                  className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-950"
                >
                  打开表达工具箱
                </button>
              </div>
            </section>
          ) : null}

          {/* Message list */}
          {hasConversationStarted ? (
            <section className="rounded-[32px] border border-stone-200 bg-white px-4 py-5 shadow-sm sm:px-6">
              <div className="space-y-4">
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
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-amber-100 px-4 py-3 text-amber-900">
                      {currentASRText}
                      <span className="ml-1 inline-block h-4 w-1.5 bg-amber-500 animate-blink"></span>
                    </div>
                  </div>
                )}

                {/* Thinking indicator */}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3 text-stone-700">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm">{currentResponseText || '思考中...'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming response */}
                {currentResponseText && !isThinking && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3 text-stone-900 shadow-sm">
                      {currentResponseText}
                      <span className="ml-1 inline-block h-4 w-1.5 bg-amber-500 animate-blink"></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </section>
          ) : null}

          {!hasConversationStarted && (
            <div ref={messagesEndRef} />
          )}
        </div>
      </main>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm">
          {error}
        </div>
      )}

      {/* Input Area */}
      <footer className="border-t border-stone-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-4">
            {/* Voice button */}
            <button
              onClick={toggleRecording}
              disabled={!isConnected}
              className={cn(
                'flex size-14 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-colors',
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : isConnected
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'cursor-not-allowed bg-stone-300',
              )}
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
                className="flex-1 rounded-full border border-stone-200 px-4 py-3 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
              />
              <button
                type="submit"
                disabled={!isConnected || !textInput.trim()}
                className="rounded-full bg-amber-500 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                发送
              </button>
            </form>
          </div>

          {/* Hints */}
          <div className="mt-2 text-center text-xs text-stone-500">
            {isConnected ? (
              isRecording ? (
                '正在录音... 再次点击或按空格停止'
              ) : (
                '可以直接说话、打字，或者先点一句场景句、再慢慢补充。'
              )
            ) : (
              '先连接助手，或者先点一条开口句开始'
            )}
          </div>
          {microphoneEnvironmentWarning ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {microphoneEnvironmentWarning}
            </div>
          ) : null}
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
          max-w-[80%] rounded-2xl px-4 py-3
          ${isUser
            ? 'bg-amber-500 text-white rounded-br-md'
            : 'rounded-bl-md border border-stone-200 bg-white text-stone-900 shadow-sm'
          }
        `}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className={`mt-1 text-xs ${isUser ? 'text-amber-200' : 'text-stone-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

/**
 * 双行字幕镜组件
 *
 * 只在“系统听到”和“AI 推测的意思”确实不同的时候显示，
 * 避免把相同内容硬拆成两行，造成误导。
 */
function DualLineSubtitleDisplay({ subtitle }: { subtitle: DualLineSubtitle }) {
  return (
    <div className="flex justify-center mb-4">
      <div className="w-full max-w-[90%] overflow-hidden rounded-xl border-2 border-amber-200 bg-amber-50 shadow-sm">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-amber-200 bg-white px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <EarIcon className="w-4 h-4" />
            <span>表达对照</span>
          </div>
          <div className="text-xs text-stone-500">仅在两者不同的时候显示</div>
        </div>

        {/* 内容区 */}
        <div className="p-4 space-y-3">
          {/* 第一行：机器听到的 */}
          <div className="flex items-start gap-2">
            <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <EarIcon className="w-3 h-3 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-xs text-stone-500">机器听到的</div>
              <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 font-medium text-stone-900">
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
            <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
              <BrainIcon className="w-3 h-3 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-xs text-stone-500">AI 理解的意图</div>
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 font-medium text-stone-900">
                {subtitle.correctedText}
              </div>
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        {subtitle.isCorrected && (
          <div className="border-t border-amber-200 bg-amber-100 px-4 py-2 text-xs text-stone-600">
            这表示系统第一次听到的内容和最终推测的意思不同。
          </div>
        )}
      </div>
    </div>
  )
}
