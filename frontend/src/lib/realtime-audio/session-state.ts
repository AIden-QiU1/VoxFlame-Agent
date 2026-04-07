import type {
  ConversationMessage,
  RtcAgentState,
  TrainingCoachFeedbackEvent,
  VoiceProfileSyncEvent,
} from './session-types'
import type { StartRtcSessionResponse } from './session-types'

export function createMessage(
  role: ConversationMessage['role'],
  content: string,
): ConversationMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date(),
  }
}

export function createInitialRtcAgentState(): RtcAgentState {
  return {
    isConnected: false,
    isRecording: false,
    isThinking: false,
    isSpeaking: false,
    sessionId: null,
    currentASRText: '',
    currentResponseText: '',
    latestUserTranscript: '',
    messages: [],
    error: null,
    transport: 'rtc',
    sessionIntent: null,
    sessionReadiness: null,
    grantedCapabilities: [],
    lastTrainingCoachFeedback: null,
    lastVoiceProfileSync: null,
  }
}

export function applyTrainingCoachFeedback(
  prev: RtcAgentState,
  feedback: TrainingCoachFeedbackEvent,
): RtcAgentState {
  return {
    ...prev,
    lastTrainingCoachFeedback: feedback,
  }
}

export function applyVoiceProfileSync(
  prev: RtcAgentState,
  sync: VoiceProfileSyncEvent,
): RtcAgentState {
  return {
    ...prev,
    lastVoiceProfileSync: sync,
  }
}

export function applyRtcError(
  prev: RtcAgentState,
  error: string,
): RtcAgentState {
  return {
    ...prev,
    error,
  }
}

export function applyFinalUserTranscript(
  prev: RtcAgentState,
  text: string,
): RtcAgentState {
  return {
    ...prev,
    currentASRText: '',
    latestUserTranscript: text,
    messages: [...prev.messages, createMessage('user', text)],
  }
}

export function applyFinalAssistantTranscript(
  prev: RtcAgentState,
  text: string,
): RtcAgentState {
  return {
    ...prev,
    currentResponseText: '',
    isThinking: false,
    messages: [...prev.messages, createMessage('assistant', text)],
  }
}

export function applyCurrentAsrText(
  prev: RtcAgentState,
  text: string,
): RtcAgentState {
  return {
    ...prev,
    currentASRText: text,
  }
}

export function applyAssistantResponseDelta(
  prev: RtcAgentState,
  delta: string,
  isFinal: boolean,
): RtcAgentState {
  const nextResponse = `${prev.currentResponseText}${delta}`

  if (!isFinal) {
    return {
      ...prev,
      isThinking: false,
      currentResponseText: nextResponse,
    }
  }

  return {
    ...prev,
    currentResponseText: '',
    messages: delta
      ? [...prev.messages, createMessage('assistant', nextResponse)]
      : prev.messages,
  }
}

export function applyDisconnectedState(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    isThinking: false,
    sessionId: null,
    sessionIntent: null,
    sessionReadiness: null,
    grantedCapabilities: [],
    lastTrainingCoachFeedback: null,
    lastVoiceProfileSync: null,
  }
}

export function applyConnectedState(
  prev: RtcAgentState,
  session: StartRtcSessionResponse,
  connectionNotice: string | null,
): RtcAgentState {
  return {
    ...prev,
    isConnected: true,
    sessionId: session.channelName,
    error: null,
    sessionIntent: session.intent,
    sessionReadiness: session.readiness,
    grantedCapabilities: session.intent.grantedCapabilities,
    messages:
      connectionNotice
        ? [
            ...prev.messages,
            createMessage('system', connectionNotice),
          ]
        : prev.messages,
  }
}

export function applyRecordingStarted(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    isRecording: true,
    error: null,
    currentASRText: '',
    currentResponseText: '',
    latestUserTranscript: '',
  }
}

export function applyRecordingStopped(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    isRecording: false,
  }
}

export function applyLocalUserText(
  prev: RtcAgentState,
  text: string,
): RtcAgentState {
  return {
    ...prev,
    error: null,
    messages: [...prev.messages, createMessage('user', text)],
  }
}

export function applyClearedMessages(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    messages: [],
    currentASRText: '',
    currentResponseText: '',
    latestUserTranscript: '',
    lastTrainingCoachFeedback: null,
    lastVoiceProfileSync: null,
  }
}
