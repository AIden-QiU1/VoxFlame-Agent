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
  private audioMetadataQueue: Array<{ data: ArrayBuffer; metadata?: { sample_rate?: number } }> = []
  private isProcessingAudio: boolean = false
  private audioContext: AudioContext | null = null
  private audioQueue: AudioBuffer[] = []
  private isPlaying: boolean = false

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

        this.ws.onclose = (event) => {
          console.log('[AgentClient] Connection closed', event.code, event.reason)
          this.callbacks.onClose?.()
          
          // Auto-reconnect if not a clean close
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('[AgentClient] Attempting auto-reconnect...')
            this.reconnect(callbacks).catch(err => {
              console.error('[AgentClient] Auto-reconnect failed:', err)
            })
          }
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
  /**
   * 处理接收到的消息
   * 支持 TEN Framework websocket_server 的消息格式
   */
  private handleMessage(event: MessageEvent) {
    // Binary message (audio response)
    if (event.data instanceof ArrayBuffer) {
      this.handleAudioResponse(event.data)
      return
    }

    // Text message (JSON)
    try {
      const message = JSON.parse(event.data)
      console.log('[AgentClient] Received:', message.type, message)

      // TEN Framework 消息格式处理
      switch (message.type) {
        // TEN Framework: data 消息（包含 ASR 结果、LLM 响应等）
        case 'data':
          this.handleTenDataMessage(message)
          break

        // TEN Framework: audio 消息（TTS 音频）
        case 'audio':
          console.log('[AgentClient] *** AUDIO MESSAGE RECEIVED ***')
          console.log('[AgentClient] audio field exists:', !!message.audio)
          console.log('[AgentClient] audio length:', message.audio?.length)
          console.log('[AgentClient] metadata:', JSON.stringify(message.metadata))
          if (message.audio) {
            // Decode base64 audio
            const binaryString = atob(message.audio)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            console.log('[AgentClient] Decoded bytes:', bytes.length)
            this.handleAudioResponse(bytes.buffer, message.metadata)
          } else {
            console.error('[AgentClient] Audio message missing audio field!')
          }
          break

        // TEN Framework: cmd 消息
        case 'cmd':
          console.log('[AgentClient] TEN command:', message.name, message.data)
          break

        // TEN Framework: error 消息
        case 'error':
          // 忽略 "Missing audio field" 错误，这是 TEN Agent 的正常行为
          if (message.error?.includes?.('Missing') && message.error?.includes?.('audio')) {
            console.log('[AgentClient] Ignoring audio field warning')
            break
          }
          // 忽略 NO_VALID_AUDIO_ERROR，这是用户没有说话时的正常情况
          if (message.error?.includes?.('NO_VALID_AUDIO_ERROR') ||
              message.error?.message?.includes?.('NO_VALID_AUDIO_ERROR')) {
            console.log('[AgentClient] Ignoring NO_VALID_AUDIO_ERROR (user not speaking)')
            break
          }
          console.error('[AgentClient] TEN error:', message.error)
          this.callbacks.onError?.({ type: 'error', error: { message: message.error, code: 'TEN_ERROR' } } as ErrorMessage)
          break

        // 原有消息格式（向后兼容）
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

        default:
          console.log('[AgentClient] Unknown message type:', message.type, message)
      }
    } catch (error) {
      console.error('[AgentClient] Failed to parse message:', error)
    }
  }

  /**
   * 处理 TEN Framework data 消息
   */
  private handleTenDataMessage(message: any) {
    const { name, data } = message

    switch (name) {
      case 'text_data':
        this.handleTextData(data)
        break

      case 'interim_text':
        this.handleInterimText(data)
        break

      case 'corrected_text':
        this.handleCorrectedText(data)
        break

      case 'transcript':
        this.handleTranscript(data)
        break

      default:
        console.log('[AgentClient] Unknown TEN data name:', name, data)
    }
  }

  private handleTextData(data: any) {
    if (!data?.text) return

    // ASR 结果或 LLM 响应
    if (data.is_final !== undefined) {
      this.callbacks.onASRResult?.({
        type: 'asr_result',
        text: data.text,
        is_final: data.is_final
      } as ASRResultMessage)
      return
    }

    this.callbacks.onResponseText?.({
      type: 'response_text',
      delta: data.text,
      is_final: true,
      full_text: data.text
    } as ResponseTextMessage)
  }

  private handleInterimText(data: any) {
    if (!data?.text) return

    this.callbacks.onASRResult?.({
      type: 'asr_result',
      text: data.text,
      is_final: false
    } as ASRResultMessage)
  }

  private handleCorrectedText(data: any) {
    const correctedText = data?.corrected_text || data?.text
    if (!correctedText) return

    this.callbacks.onResponseText?.({
      type: 'response_text',
      delta: correctedText,
      is_final: true,
      full_text: correctedText
    } as ResponseTextMessage)
  }

  private handleTranscript(data: any) {
    if (!data?.text) return

    if (data.role === 'user') {
      this.callbacks.onASRResult?.({
        type: 'asr_result',
        text: data.text,
        is_final: data.is_final !== false
      } as ASRResultMessage)
      return
    }

    this.callbacks.onResponseText?.({
      type: 'response_text',
      delta: data.text,
      is_final: data.is_final !== false,
      full_text: data.text
    } as ResponseTextMessage)
  }

  /**
   * Initialize AudioContext (must be called after user gesture)
   */
  async initAudio(): Promise<void> {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        console.log('[AgentClient] AudioContext initialized:', this.audioContext.sampleRate)
      } catch (e) {
        console.error('[AgentClient] Failed to initialize AudioContext:', e)
      }
    }

    // Resume if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        console.log('[AgentClient] AudioContext resumed')
      } catch (e) {
        console.error('[AgentClient] Failed to resume AudioContext:', e)
      }
    }
  }

  /**
   * 处理音频响应
   */
  private async handleAudioResponse(audioData: ArrayBuffer, metadata?: { sample_rate?: number }) {
    console.log('[AgentClient] handleAudioResponse called')
    console.log('[AgentClient] Audio bytes:', audioData.byteLength)
    console.log('[AgentClient] Sample rate from metadata:', metadata?.sample_rate)
    console.log('[AgentClient] AudioContext state:', this.audioContext?.state)

    // Queue audio for playback
    this.audioMetadataQueue.push({ data: audioData, metadata })
    await this.processAudioQueue()
  }

  /**
   * 处理音频播放队列
   */
  private async processAudioQueue() {
    if (this.isProcessingAudio || this.audioMetadataQueue.length === 0) return

    this.isProcessingAudio = true

    // Initialize AudioContext if needed (must be done after user gesture)
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        console.log('[AgentClient] AudioContext created:', this.audioContext.sampleRate)
      } catch (e) {
        console.error('[AgentClient] Failed to create AudioContext:', e)
        this.isProcessingAudio = false
        return
      }
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        console.log('[AgentClient] AudioContext resumed')
      } catch (e) {
        console.error('[AgentClient] Failed to resume AudioContext:', e)
      }
    }

    while (this.audioMetadataQueue.length > 0) {
      const queued = this.audioMetadataQueue.shift()!
      await this.playAudio(queued.data, queued.metadata)
    }

    this.isProcessingAudio = false
  }

  /**
   * 播放音频
   */
  private async playAudio(
    audioData: ArrayBuffer,
    metadata?: { sample_rate?: number }
  ): Promise<void> {
    if (!this.audioContext) {
      console.warn('[AgentClient] AudioContext not initialized')
      return
    }

    const ctx = this.audioContext // 保存引用避免 null 检查问题

    return new Promise((resolve) => {
      try {
        const sampleRate = metadata?.sample_rate || 16000

        console.log('[AgentClient] Playing audio:', audioData.byteLength, 'bytes at', sampleRate, 'Hz')

        // Convert PCM to AudioBuffer
        const pcmData = new Int16Array(audioData)
        const floatData = new Float32Array(pcmData.length)

        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0
        }

        const audioBuffer = ctx.createBuffer(1, floatData.length, sampleRate)
        audioBuffer.getChannelData(0).set(floatData)

        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        source.onended = () => {
          console.log('[AgentClient] Audio chunk finished')
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
  /**
   * 开始会话
   * TEN Framework 通过 property.json 配置，连接即启动
   * 保留此方法以兼容原有接口
   */
  startSession(options: {
    agentType?: string
    enableTTS?: boolean
    ttsVoice?: string
    userId?: string
  } = {}) {
    // TEN Framework 不需要显式启动会话
    // 连接成功后自动开始处理
    console.log('[AgentClient] Session auto-started with TEN Framework')
    
    // 模拟会话启动回调
    this.sessionId = `ten_${Date.now()}`
    this.callbacks.onSessionStarted?.({
      type: 'session_started',
      session_id: this.sessionId
    } as SessionStartedMessage)
  }

  /**
   * 发送音频数据 (PCM 16kHz)
   */
  /**
   * 发送音频数据 (PCM 16kHz)
   * TEN Framework websocket_server 期望 base64 编码的 JSON 格式
   */
  sendAudio(audioData: ArrayBuffer | Uint8Array) {
    if (!this.ws) {
      console.warn('[AgentClient] sendAudio: WebSocket is null')
      return
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[AgentClient] sendAudio: WebSocket not ready, state=', this.ws.readyState)
      return
    }

    // Convert ArrayBuffer/Uint8Array to base64
    const bytes = audioData instanceof ArrayBuffer
      ? new Uint8Array(audioData)
      : audioData
    const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''))

    // Send as JSON with audio field
    const message = JSON.stringify({
      audio: base64,
      metadata: {
        sample_rate: 16000,
        channels: 1,
        format: 'pcm_s16le'
      }
    })

    this.ws.send(message)
    console.log(`[AgentClient] Sent audio: ${bytes.length} bytes (${message.length} chars base64)`)
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
    // Clean up AudioContext
    if (this.audioContext) {
      this.audioContext.close().catch(e => console.error('[AgentClient] Error closing AudioContext:', e))
      this.audioContext = null
    }
    this.sessionId = null
  }

  /**
   * Disconnect from the WebSocket server
   * Alias for close() method
   */
  disconnect() {
    console.log('[AgentClient] Disconnecting...')
    this.close()
  }

  /**
   * Reconnect to the WebSocket server with exponential backoff
   */
  async reconnect(callbacks: AgentClientCallbacks): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[AgentClient] Max reconnect attempts reached')
      throw new Error('Max reconnect attempts reached')
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    
    console.log(`[AgentClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    try {
      await this.connect(callbacks)
      console.log('[AgentClient] Reconnected successfully')
    } catch (error) {
      console.error('[AgentClient] Reconnect failed:', error)
      throw error
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): number | null {
    return this.ws?.readyState || null
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
