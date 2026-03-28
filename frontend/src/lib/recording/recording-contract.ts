export type VoxFlameRecordingMode = 'training' | 'communication' | 'evaluation' | 'free_recording'

export type VoxFlameSourceSurface =
  | 'web'
  | 'pwa'
  | 'desktop_companion'
  | 'mobile_companion'
  | 'local_cli'

export type VoxFlameCollectionMode =
  | 'supervised'
  | 'weak_supervision'
  | 'free_recording'
  | 'benchmark'

export type VoxFlameCaptureTransport =
  | 'browser_media_recorder'
  | 'rtc_dup_track'
  | 'local_pcm_stream'

export type VoxFlameConsentScope =
  | 'training_only'
  | 'training_and_model_improvement'
  | 'evaluation_only'

export type VoxFlameSyncStatus =
  | 'local_only'
  | 'upload_pending'
  | 'uploaded'
  | 'indexed'
  | 'failed'

export interface VoxFlameRecordingEnvelope {
  recordingId: string
  sessionId: string
  mode: VoxFlameRecordingMode
  sourceSurface: VoxFlameSourceSurface
  collectionMode: VoxFlameCollectionMode
  createdAt: string
  startedAt: string
  stoppedAt: string
  audio: {
    blob: Blob
    format: string
    sampleRate: number
    channelCount: number
    durationMs: number
    durationSeconds: number
    fileSizeBytes: number
    captureTransport: VoxFlameCaptureTransport
  }
}

export interface VoxFlameRecorderQueueItem {
  recordingId: string
  contributorId: string
  text: string
  sentenceId?: string
  source?: string
  metadata: Record<string, unknown>
  consentScope: VoxFlameConsentScope
  syncStatus: VoxFlameSyncStatus
  syncAttempts: number
  lastAttemptAt?: string
  lastError?: string
  createdAt: string
  recording: VoxFlameRecordingEnvelope
}
