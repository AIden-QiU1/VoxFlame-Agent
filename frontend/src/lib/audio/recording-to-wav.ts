import { config } from '@/lib/config'
import type { VoxFlameRecordingEnvelope } from '@/lib/recording/recording-contract'

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext
}

function getAudioContextConstructor(): typeof AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持浏览器侧音频转码。')
  }

  const candidate = globalThis.AudioContext
    ?? (window as WindowWithWebkitAudioContext).webkitAudioContext

  if (!candidate) {
    throw new Error('当前浏览器不支持音频解码，暂时无法转成 WAV。')
  }

  return candidate
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice()
  }

  const mono = new Float32Array(audioBuffer.length)
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channel = audioBuffer.getChannelData(channelIndex)
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      mono[sampleIndex] += channel[sampleIndex] / audioBuffer.numberOfChannels
    }
  }

  return mono
}

function resample(samples: Float32Array, originalSampleRate: number, targetSampleRate: number): Float32Array {
  if (originalSampleRate === targetSampleRate) {
    return samples
  }

  const ratio = originalSampleRate / targetSampleRate
  const newLength = Math.round(samples.length / ratio)
  const result = new Float32Array(newLength)

  for (let index = 0; index < newLength; index += 1) {
    const sourceIndex = index * ratio
    const lower = Math.floor(sourceIndex)
    const upper = Math.min(lower + 1, samples.length - 1)
    const weight = sourceIndex - lower
    result[index] = samples[lower] * (1 - weight) + samples[upper] * weight
  }

  return result
}

function floatTo16BitPcm(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length)

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]))
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }

  return pcm
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function createWavBlob(samples: Int16Array, sampleRate: number): Blob {
  const channelCount = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = channelCount * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, headerSize + dataSize - 8, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  new Int16Array(buffer, headerSize).set(samples)
  return new Blob([buffer], { type: 'audio/wav' })
}

async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const AudioContextConstructor = getAudioContextConstructor()
  const audioContext = new AudioContextConstructor()

  try {
    const arrayBuffer = await blob.arrayBuffer()
    return await audioContext.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await audioContext.close().catch(() => undefined)
  }
}

function shouldReuseWavRecording(
  recording: VoxFlameRecordingEnvelope,
  targetSampleRate: number,
): boolean {
  const normalizedFormat = `${recording.audio.format} ${recording.audio.blob.type}`.toLowerCase()
  return normalizedFormat.includes('wav')
    && recording.audio.sampleRate === targetSampleRate
    && recording.audio.channelCount === 1
}

export async function normalizeRecordingToWav(
  recording: VoxFlameRecordingEnvelope,
  targetSampleRate: number = config.audio.sampleRate,
): Promise<VoxFlameRecordingEnvelope> {
  if (shouldReuseWavRecording(recording, targetSampleRate)) {
    return {
      ...recording,
      audio: {
        ...recording.audio,
        format: 'audio/wav',
      },
    }
  }

  const decoded = await decodeAudioBlob(recording.audio.blob)
  const mono = mixToMono(decoded)
  const resampled = resample(mono, decoded.sampleRate, targetSampleRate)
  const wavBlob = createWavBlob(floatTo16BitPcm(resampled), targetSampleRate)
  const durationMs = Math.max(
    recording.audio.durationMs,
    Math.round((resampled.length / targetSampleRate) * 1000),
  )

  return {
    ...recording,
    audio: {
      ...recording.audio,
      blob: wavBlob,
      format: 'audio/wav',
      sampleRate: targetSampleRate,
      channelCount: 1,
      durationMs,
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      fileSizeBytes: wavBlob.size,
    },
  }
}
