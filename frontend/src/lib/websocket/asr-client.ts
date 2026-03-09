import { WebSocketMessage } from '../types'
import { config } from '../config'

export class ASRClient {
  private ws: WebSocket | null = null
  private url: string

  constructor(url: string = config.api.agentWsUrl) {
    this.url = url
  }

  connect(
    onOpen: () => void,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Event) => void,
    onClose: () => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          onOpen()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            onMessage(message)
          } catch (error) {
            console.error('解析消息失败:', error)
          }
        }

        this.ws.onerror = (error) => {
          onError(error)
          reject(error)
        }

        this.ws.onclose = () => {
          onClose()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        this.ws.send(data)
      } else {
        this.ws.send(JSON.stringify(data))
      }
    }
  }

  sendAudio(audioData: ArrayBufferLike | Uint8Array) {
    const bytes = audioData instanceof Uint8Array
      ? audioData
      : audioData
        ? new Uint8Array(audioData)
        : new Uint8Array()

    const base64 = btoa(Array.from(bytes).map((byte) => String.fromCharCode(byte)).join(''))

    this.send({
      audio: base64,
      metadata: {
        sample_rate: 16000,
        channels: 1,
        format: 'pcm_s16le',
      },
    })
  }

  endAudioStream() {
    this.send({
      type: 'end_audio',
    })
  }

  close() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
