'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { StepAudioClient, StepAudioConfig, RECOMMENDED_VOICES } from '@/lib/realtime-audio/step-audio-client'

export interface UseStepAudioOptions {
  apiKey?: string
  voice?: string
  systemPrompt?: string
  onReady?: () => void
  onError?: (error: string) => void
}

export interface UseStepAudioReturn {
  // 状态
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  userTranscript: string
  aiTranscript: string
  
  // 方法
  connect: () => Promise<void>
  disconnect: () => void
  startListening: () => Promise<void>
  stopListening: () => void
  interrupt: () => void
  sendText: (text: string) => void
  updateVoice: (voice: string) => void
  updateSystemPrompt: (prompt: string) => void
  
  // 配置
  availableVoices: typeof RECOMMENDED_VOICES
}

/**
 * Step-Audio 实时语音对话 Hook
 * 
 * 用法:
 * ```tsx
 * const { isConnected, userTranscript, aiTranscript, connect, startListening } = useStepAudio({
 *   apiKey: process.env.NEXT_PUBLIC_STEP_API_KEY,
 *   voice: 'wenrounansheng'
 * })
 * ```
 */
export function useStepAudio(options: UseStepAudioOptions = {}): UseStepAudioReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userTranscript, setUserTranscript] = useState('')
  const [aiTranscript, setAiTranscript] = useState('')
  
  const clientRef = useRef<StepAudioClient | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  // 初始化客户端
  const initClient = useCallback(() => {
    if (clientRef.current) return

    const config: StepAudioConfig = {
      apiKey: options.apiKey || '',
      voice: options.voice || 'wenrounansheng',
      systemPrompt: options.systemPrompt
    }

    clientRef.current = new StepAudioClient(config, {
      onConnected: () => {
        setIsConnected(true)
        options.onReady?.()
      },
      onDisconnected: () => {
        setIsConnected(false)
        setIsListening(false)
        setIsSpeaking(false)
      },
      onError: (error) => {
        console.error('[useStepAudio] Error:', error)
        options.onError?.(error)
      },
      onUserTranscript: (text, isFinal) => {
        setUserTranscript(text)
      },
      onAITranscript: (text, isFinal) => {
        setAiTranscript(prev => isFinal ? text : prev + text)
      },
      onAISpeakingStart: () => {
        setIsSpeaking(true)
      },
      onAISpeakingEnd: () => {
        setIsSpeaking(false)
      }
    })
  }, [options])

  // 连接
  const connect = useCallback(async () => {
    initClient()
    if (!clientRef.current) {
      throw new Error('Client not initialized')
    }
    await clientRef.current.connect()
  }, [initClient])

  // 断开连接
  const disconnect = useCallback(() => {
    stopListening()
    clientRef.current?.disconnect()
    clientRef.current = null
  }, [])

  // 开始监听麦克风
  const startListening = useCallback(async () => {
    if (!clientRef.current?.isOpen()) {
      console.warn('[useStepAudio] Not connected')
      return
    }

    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      mediaStreamRef.current = stream

      // 创建 AudioContext
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })
      const source = audioContextRef.current.createMediaStreamSource(stream)

      // 创建处理器节点
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!clientRef.current?.isOpen()) return

        const inputData = e.inputBuffer.getChannelData(0)
        
        // 转换为 16-bit PCM
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        clientRef.current.sendAudio(pcmData.buffer)
      }

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

      setIsListening(true)
      setUserTranscript('')
      setAiTranscript('')

    } catch (error) {
      console.error('[useStepAudio] Failed to start listening:', error)
      options.onError?.('无法获取麦克风权限')
    }
  }, [options])

  // 停止监听
  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    setIsListening(false)
  }, [])

  // 打断 AI
  const interrupt = useCallback(() => {
    clientRef.current?.interrupt()
  }, [])

  // 发送文本
  const sendText = useCallback((text: string) => {
    clientRef.current?.sendText(text)
  }, [])

  // 更新音色
  const updateVoice = useCallback((voice: string) => {
    clientRef.current?.updateVoice(voice)
  }, [])

  // 更新系统提示词
  const updateSystemPrompt = useCallback((prompt: string) => {
    clientRef.current?.updateSystemPrompt(prompt)
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      stopListening()
      clientRef.current?.disconnect()
    }
  }, [stopListening])

  return {
    isConnected,
    isListening,
    isSpeaking,
    userTranscript,
    aiTranscript,
    connect,
    disconnect,
    startListening,
    stopListening,
    interrupt,
    sendText,
    updateVoice,
    updateSystemPrompt,
    availableVoices: RECOMMENDED_VOICES
  }
}

export default useStepAudio
