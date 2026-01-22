/**
 * Step-Audio Realtime API 客户端
 * 
 * 基于阶跃星辰 Step-Audio 2 端到端语音对话模型
 * 文档: https://platform.stepfun.com/docs/guide/realtime
 * 
 * 特点:
 * - 端到端语音对话，无需 ASR + LLM + TTS 拼接
 * - 低延迟实时交互
 * - 支持情感陪伴场景的多种音色
 */

export interface StepAudioConfig {
  apiKey: string
  model?: 'step-audio-2' | 'step-audio-2-mini' | 'step-audio-2-think' | 'step-audio-2-mini-think'
  voice?: string  // 音色，如 'wenrounansheng', 'qinqienvsheng' 等
  systemPrompt?: string
  wsUrl?: string  // WebSocket URL，默认走后端代理
}

export interface StepAudioEvents {
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: string) => void
  onUserTranscript?: (text: string, isFinal: boolean) => void
  onAITranscript?: (text: string, isFinal: boolean) => void
  onAIAudio?: (audioData: ArrayBuffer) => void
  onAISpeakingStart?: () => void
  onAISpeakingEnd?: () => void
}

// 用于情感陪伴场景的推荐音色
export const RECOMMENDED_VOICES = {
  // 温柔男声 - 适合陪伴和鼓励
  wenrounansheng: { name: '温柔男声', description: '今天过得怎么样？如果有什么心事，我很愿意倾听。' },
  // 温柔女声 - 适合情感支持
  wenrounvsheng: { name: '温柔女声', description: '我在这里陪着你，无论快乐还是忧伤，我们都一起面对。' },
  // 气质温婉 - 优雅亲切
  'elegantgentle-female': { name: '气质温婉', description: '你的坚强让我感动，但也要记得适时地让自己休息一下。' },
  // 邻家姐姐 - 亲切自然
  linjiajiejie: { name: '邻家姐姐', description: '说出来会好受一些，我永远是你忠实的听众和朋友。' },
  // 磁性男声 - 沉稳有力
  cixingnansheng: { name: '磁性男声', description: '每个人都会有感到迷茫的时候，这很正常，你并不孤单。' },
} as const

export class StepAudioClient {
  private ws: WebSocket | null = null
  private config: StepAudioConfig
  private events: StepAudioEvents
  private isConnected: boolean = false
  private audioContext: AudioContext | null = null
  private audioQueue: ArrayBuffer[] = []
  private isPlaying: boolean = false

  constructor(config: StepAudioConfig, events: StepAudioEvents = {}) {
    this.config = {
      model: 'step-audio-2-mini',
      voice: 'wenrounansheng',
      wsUrl: '/api/realtime/step-audio', // 默认走后端代理
      ...config
    }
    this.events = events
  }

  /**
   * 连接到 Step-Audio Realtime API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 构建 WebSocket URL
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsHost = window.location.host
        const wsUrl = this.config.wsUrl?.startsWith('ws') 
          ? this.config.wsUrl 
          : `${wsProtocol}//${wsHost}${this.config.wsUrl}`

        // 创建 WebSocket 连接
        this.ws = new WebSocket(wsUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('[StepAudio] WebSocket connected')
          this.isConnected = true
          
          // 发送初始化配置
          this.sendConfig()
          
          this.events.onConnected?.()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onerror = (error) => {
          console.error('[StepAudio] WebSocket error:', error)
          this.events.onError?.('WebSocket 连接错误')
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('[StepAudio] WebSocket closed')
          this.isConnected = false
          this.events.onDisconnected?.()
        }

        // 初始化 AudioContext 用于播放
        this.audioContext = new AudioContext({ sampleRate: 24000 })

      } catch (error) {
        console.error('[StepAudio] Connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * 发送配置到服务器
   */
  private sendConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const configMessage = {
      type: 'config',
      config: {
        model: this.config.model,
        voice: this.config.voice,
        apiKey: this.config.apiKey,
        systemPrompt: this.config.systemPrompt || this.getDefaultSystemPrompt()
      }
    }

    this.ws.send(JSON.stringify(configMessage))
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(): string {
    return `你是燃言的 AI 助手，一个温暖、有同理心的语音伙伴。

你的用户可能有语言障碍（构音障碍），说话可能不太清晰，但这不影响他们的智慧和情感。

你的角色是：
1. 耐心倾听，即使听不清也不要急躁
2. 用温暖、鼓励的语气回应
3. 帮助用户放松，愿意开口说话
4. 在合适的时机，温柔地引导用户参与语音数据收集

记住：每一个声音都很珍贵，你的任务是让用户感到被理解和尊重。

保持回复简短自然，像朋友聊天一样。`
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    // 二进制数据是音频
    if (event.data instanceof ArrayBuffer) {
      this.handleAudioData(event.data)
      return
    }

    // JSON 消息
    try {
      const message = JSON.parse(event.data)
      
      switch (message.type) {
        case 'user_transcript':
          this.events.onUserTranscript?.(message.text, message.is_final)
          break
          
        case 'ai_transcript':
          this.events.onAITranscript?.(message.text, message.is_final)
          break
          
        case 'ai_speaking_start':
          this.events.onAISpeakingStart?.()
          break
          
        case 'ai_speaking_end':
          this.events.onAISpeakingEnd?.()
          break
          
        case 'error':
          console.error('[StepAudio] Server error:', message.error)
          this.events.onError?.(message.error)
          break
          
        default:
          console.log('[StepAudio] Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('[StepAudio] Failed to parse message:', error)
    }
  }

  /**
   * 处理收到的音频数据
   */
  private handleAudioData(data: ArrayBuffer): void {
    this.events.onAIAudio?.(data)
    this.audioQueue.push(data)
    this.playNextAudio()
  }

  /**
   * 播放音频队列
   */
  private async playNextAudio(): Promise<void> {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) return

    this.isPlaying = true
    const audioData = this.audioQueue.shift()!

    try {
      // 解码音频数据（假设是 PCM 16-bit，24kHz）
      const audioBuffer = this.audioContext.createBuffer(1, audioData.byteLength / 2, 24000)
      const channelData = audioBuffer.getChannelData(0)
      const int16Array = new Int16Array(audioData)
      
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768
      }

      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      
      source.onended = () => {
        this.isPlaying = false
        this.playNextAudio()
      }
      
      source.start()
    } catch (error) {
      console.error('[StepAudio] Audio playback error:', error)
      this.isPlaying = false
      this.playNextAudio()
    }
  }

  /**
   * 发送用户音频数据
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[StepAudio] WebSocket not connected')
      return
    }

    this.ws.send(audioData)
  }

  /**
   * 发送文本消息（用于调试或文本输入）
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    this.ws.send(JSON.stringify({
      type: 'text',
      text: text
    }))
  }

  /**
   * 打断 AI 说话
   */
  interrupt(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    // 清空音频队列
    this.audioQueue = []
    
    this.ws.send(JSON.stringify({
      type: 'interrupt'
    }))
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.isConnected = false
    this.audioQueue = []
    this.isPlaying = false
  }

  /**
   * 检查连接状态
   */
  isOpen(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * 更新系统提示词
   */
  updateSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt
    if (this.isConnected) {
      this.sendConfig()
    }
  }

  /**
   * 更新音色
   */
  updateVoice(voice: string): void {
    this.config.voice = voice
    if (this.isConnected) {
      this.sendConfig()
    }
  }
}

export default StepAudioClient
