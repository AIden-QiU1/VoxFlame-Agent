import type {
  Dispatch,
  SetStateAction,
} from 'react'
import type {
  RtcAgentState,
  RtmStatusEvent,
} from './session-types'

interface SessionTransportEventHandlers {
  onRtmStatus: (event: RtmStatusEvent) => void
  onRemoteAudioStart: () => void
  onRemoteAudioStop: () => void
  onRtcDisconnected: () => void
}

export function createSessionTransportEventHandlers(
  setState: Dispatch<SetStateAction<RtcAgentState>>,
): SessionTransportEventHandlers {
  return {
    onRtmStatus: (event) => {
      if (event.newState === 'DISCONNECTED') {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: '连接已断开，请重新连接。',
        }))
      }
    },
    onRemoteAudioStart: () => {
      setState((prev) => ({ ...prev, isSpeaking: true }))
    },
    onRemoteAudioStop: () => {
      setState((prev) => ({ ...prev, isSpeaking: false }))
    },
    onRtcDisconnected: () => {
      setState((prev) => ({ ...prev, isConnected: false, isRecording: false }))
    },
  }
}
