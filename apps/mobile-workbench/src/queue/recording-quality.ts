import type { MobileWorkbenchAudioQualityDisposition } from '../contracts/workbench-contracts'

export interface MobileRecordingQuality {
  durationMs: number
  speechDurationMs?: number
  leadingSilenceMs?: number
  trailingSilenceMs?: number
  silenceRatio?: number
  inputLevelRms?: number
  inputLevelPeak?: number
  disposition: MobileWorkbenchAudioQualityDisposition
  reasons: string[]
}

export function assessMobileRecordingQuality(durationMs: number): MobileRecordingQuality {
  if (durationMs < 900) {
    return {
      durationMs,
      disposition: 'low_confidence',
      reasons: ['recording_too_short', 'mobile_level_metrics_pending'],
    }
  }

  if (durationMs < 1_500) {
    return {
      durationMs,
      disposition: 'review',
      reasons: ['recording_slightly_short', 'mobile_level_metrics_pending'],
    }
  }

  return {
    durationMs,
    disposition: 'high_confidence',
    reasons: ['duration_ok', 'mobile_level_metrics_pending'],
  }
}
