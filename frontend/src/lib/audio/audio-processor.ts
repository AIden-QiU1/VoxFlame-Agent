import { config } from '../config'

/**
 * 检查浏览器是否支持 getUserMedia
 */
function checkMediaDevicesSupport(): boolean {
  if (typeof window === 'undefined') {
    throw new Error('getUserMedia 只能在浏览器环境中使用')
  }
  if (!navigator.mediaDevices) {
    throw new Error('当前浏览器不支持 mediaDevices API，请确保使用 HTTPS 或 localhost 访问')
  }
  return true
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private stream: MediaStream | null = null

  // 录音收集相关
  private recordedChunks: Int16Array[] = []
  private isCollecting: boolean = false
  private recordingStartTime: number = 0
  private _logCounter: number = 0

  // 将 Float32Array 转换为 PCM 16bit
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return output
  }

  // 重采样到 16000Hz
  private resample(
    audioBuffer: Float32Array,
    originalSampleRate: number,
    targetSampleRate: number = config.audio.sampleRate
  ): Float32Array {
    if (originalSampleRate === targetSampleRate) {
      return audioBuffer
    }

    const ratio = originalSampleRate / targetSampleRate
    const newLength = Math.round(audioBuffer.length / ratio)
    const result = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio
      const index = Math.floor(sourceIndex)
      const fraction = sourceIndex - index

      if (index + 1 < audioBuffer.length) {
        result[i] = audioBuffer[index] * (1 - fraction) + audioBuffer[index + 1] * fraction
      } else {
        result[i] = audioBuffer[index]
      }
    }

    return result
  }

  /**
   * 启动音频处理
   * @param onAudioProcess 实时音频回调（用于流式ASR）
   * @param collectAudio 是否同时收集完整录音（用于数据存储）
   */
  async start(
    onAudioProcess: (data: ArrayBufferLike) => void,
    collectAudio: boolean = false
  ): Promise<AnalyserNode> {
    // 检查浏览器环境和支持
    checkMediaDevicesSupport()

    // 初始化录音收集
    this.recordedChunks = []
    this.isCollecting = collectAudio
    this.recordingStartTime = Date.now()

    // 获取麦克风权限
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: config.audio.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    // 创建 AudioContext
    this.audioContext = new AudioContext({ sampleRate: config.audio.sampleRate })

    this.source = this.audioContext.createMediaStreamSource(this.stream)

    // 创建分析器用于可视化
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.source.connect(this.analyser)

    // 创建 ScriptProcessorNode 处理音频
    const bufferSize = config.audio.bufferSize
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      if (this.audioContext) {
        const resampledData = this.resample(inputData, this.audioContext.sampleRate, config.audio.sampleRate)
        const pcmData = this.floatTo16BitPCM(resampledData)

        // 实时回调（用于ASR）
        onAudioProcess(pcmData.buffer)

        // 收集音频数据（用于存储）
        if (this.isCollecting) {
          this.recordedChunks.push(new Int16Array(pcmData))
        }

        // 调试日志（每秒约一次）
        if (!this._logCounter) this._logCounter = 0
        if (this._logCounter++ % 50 === 0) {
          console.log('[AudioProcessor] Audio chunk processed:', pcmData.length, 'samples')
        }
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    return this.analyser
  }

  /**
   * 停止录音并返回收集的音频数据
   * @returns 如果启用了收集，返回 Blob 和元数据；否则返回 null
   */
  stop(): { blob: Blob; duration: number; sampleRate: number } | null {
    let result: { blob: Blob; duration: number; sampleRate: number } | null = null

    // 如果启用了音频收集，合并所有数据块并创建 WAV 文件
    if (this.isCollecting && this.recordedChunks.length > 0) {
      const duration = (Date.now() - this.recordingStartTime) / 1000
      const sampleRate = config.audio.sampleRate
      
      // 合并所有音频块
      const totalLength = this.recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const mergedData = new Int16Array(totalLength)
      let offset = 0
      for (const chunk of this.recordedChunks) {
        mergedData.set(chunk, offset)
        offset += chunk.length
      }

      // 创建 WAV 文件
      const wavBlob = this.createWavBlob(mergedData, sampleRate)
      result = { blob: wavBlob, duration, sampleRate }
    }

    // 清理音频收集状态
    this.recordedChunks = []
    this.isCollecting = false

    // 清理音频处理资源
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    return result
  }

  /**
   * 创建 WAV 格式的 Blob
   */
  private createWavBlob(samples: Int16Array, sampleRate: number): Blob {
    const numChannels = 1
    const bitsPerSample = 16
    const bytesPerSample = bitsPerSample / 8
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = samples.length * bytesPerSample
    const headerSize = 44
    const totalSize = headerSize + dataSize

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)

    // WAV 文件头
    // RIFF chunk
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, totalSize - 8, true)
    this.writeString(view, 8, 'WAVE')

    // fmt chunk
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // audio format (PCM)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)

    // data chunk
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // 写入音频数据
    const int16View = new Int16Array(buffer, headerSize)
    int16View.set(samples)

    return new Blob([buffer], { type: 'audio/wav' })
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  /**
   * 获取当前录音时长（秒）
   */
  getRecordingDuration(): number {
    if (!this.recordingStartTime) return 0
    return (Date.now() - this.recordingStartTime) / 1000
  }

  /**
   * 检查是否正在收集音频
   */
  isCollectingAudio(): boolean {
    return this.isCollecting
  }
}
