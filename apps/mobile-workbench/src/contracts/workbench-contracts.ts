import type { MobileWorkbenchSurfaceId } from '../constants/surfaces'

export type MobileWorkbenchRtcSurface = 'mobile_workbench'
export type MobileWorkbenchSourceSurface = 'mobile_workbench'

export type MobileWorkbenchSessionMode =
  | 'communication'
  | 'training'
  | 'quick_talk'

export type MobileWorkbenchSessionStrategy =
  | 'heavy_realtime'
  | 'light_voice'

export type MobileWorkbenchCapabilityId =
  | 'transport_send_control'
  | 'voice_profile_update'
  | 'workspace_snapshot_read'
  | 'upload_artifact_persist'

export type MobileWorkbenchScene =
  | 'medical'
  | 'family'
  | 'stranger'
  | 'emergency'
  | 'work'
  | 'interview'
  | 'outing'
  | 'home'

export interface MobileWorkbenchDeviceContext {
  secureContext?: boolean
  mediaDevicesSupported?: boolean
  microphoneStatus?: 'unknown' | 'available' | 'unavailable'
  networkOnline?: boolean
  appState?: 'active' | 'background' | 'inactive'
}

export interface MobileWorkbenchRtcSessionIntent {
  surface: MobileWorkbenchRtcSurface
  mode: MobileWorkbenchSessionMode
  sessionStrategy: MobileWorkbenchSessionStrategy
  requestedCapabilities: MobileWorkbenchCapabilityId[]
  scene?: MobileWorkbenchScene
  deviceContext?: MobileWorkbenchDeviceContext
}

export interface MobileWorkbenchLiveKitRuntime {
  provider: 'livekit'
  serverUrl: string
  roomName: string
  participantIdentity: string
  participantName: string
  participantToken: string
  participantMetadata: string
  participantAttributes: Record<string, string>
  agentDispatch: {
    agentName: string
    metadata: string
  } | null
}

export interface MobileWorkbenchRtcSessionResponse {
  requestId: string
  channelName: string
  executionBackend: 'livekit'
  transport: MobileWorkbenchLiveKitRuntime
  intent: MobileWorkbenchRtcSessionIntent
  readiness: {
    canStart: boolean
    blockers: string[]
    warnings: string[]
  }
}

export type MobileWorkbenchRecordingMode =
  | 'training'
  | 'communication'
  | 'evaluation'
  | 'free_recording'

export type MobileWorkbenchCollectionMode =
  | 'supervised'
  | 'weak_supervision'
  | 'free_recording'
  | 'benchmark'

export type MobileWorkbenchCaptureTransport =
  | 'native_recorder'
  | 'livekit_track'
  | 'imported_file'

export type MobileWorkbenchAudioQualityDisposition =
  | 'high_confidence'
  | 'review'
  | 'low_confidence'

export type MobileWorkbenchConsentScope =
  | 'training_only'
  | 'training_and_model_improvement'
  | 'evaluation_only'

export type MobileWorkbenchSyncStatus =
  | 'local_only'
  | 'upload_pending'
  | 'uploaded'
  | 'indexed'
  | 'failed'

export interface MobileWorkbenchRecordingEnvelope {
  recordingId: string
  sessionId: string
  mode: MobileWorkbenchRecordingMode
  sourceSurface: MobileWorkbenchSourceSurface
  collectionMode: MobileWorkbenchCollectionMode
  createdAt: string
  startedAt: string
  stoppedAt: string
  audio: {
    uri: string
    format: string
    sampleRate: number
    channelCount: number
    durationMs: number
    durationSeconds: number
    fileSizeBytes: number
    sha256?: string
    captureTransport: MobileWorkbenchCaptureTransport
    quality?: {
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
  }
}

export interface MobileWorkbenchRecorderQueueItem {
  recordingId: string
  contributorId: string
  text: string
  sentenceId?: string
  source?: string
  surface: MobileWorkbenchSurfaceId
  metadata: Record<string, unknown>
  consentScope: MobileWorkbenchConsentScope
  syncStatus: MobileWorkbenchSyncStatus
  syncAttempts: number
  lastAttemptAt?: string
  lastError?: string
  uploadReceipt?: MobileWorkbenchUploadReceipt | null
  createdAt: string
  recording: MobileWorkbenchRecordingEnvelope
}

export interface MobileWorkbenchUploadReceipt {
  recordingId: string
  contributionId?: string | null
  manifestPath?: string
  storagePath?: string
  reusedContribution?: boolean
  manifestAlreadySynced?: boolean
  source: 'cloud' | 'background_retry'
  syncStatus: 'uploaded' | 'retrying'
  message: string
}
