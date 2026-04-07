import type {
  LocalAudioTrack,
  LocalTrackPublication,
  Room,
} from 'livekit-client'
import type {
  RtcCapabilityId,
  RtcExecutionBackend,
  RtcResolvedSessionIntent,
  RtcSessionReadiness,
} from './session-contract'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface DualLineSubtitle {
  originalText: string
  correctedText: string
  isCorrected: boolean
  timestamp: Date
}

export interface TrainingFeedbackEvent {
  requestId: string
  exerciseId: string
  exerciseText: string
  recognizedText: string
  status: string
  category: string
  clarityScore: number
  summary: string
  focusTags: string[]
  keywords: string[]
  confusionPatternsCount: number
  pronunciationSummary: string
  persisted: boolean
  memoryEnabled: boolean
  voiceProfileUpdateRequested: boolean
  voiceProfileUpdated: boolean
  encouragement: string
  primaryFocus: string
  articulationTip: string
  nextStep: string
  source: string
  timestamp: Date
  error: string | null
  voiceProfileError: string | null
}

export interface VoiceProfileSyncEvent {
  source: string
  exerciseId: string
  category: string
  hotwordCount: number
  confusionPatternsCount: number
  clarityScore: number
  lastTrainingCategory: string
  timestamp: Date
}

export interface LiveKitTransportRuntime {
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

export type RtcTransportRuntime = LiveKitTransportRuntime

export interface StartRtcSessionResponse {
  requestId: string
  channelName: string
  graphName: string
  executionBackend: RtcExecutionBackend
  userUid: number
  botUid: number
  appId: string
  token: string
  rtmUserId: string
  rtmChannelName: string
  rtmToken: string
  timeoutSeconds: number
  controlServerUrl: string
  transport: RtcTransportRuntime
  intent: RtcResolvedSessionIntent
  readiness: RtcSessionReadiness
}

export interface RtcMessageEnvelope {
  type?: string
  name?: string
  role?: 'user' | 'assistant' | 'system'
  text?: string
  delta?: string
  full_text?: string
  corrected_text?: string
  original_text?: string
  clarity_score?: number
  state?: string
  auto_finalize?: boolean
  interruption_requested?: boolean
  speech_duration_ms?: number
  reason?: string
  normalized_level?: number
  peak_level?: number
  clipping_detected?: boolean
  apm_enabled?: boolean
  is_final?: boolean
  error?: string
  message?: string
  feedback_request_id?: string
  metadata?: Record<string, unknown>
  data?: Record<string, unknown>
  exercise_id?: string
  exercise_text?: string
  recognized_text?: string
  feedback_status?: string
  exercise_category?: string
  summary?: string
  focus_tags?: string[]
  speech_patterns?: string[]
  keywords?: string[]
  pronunciation_summary?: string
  pronunciation_targets?: string[]
  encouragement?: string
  primary_focus?: string
  articulation_tip?: string
  articulation_tips?: string[]
  next_step?: string
  confusion_patterns_count?: number
  persisted?: boolean
  memory_enabled?: boolean
  voice_profile_update_requested?: boolean
  voice_profile_updated?: boolean
  source?: string
  hotword_count?: number
  last_training_category?: string
}

export interface RtmMessageEvent {
  message: string | Uint8Array
  publisher: string
  channelName: string
}

export interface RtmStatusEvent {
  newState?: string
  reason?: string
}

export interface SessionControlClient {
  login(options?: { token?: string }): Promise<unknown>
  logout(): Promise<unknown>
  publish(
    channelName: string,
    message: string | Uint8Array,
    options?: { channelType: 'MESSAGE' | 'STREAM' },
  ): Promise<unknown>
  subscribe(channelName: string): Promise<unknown>
  unsubscribe(channelName: string): Promise<unknown>
  addEventListener(
    eventName: 'message' | 'status',
    listener: ((event: RtmMessageEvent) => void) | ((event: RtmStatusEvent) => void),
  ): void
  removeEventListener(
    eventName: 'message' | 'status',
    listener: ((event: RtmMessageEvent) => void) | ((event: RtmStatusEvent) => void),
  ): void
}

export interface SessionMicrophoneTrack {
  provider: 'livekit'
  rawTrack: LocalAudioTrack
  publication: LocalTrackPublication
  room: Room
  setEnabled(enabled: boolean): Promise<void>
  getMediaStreamTrack(): MediaStreamTrack
  stop(): void
  close(): void
}

export interface RtcAgentState {
  isConnected: boolean
  isRecording: boolean
  isThinking: boolean
  isSpeaking: boolean
  sessionId: string | null
  currentASRText: string
  currentResponseText: string
  currentDualLine: DualLineSubtitle | null
  latestUserTranscript: string
  messages: ConversationMessage[]
  error: string | null
  transport: 'rtc'
  sessionIntent: RtcResolvedSessionIntent | null
  sessionReadiness: RtcSessionReadiness | null
  grantedCapabilities: RtcCapabilityId[]
  lastTrainingFeedback: TrainingFeedbackEvent | null
  lastVoiceProfileSync: VoiceProfileSyncEvent | null
}
