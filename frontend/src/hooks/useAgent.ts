/**
 * useAgent Hook
 * Phase 8: Frontend WebSocket Integration
 * 
 * React Hook for managing VoxFlame Agent connection
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  AgentClient,
  AgentClientCallbacks,
  ASRResultMessage,
  ResponseTextMessage,
  ResponseAudioMessage,
  ThinkingMessage,
  MemoryStoredMessage,
  DualLineSubtitleMessage
} from '@/lib/websocket/agent-client'
import { AudioProcessor } from '@/lib/audio/audio-processor'
import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import { memoryService } from '@/lib/memory/memory-service'
import { getAnonymousUserId } from '@/lib/identity/anonymous-user'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  audioPlaying?: boolean
}

/**
 * 双行字幕镜数据
 * 显示用户语音的原始识别结果 vs LLM 纠正后的结果
 */
export interface DualLineSubtitle {
  originalText: string      // ASR 原始识别结果
  correctedText: string     // LLM 纠正后的结果
  isCorrected: boolean      // 是否进行了纠正
  clarityScore: number      // 清晰度评分 (0-100)
  timestamp: Date
}

export interface AgentState {
  isConnected: boolean
  isRecording: boolean
  isThinking: boolean
  isSpeaking: boolean
  sessionId: string | null
  currentASRText: string
  currentResponseText: string
  currentDualLine: DualLineSubtitle | null  // 双行字幕镜数据
  messages: ConversationMessage[]
  error: string | null
}

export interface UseAgentOptions {
  autoConnect?: boolean
  enableTTS?: boolean
  userId?: string
}

export interface AgentConnectOptions {
  suppressGreeting?: boolean
}

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  if ('error' in error) {
    const nested = (error as { error?: { message?: string } }).error
    if (nested?.message) {
      return nested.message
    }
  }

  if ('message' in error) {
    const message = (error as { message?: string }).message
    return typeof message === 'string' ? message : null
  }

  return null
}

