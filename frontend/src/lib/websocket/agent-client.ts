/**
 * VoxFlame Agent WebSocket Client
 * Phase 8: Frontend WebSocket Integration
 * 
 * 功能：
 * 1. 与 TEN Framework Agent 建立 WebSocket 连接
 * 2. 实时音频流传输（PCM 16kHz）
 * 3. 接收 ASR、LLM、TTS 响应
 */

import { config } from '../config'

// 消息类型定义
export interface AgentMessage {
  type: string
  [key: string]: any
}

export interface SessionStartedMessage {
  type: 'session_started'
  session_id: string
  greeting?: {
    text: string
    audio?: string  // Base64 encoded
  }
}

export interface ASRResultMessage {
  type: 'asr_result'
  text: string
  confidence: number
  is_final: boolean
}

export interface ResponseTextMessage {
  type: 'response_text'
  delta: string
  is_final: boolean
  full_text?: string
}

export interface ResponseAudioMessage {
  type: 'response_audio'
  audio: string  // Base64 encoded PCM
  is_chunk: boolean
  sample_rate?: number
}

export interface ThinkingMessage {
  type: 'thinking'
  message: string
}

export interface ErrorMessage {
  type: 'error'
  error: {
    code: string
    message: string
  }
}

export interface MemoryStoredMessage {
  type: 'memory_stored'
  memory_id: string
  content: string
}

// 事件回调类型
export interface AgentClientCallbacks {
  onSessionStarted?: (data: SessionStartedMessage) => void
  onASRResult?: (data: ASRResultMessage) => void
  onResponseText?: (data: ResponseTextMessage) => void
  onResponseAudio?: (data: ResponseAudioMessage) => void
  onThinking?: (data: ThinkingMessage) => void
  onMemoryStored?: (data: MemoryStoredMessage) => void
  onError?: (error: ErrorMessage | Event) => void
  onClose?: () => void
  onOpen?: () => void
}

export class AgentClient {
  private ws: WebSocket | null = null
  private url: string
  private callbacks: AgentClientCallbacks = {}
  private sessionId: string | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 3
  private audioQueue: ArrayBuffer[] = []
  private isProcessingAudio: boolean = false

  constructor(url?: string) {
    this.url = url || config.api.agentWsUrl || 'ws://localhost:8080/ws/agent'
  }

  /**
   * 连接到 Agent WebSocket
   */
  async connect(callbacks: AgentClientCallbacks): Promise<void> {
    this.callbacks = callbacks

    return new Promise((resolve, reject) => {
      try {
        console.log('[AgentClient] Connecting to:', this.url)
        this.ws = new WebSocket(this.url)

        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('[AgentClient] Connected')
          this.reconnectAttempts = 0
          this.callbacks.onOpen?.()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onerror = (error) => {
          console.error('[AgentClient] WebSocket error:', error)
          this.callbacks.onError?.(error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('[AgentClient] Connection closed')
          this.callbacks.onClose?.()
        }
      } catch (error) {
        console.error('[AgentClient] Connection failed:', error)
        reject(error)
      }
    })
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent) {
    // Binary message (audio response)
    if (event.data instanceof ArrayBuffer) {
      this.handleAudioResponse(event.data)
      return
    }

    // Text message (JSON)
    try {
      const message: AgentMessage = JSON.parse(event.data)
      console.log('[AgentClient] Received:', message.type)

      switch (message.type) {
        case 'session_started':
          this.sessionId = message.session_id
          this.callbacks.onSessionStarted?.(message as SessionStartedMessage)
          break

        case 'asr_result':
          this.callbacks.onASRResult?.(message as ASRResultMessage)
          break

        case 'response_text':
          this.callbacks.onResponseText?.(message as ResponseTextMessage)
          break

        case 'response_audio':
          this.callbacks.onResponseAudio?.(message as ResponseAudioMessage)
          break

        case 'thinking':
          this.callbacks.onThinking?.(message as ThinkingMessage)
          break

        case 'memory_stored':
          this.callbacks.onMemoryStored?.(message as MemoryStoredMessage)
          break

        case 'error':
          this.callbacks.onError?.(message as ErrorMessage)
          break

        default:
          console.log('[AgentClient] Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('[AgentClient] Failed to parse message:', error)
    }
  }

  /**
   * 处理音频响应
   */
  private handleAudioResponse(audioData: ArrayBuffer) {
    // Queue audio for playback
    this.audioQueue.push(audioData)
    this.processAudioQueue()
  }

  /**
   * 处理音频播放队列
   */
  private async processAudioQueue() {
    if (this.isProcessingAudio || this.audioQueue.length === 0) return

    this.isProcessingAudio = true

    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift()!
      await this.playAudio(audioData)
    }

    this.isProcessingAudio = false
  }

  /**
   * 播放音频
   */
  private async playAudio(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // Convert PCM to AudioBuffer
        const pcmData = new Int16Array(audioData)
        const floatData = new Float32Array(pcmData.length)
        
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0
        }
        
        const audioBuffer = audioContext.createBuffer(1, floatData.length, 22050) // TTS sample rate
        audioBuffer.getChannelData(0).set(floatData)
        
        const source = audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(audioContext.destination)
        source.onended = () => {
          audioContext.close()
          resolve()
        }
        source.start()
      } catch (error) {
        console.error('[AgentClient] Audio playback error:', error)
        resolve()
      }
    })
  }

  /**
   * 开始会话
   */
  startSession(options: {
    agentType?: string
    enableTTS?: boolean
    ttsVoice?: string
    userId?: string
  } = {}) {
    this.send({
      type: 'start_session',
      agent_type: options.agentType || 'voice_assistant',
      options: {
        enable_tts: options.enableTTS ?? true,
        tts_voice: options.ttsVoice || 'longanyang',  // DashScope voice
        user_id: options.userId
      }
    })
  }

  /**
   * 发送音频数据 (PCM 16kHz)
   */
  sendAudio(audioData: ArrayBuffer | Uint8Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData)
    }
  }

  /**
   * 发送文本输入
   */
  sendText(text: string) {
    this.send({
      type: 'user_input',
      input_type: 'text',
      text
    })
  }

  /**
   * 结束当前语音输入
   */
  endAudioStream() {
    this.send({
      type: 'end_audio'
    })
  }

  /**
   * 结束会话
   */
  endSession(summary?: string) {
    this.send({
      type: 'end_session',
      summary
    })
    this.sessionId = null
  }

  /**
   * 发送 JSON 消息
   */
  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('[AgentClient] WebSocket not connected')
    }
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.sessionId = null
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }
}

export default AgentClient
