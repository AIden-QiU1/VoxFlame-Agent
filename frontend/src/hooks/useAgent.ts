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
  MemoryStoredMessage
} from '@/lib/websocket/agent-client'
import { AudioProcessor } from '@/lib/audio/audio-processor'
import { config } from '@/lib/config'
import { createClient, getValidToken } from '@/lib/supabase/client'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  audioPlaying?: boolean
}

export interface AgentState {
  isConnected: boolean
  isRecording: boolean
  isThinking: boolean
  isSpeaking: boolean
  sessionId: string | null
  currentASRText: string
  currentResponseText: string
  messages: ConversationMessage[]
  error: string | null
}

export interface UseAgentOptions {
  autoConnect?: boolean
  enableTTS?: boolean
  userId?: string
}

export function useAgent(options: UseAgentOptions = {}) {
  const { autoConnect = false, enableTTS = true, userId } = options

  const [state, setState] = useState<AgentState>({
    isConnected: false,
    isRecording: false,
    isThinking: false,
    isSpeaking: false,
    sessionId: null,
    currentASRText: '',
    currentResponseText: '',
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
  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }))

      // Get Auth Token (使用 getValidToken 自动处理刷新)
      const token = await getValidToken()
      const wsUrl = token ? `${config.api.agentWsUrl}?token=${token}` : config.api.agentWsUrl

      console.log('[useAgent] ========== 连接调试信息 ==========')
      console.log('[useAgent] WebSocket URL:', wsUrl.replace(/token=.+$/, 'token=***')) // 隐藏 token
      console.log('[useAgent] Has Auth Token:', !!token)
      console.log('[useAgent] =====================================')

      const client = new AgentClient(wsUrl)
      agentClientRef.current = client

      const callbacks: AgentClientCallbacks = {
        onOpen: () => {
          console.log('[useAgent] Connected successfully!')
          setState(prev => ({ ...prev, isConnected: true }))

          // Start session
          client.startSession({
            enableTTS,
            userId
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

        onError: (error) => {
          console.error('[useAgent] Error:', error)

          // 忽略 NO_VALID_AUDIO_ERROR - 用户没有说话时的正常情况
          const isNoValidAudioError =
            ('error' in error && error.error?.message?.includes?.('NO_VALID_AUDIO_ERROR')) ||
            ('message' in error && (error as any).message?.includes?.('NO_VALID_AUDIO_ERROR'))

          if (isNoValidAudioError) {
            console.log('[useAgent] Ignoring NO_VALID_AUDIO_ERROR (user not speaking)')
            return
          }

          const message = 'error' in error && error.error
            ? error.error.message
            : '连接错误'

          // 只显示真正的连接错误，忽略 ASR 超时等暂时性错误
          setState(prev => ({ ...prev, error: message }))
        },

        onClose: () => {
          console.log('[useAgent] Disconnected')
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
  }, [enableTTS, userId])

  // Disconnect
  const disconnect = useCallback(() => {
    if (agentClientRef.current) {
      agentClientRef.current.endSession()
      agentClientRef.current.close()
      agentClientRef.current = null
    }
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
  }, [])

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