export function useAgent(options: UseAgentOptions = {}) {
  const { autoConnect = false, enableTTS = true, userId } = options
  const [anonymousUserId, setAnonymousUserId] = useState<string | null>(null)
  const memoryOwnerId = userId || anonymousUserId

  useEffect(() => {
    setAnonymousUserId(getAnonymousUserId())
  }, [])

  useEffect(() => {
    if (memoryOwnerId) {
      memoryService.init(memoryOwnerId)
      console.log('[useAgent] Memory service initialized for owner:', memoryOwnerId)
    }
  }, [memoryOwnerId])

  const [state, setState] = useState<AgentState>({
    isConnected: false,
    isRecording: false,
    isThinking: false,
    isSpeaking: false,
    sessionId: null,
    currentASRText: '',
    currentResponseText: '',
    currentDualLine: null,
    messages: [],
    error: null,
  })

  const agentClientRef = useRef<AgentClient | null>(null)
  const audioProcessorRef = useRef<AudioProcessor | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // Initialize AudioProcessor
  useEffect(() => {
    audioProcessorRef.current = new AudioProcessor()
    return () => {
      audioProcessorRef.current?.stop()
      agentClientRef.current?.close()
    }
  }, [])

  // Connect to Agent
  const connect = useCallback(async (options: AgentConnectOptions = {}) => {
    try {
      setState(prev => ({ ...prev, error: null }))

      // Get Auth Token (使用 getValidToken 自动处理刷新)
      const token = await getValidToken()
      const wsUrl = new URL(
        config.api.agentWsUrl,
        typeof window !== 'undefined' ? window.location.href : 'http://localhost',
      )
      if (token) {
        wsUrl.searchParams.set('token', token)
      } else if (anonymousUserId) {
        wsUrl.searchParams.set('anon_id', anonymousUserId)
      }
      if (options.suppressGreeting) {
        wsUrl.searchParams.set('suppress_greeting', '1')
      }

      console.log('[useAgent] ========== 连接调试信息 ==========')
      console.log(
        '[useAgent] WebSocket URL:',
        wsUrl.toString().replace(/token=.+?(?=&|$)/, 'token=***'),
      )
      console.log('[useAgent] Has Auth Token:', !!token)
      console.log('[useAgent] Suppress Greeting:', !!options.suppressGreeting)
      console.log('[useAgent] =====================================')

      const client = new AgentClient(wsUrl.toString())
      agentClientRef.current = client

      const callbacks: AgentClientCallbacks = {
        onOpen: () => {
          console.log('[useAgent] Connected successfully!')
          if (memoryOwnerId) {
            memoryService.updateCurrentSessionMetadata({
              kind: 'communication',
              source: 'agent_chat',
            })
          }
          setState(prev => ({ ...prev, isConnected: true }))

          // Start session
          client.startSession({
            enableTTS,
            userId: memoryOwnerId || undefined,
          })
        },

        onSessionStarted: async (data) => {
          console.log('[useAgent] Session started:', data.session_id)
          // Initialize AudioContext for TTS playback (after user gesture)
          await client.initAudio()
          setState(prev => ({
            ...prev,
            sessionId: data.session_id,
            messages: data.greeting ? [
              ...prev.messages,
              {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: data.greeting.text,
                timestamp: new Date()
              }
            ] : prev.messages
          }))
        },

        onASRResult: (data: ASRResultMessage) => {
          console.log('[useAgent] ASR result:', data.text, 'is_final:', data.is_final)

          // Record to memory when final
          if (data.is_final && memoryOwnerId) {
            memoryService.addTurn('user', data.text)
          }

          setState(prev => ({
            ...prev,
            currentASRText: data.text,
            messages: data.is_final ? [
              ...prev.messages,
              {
                id: `msg_${Date.now()}`,
                role: 'user',
                content: data.text,
                timestamp: new Date()
              }
            ] : prev.messages
          }))
        },

        onThinking: (data: ThinkingMessage) => {
          setState(prev => ({
            ...prev,
            isThinking: true,
            currentResponseText: data.message
          }))
        },

        onResponseText: (data: ResponseTextMessage) => {
          console.log('[useAgent] Response text:', data.delta, 'is_final:', data.is_final)
          setState(prev => {
            const newState = {
              ...prev,
              isThinking: false,
              currentResponseText: prev.currentResponseText + data.delta
            }

            if (data.is_final && data.full_text) {
              // Record to memory
              if (memoryOwnerId) {
                memoryService.addTurn('assistant', data.full_text)
              }

              newState.messages = [
                ...prev.messages,
                {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content: data.full_text,
                  timestamp: new Date()
                }
              ]
              newState.currentResponseText = ''
            }

            return newState
          })
        },

        onResponseAudio: (data: ResponseAudioMessage) => {
          setState(prev => ({ ...prev, isSpeaking: true }))
          // Audio playback is handled by AgentClient
        },

        onMemoryStored: (data: MemoryStoredMessage) => {
          console.log('[useAgent] Memory stored:', data.memory_id)
        },

        onDualLineSubtitle: (data: DualLineSubtitleMessage) => {
          console.log('[useAgent] Dual line subtitle:', data)
          setState(prev => ({
            ...prev,
            currentDualLine: {
              originalText: data.original_text,
              correctedText: data.corrected_text,
              isCorrected: data.is_corrected,
              clarityScore: data.clarity_score,
              timestamp: new Date()
            }
          }))
        },

        onError: (error) => {
          console.error('[useAgent] Error:', error)

          // 忽略 NO_VALID_AUDIO_ERROR - 用户没有说话时的正常情况
          const isNoValidAudioError =
            ('error' in error && error.error?.message?.includes?.('NO_VALID_AUDIO_ERROR')) ||
            ('message' in error && typeof error.message === 'string' && error.message.includes('NO_VALID_AUDIO_ERROR'))

          if (isNoValidAudioError) {
            console.log('[useAgent] Ignoring NO_VALID_AUDIO_ERROR (user not speaking)')
            return
          }

          const message = getErrorMessage(error) || '连接错误'

          // 只显示真正的连接错误，忽略 ASR 超时等暂时性错误
          setState(prev => ({ ...prev, error: message }))
        },

        onClose: () => {
          console.log('[useAgent] Disconnected')
          void memoryService.endSession()
          setState(prev => ({
            ...prev,
            isConnected: false,
            isRecording: false,
            sessionId: null
          }))
        }
      }

      console.log('[useAgent] Calling client.connect()...')
      await client.connect(callbacks)
      console.log('[useAgent] client.connect() returned successfully')
    } catch (error) {
      console.error('[useAgent] Connection failed:', error)
      setState(prev => ({ ...prev, error: '连接失败: ' + (error instanceof Error ? error.message : String(error)) }))
    }
  }, [anonymousUserId, enableTTS, memoryOwnerId, userId])

  // Disconnect
  const disconnect = useCallback(() => {
    if (agentClientRef.current) {
      agentClientRef.current.endSession()
      agentClientRef.current.close()
      agentClientRef.current = null
    }
    void memoryService.endSession()
    setState(prev => ({
      ...prev,
      isConnected: false,
      isRecording: false,
      sessionId: null
    }))
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    console.log('[useAgent] ========== startRecording called ==========')
    console.log('[useAgent] AgentClient connected:', agentClientRef.current?.isConnected())

    if (!agentClientRef.current?.isConnected()) {
      console.error('[useAgent] Not connected to agent!')
      setState(prev => ({ ...prev, error: '未连接到服务器' }))
      return
    }

    try {
      console.log('[useAgent] Clearing previous ASR text and error')
      setState(prev => ({ ...prev, currentASRText: '', error: null }))

      // Initialize AudioContext for TTS playback (must be after user gesture)
      console.log('[useAgent] Initializing AudioContext for TTS...')
      await agentClientRef.current.initAudio()
      console.log('[useAgent] AudioContext initialized')

      if (audioProcessorRef.current) {
        console.log('[useAgent] Starting AudioProcessor...')
        const analyser = await audioProcessorRef.current.start(
          (data) => {
            // Audio callback - called repeatedly with audio chunks
            console.log('[useAgent] Audio chunk received:', data.byteLength, 'bytes')
            if (agentClientRef.current?.isConnected()) {
              // Convert ArrayBufferLike to ArrayBuffer
              agentClientRef.current.sendAudio(data as ArrayBuffer)
            } else {
              console.warn('[useAgent] Agent not connected, dropping audio chunk')
            }
          },
          true // enable recording
        )
        analyserRef.current = analyser
        console.log('[useAgent] AudioProcessor started successfully')
      } else {
        console.error('[useAgent] AudioProcessor is null!')
      }

      console.log('[useAgent] Setting isRecording = true')
      setState(prev => ({ ...prev, isRecording: true }))
      console.log('[useAgent] ========== Recording started ==========')
    } catch (error) {
      console.error('[useAgent] Start recording failed:', error)
      setState(prev => ({ ...prev, error: '启动录音失败: ' + (error instanceof Error ? error.message : String(error)) }))
    }
  }, [])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop()
    }

    if (agentClientRef.current?.isConnected()) {
      agentClientRef.current.endAudioStream()
    }

    analyserRef.current = null
    setState(prev => ({ ...prev, isRecording: false }))
  }, [])

  // Toggle recording
  const toggleRecording = useCallback(() => {
    console.log('[useAgent] ========== toggleRecording called ==========')
    console.log('[useAgent] Current isRecording:', state.isRecording)
    if (state.isRecording) {
      console.log('[useAgent] Stopping recording...')
      stopRecording()
    } else {
      console.log('[useAgent] Starting recording...')
      startRecording()
    }
  }, [state.isRecording, startRecording, stopRecording])

  // Send text message
  const sendText = useCallback((text: string) => {
    if (!agentClientRef.current?.isConnected()) {
      setState(prev => ({ ...prev, error: '未连接到服务器' }))
      return
    }

    if (memoryOwnerId) {
      memoryService.addTurn('user', text)
    }

    // Add user message to conversation
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: new Date()
        }
      ]
    }))

    agentClientRef.current.sendText(text)
  }, [memoryOwnerId])

  // Clear messages
  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }))
  }, [])

  // Auto connect
  useEffect(() => {
    if (autoConnect) {
      console.log('[useAgent] Auto-connecting...')
      connect()
    }
  }, [autoConnect, connect])

  return {
    ...state,
    analyser: analyserRef.current,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    toggleRecording,
    sendText,
    clearMessages
  }
}

export default useAgent
