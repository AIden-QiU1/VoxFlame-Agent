import type { MicrophoneInputQuality } from './microphone-input-feedback'

export type AudioQualityDisposition = 'high_confidence' | 'review' | 'low_confidence'

export interface AudioQualityMetrics {
  duration_ms: number
  speech_duration_ms?: number
  leading_silence_ms?: number
  trailing_silence_ms?: number
  silence_ratio?: number
  input_level_rms?: number
  input_level_peak?: number
  quality_disposition: AudioQualityDisposition
  quality_reasons: string[]
}

export interface RecordingQualityAccumulator {
  observeLevel(level: number): void
  finish(durationMs: number): AudioQualityMetrics
}

const SPEECH_LEVEL_THRESHOLD = 0.028
const QUIET_RMS_THRESHOLD = 0.024
const LOUD_PEAK_THRESHOLD = 0.23
const MIN_SPEECH_DURATION_MS = 700
const SAMPLE_INTERVAL_MS = 120

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000
}

function classifyAudioQuality(options: {
  durationMs: number
  speechDurationMs: number
  silenceRatio: number
  rms: number
  peak: number
}): {
  disposition: AudioQualityDisposition
  reasons: string[]
} {
  const reasons: string[] = []
  let disposition: AudioQualityDisposition = 'high_confidence'

  if (options.durationMs < 900) {
    disposition = 'low_confidence'
    reasons.push('recording_too_short')
  } else if (options.durationMs < 1_500) {
    disposition = 'review'
    reasons.push('recording_slightly_short')
  }

  if (options.speechDurationMs < MIN_SPEECH_DURATION_MS) {
    disposition = 'low_confidence'
    reasons.push('speech_too_short_or_too_quiet')
  }

  if (options.silenceRatio > 0.72) {
    disposition = disposition === 'low_confidence' ? disposition : 'review'
    reasons.push('too_much_silence')
  }

  if (options.rms < QUIET_RMS_THRESHOLD) {
    disposition = disposition === 'low_confidence' ? disposition : 'review'
    reasons.push('input_level_quiet')
  }

  if (options.peak > LOUD_PEAK_THRESHOLD) {
    disposition = disposition === 'low_confidence' ? disposition : 'review'
    reasons.push('input_level_loud')
  }

  if (reasons.length === 0) {
    reasons.push('audio_quality_stable')
  }

  return { disposition, reasons }
}

export function createRecordingQualityAccumulator(
  sampleIntervalMs: number = SAMPLE_INTERVAL_MS,
): RecordingQualityAccumulator {
  let sampleCount = 0
  let speechSampleCount = 0
  let firstSpeechSampleIndex: number | null = null
  let lastSpeechSampleIndex: number | null = null
  let squaredLevelSum = 0
  let peakLevel = 0

  return {
    observeLevel(level: number): void {
      const normalizedLevel = Number.isFinite(level) ? Math.max(0, level) : 0
      squaredLevelSum += normalizedLevel * normalizedLevel
      peakLevel = Math.max(peakLevel, normalizedLevel)

      if (normalizedLevel >= SPEECH_LEVEL_THRESHOLD) {
        if (firstSpeechSampleIndex === null) {
          firstSpeechSampleIndex = sampleCount
        }
        lastSpeechSampleIndex = sampleCount
        speechSampleCount += 1
      }

      sampleCount += 1
    },
    finish(durationMs: number): AudioQualityMetrics {
      const safeDurationMs = Math.max(0, Math.round(durationMs))
      const speechDurationMs = Math.min(
        safeDurationMs,
        speechSampleCount * sampleIntervalMs,
      )
      const leadingSilenceMs = firstSpeechSampleIndex === null
        ? safeDurationMs
        : Math.min(safeDurationMs, firstSpeechSampleIndex * sampleIntervalMs)
      const trailingSilenceMs = lastSpeechSampleIndex === null
        ? safeDurationMs
        : Math.max(
            0,
            safeDurationMs - Math.min(safeDurationMs, (lastSpeechSampleIndex + 1) * sampleIntervalMs),
          )
      const silenceRatio = safeDurationMs > 0
        ? Math.max(0, Math.min(1, 1 - speechDurationMs / safeDurationMs))
        : 1
      const rms = sampleCount > 0
        ? Math.sqrt(squaredLevelSum / sampleCount)
        : 0
      const classified = classifyAudioQuality({
        durationMs: safeDurationMs,
        speechDurationMs,
        silenceRatio,
        rms,
        peak: peakLevel,
      })

      return {
        duration_ms: safeDurationMs,
        speech_duration_ms: Math.round(speechDurationMs),
        leading_silence_ms: Math.round(leadingSilenceMs),
        trailing_silence_ms: Math.round(trailingSilenceMs),
        silence_ratio: roundToThree(silenceRatio),
        input_level_rms: roundToThree(rms),
        input_level_peak: roundToThree(peakLevel),
        quality_disposition: classified.disposition,
        quality_reasons: classified.reasons,
      }
    },
  }
}

export function qualityDispositionFromMicrophoneFeedback(
  quality: MicrophoneInputQuality,
): AudioQualityDisposition {
  if (quality === 'balanced') {
    return 'high_confidence'
  }

  if (quality === 'quiet' || quality === 'loud') {
    return 'review'
  }

  return 'low_confidence'
}
