import type {
  ConversationMessage,
  RtcAgentState,
  VoiceProfileSyncEvent,
} from './session-types'
import type { StartRtcSessionResponse } from './session-types'

const MAX_CONVERSATION_MESSAGES = 80

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

function appendMessage(
  messages: ConversationMessage[],
  message: ConversationMessage,
): ConversationMessage[] {
  const nextMessages = [...messages, message]
  return nextMessages.slice(-MAX_CONVERSATION_MESSAGES)
}

export function createInitialRtcAgentState(): RtcAgentState {
  return {
    isConnecting: false,
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
    lastVoiceProfileSync: null,
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
    isConnecting: false,
    isThinking: false,
    currentResponseText: '',
    error,
  }
}

export function applyConnectingState(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    isConnecting: true,
    isConnected: false,
    error: null,
  }
}

export function applyFinalUserTranscript(
  prev: RtcAgentState,
  text: string,
): RtcAgentState {
  return {
    ...prev,
    currentASRText: '',
    isThinking: true,
    latestUserTranscript: text,
    error: null,
    messages: appendMessage(prev.messages, createMessage('user', text)),
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
    error: null,
    messages: appendMessage(prev.messages, createMessage('assistant', text)),
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
      ? appendMessage(prev.messages, createMessage('assistant', nextResponse))
      : prev.messages,
  }
}

export function applyDisconnectedState(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    isConnecting: false,
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    isThinking: false,
    sessionId: null,
    sessionIntent: null,
    sessionReadiness: null,
    grantedCapabilities: [],
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
    isConnecting: false,
    isConnected: true,
    sessionId: session.channelName,
    error: null,
    sessionIntent: session.intent,
    sessionReadiness: session.readiness,
    grantedCapabilities: session.intent.grantedCapabilities,
    messages:
      connectionNotice
        ? appendMessage(prev.messages, createMessage('system', connectionNotice))
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
    messages: appendMessage(prev.messages, createMessage('user', text)),
  }
}

export function applyClearedMessages(prev: RtcAgentState): RtcAgentState {
  return {
    ...prev,
    messages: [],
    currentASRText: '',
    currentResponseText: '',
    latestUserTranscript: '',
    lastVoiceProfileSync: null,
  }
}
