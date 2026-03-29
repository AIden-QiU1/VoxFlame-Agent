import type {
  RtcCapabilityId,
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
  primaryPinyin: string
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

export interface StartRtcSessionResponse {
  requestId: string
  channelName: string
  graphName: string
  userUid: number
  botUid: number
  appId: string
  token: string
  rtmUserId: string
  rtmChannelName: string
  rtmToken: string
  timeoutSeconds: number
  controlServerUrl: string
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
  keywords?: string[]
  pronunciation_summary?: string
  encouragement?: string
  primary_focus?: string
  primary_pinyin?: string
  articulation_tip?: string
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

export interface AgoraRtmClient {
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
