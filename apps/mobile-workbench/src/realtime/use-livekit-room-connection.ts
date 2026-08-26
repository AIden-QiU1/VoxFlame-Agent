import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  PermissionsAndroid,
  Platform,
} from 'react-native'
import { AudioSession } from '@livekit/react-native'
import {
  ConnectionState,
  type DataPacket_Kind,
  Room,
  RoomEvent,
} from 'livekit-client'

import type { MobileWorkbenchRtcSessionResponse } from '../contracts/workbench-contracts'
import { toMobileProductMessage } from '../ui/product-message'

export type MobileLiveKitConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting'
  | 'disconnected'
  | 'error'

export interface MobileLiveKitRoomConnectionState {
  status: MobileLiveKitConnectionStatus
  roomName: string | null
  participantIdentity: string | null
  audioSessionStarted: boolean
  microphoneEnabled: boolean
  currentUserTranscript: string
  latestUserTranscript: string
  latestUserTranscriptCaptureId: string | null
  latestAssistantTranscript: string
  errorMessage: string | null
  canConnect: boolean
  connect(session: MobileWorkbenchRtcSessionResponse): Promise<boolean>
  disconnect(): Promise<void>
  sendText(text: string): Promise<boolean>
  startTrainingCapture(captureId: string, shortUtteranceExpected: boolean): Promise<boolean>
  stopTrainingCapture(captureId: string): Promise<boolean>
  waitForFinalTranscript(captureId: string, timeoutMs?: number): Promise<string>
}

interface MobileRtcEnvelope {
  type?: string
  name?: string
  role?: 'user' | 'assistant' | 'system'
  text?: string
  is_final?: boolean
  client_capture_id?: string
  data?: Record<string, unknown>
}

function decodeRtcEnvelope(payload: Uint8Array): MobileRtcEnvelope | null {
  try {
    const decoded = new TextDecoder().decode(payload)
    const value = JSON.parse(decoded) as MobileRtcEnvelope
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

function mapConnectionState(state: ConnectionState): MobileLiveKitConnectionStatus {
  if (state === ConnectionState.Connected) {
    return 'connected'
  }

  if (state === ConnectionState.Connecting) {
    return 'connecting'
  }

  if (
    state === ConnectionState.Reconnecting
    || state === ConnectionState.SignalReconnecting
  ) {
    return 'reconnecting'
  }

  return 'disconnected'
}

async function requestBluetoothAudioPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 31) {
    return
  }

  const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
  const alreadyGranted = await PermissionsAndroid.check(permission)

  if (!alreadyGranted) {
    await PermissionsAndroid.request(permission)
  }
}

export function useLiveKitRoomConnection(): MobileLiveKitRoomConnectionState {
  const roomRef = useRef<Room | null>(null)
  const transcriptCacheRef = useRef<Map<string, string>>(new Map())
  const [status, setStatus] = useState<MobileLiveKitConnectionStatus>('idle')
  const [roomName, setRoomName] = useState<string | null>(null)
  const [participantIdentity, setParticipantIdentity] = useState<string | null>(null)
  const [audioSessionStarted, setAudioSessionStarted] = useState(false)
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)
  const [currentUserTranscript, setCurrentUserTranscript] = useState('')
  const [latestUserTranscript, setLatestUserTranscript] = useState('')
  const [latestUserTranscriptCaptureId, setLatestUserTranscriptCaptureId] = useState<string | null>(null)
  const [latestAssistantTranscript, setLatestAssistantTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const disconnect = useCallback(async (): Promise<void> => {
    const room = roomRef.current
    setStatus((current) => (
      current === 'idle' || current === 'disconnected'
        ? current
        : 'disconnecting'
    ))

    try {
      if (room) {
        try {
          await room.localParticipant.setMicrophoneEnabled(false)
        } catch {
          // Best effort cleanup; disconnect still needs to run.
        }
        await room.disconnect()
      }
    } finally {
      roomRef.current = null
      setMicrophoneEnabled(false)
      try {
        await AudioSession.stopAudioSession()
      } catch {
        // Native audio cleanup must not leave UI stuck in disconnecting.
      }
      setAudioSessionStarted(false)
      setRoomName(null)
      setParticipantIdentity(null)
      setCurrentUserTranscript('')
      setLatestUserTranscriptCaptureId(null)
      transcriptCacheRef.current.clear()
      setStatus('disconnected')
    }
  }, [])

  const connect = useCallback(async (
    session: MobileWorkbenchRtcSessionResponse,
  ): Promise<boolean> => {
    setErrorMessage(null)

    if (!session.readiness.canStart) {
      setStatus('error')
      setErrorMessage('连接失败，请重试。')
      return false
    }

    await disconnect()
    setStatus('connecting')
    setRoomName(session.transport.roomName)
    setParticipantIdentity(session.transport.participantIdentity)

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })
    roomRef.current = room

    room
      .on(RoomEvent.ConnectionStateChanged, (nextState) => {
        setStatus(mapConnectionState(nextState))
      })
      .on(RoomEvent.Reconnecting, () => {
        setStatus('reconnecting')
      })
      .on(RoomEvent.Reconnected, () => {
        setStatus('connected')
      })
      .on(RoomEvent.Disconnected, () => {
        setMicrophoneEnabled(false)
        setStatus('disconnected')
      })
      .on(
        RoomEvent.DataReceived,
        (
          payload: Uint8Array,
          _participant,
          _kind?: DataPacket_Kind,
        ) => {
          const envelope = decodeRtcEnvelope(payload)
          if (!envelope) {
            return
          }

          if (envelope.type === 'transcript' && envelope.text) {
            if (envelope.role === 'user') {
              setCurrentUserTranscript(envelope.text)
              if (envelope.is_final) {
                setLatestUserTranscript(envelope.text)
                const captureId = envelope.client_capture_id?.trim() || null
                setLatestUserTranscriptCaptureId(captureId)
                if (captureId) {
                  transcriptCacheRef.current.set(captureId, envelope.text.trim())
                }
              }
            }
            if (envelope.role === 'assistant' && envelope.is_final) {
              setLatestAssistantTranscript(envelope.text)
            }
            return
          }

          if (envelope.name === 'interim_text') {
            const interimText = envelope.data?.text
            if (typeof interimText === 'string') {
              setCurrentUserTranscript(interimText)
            }
          }
        },
      )

    try {
      // Android 12+ protects Bluetooth headset routing behind Nearby devices.
      // Denial does not block communication; the phone mic/speaker still works.
      try {
        await requestBluetoothAudioPermission()
      } catch {
        // AudioSession can continue with the built-in audio route.
      }
      await AudioSession.startAudioSession()
      setAudioSessionStarted(true)
      await room.connect(
        session.transport.serverUrl,
        session.transport.participantToken,
      )
      const enableMicrophone = session.intent.mode !== 'training'
      await room.localParticipant.setMicrophoneEnabled(enableMicrophone)
      setMicrophoneEnabled(enableMicrophone)
      setStatus('connected')
      return true
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'realtime'))
      setStatus('error')
      try {
        await room.disconnect()
      } catch {
        // The initial connect path already failed; cleanup is best effort.
      }
      roomRef.current = null
      setMicrophoneEnabled(false)
      try {
        await AudioSession.stopAudioSession()
      } catch {
        // Keep the original connection error visible.
      }
      setAudioSessionStarted(false)
      return false
    }
  }, [disconnect])

  const sendText = useCallback(async (text: string): Promise<boolean> => {
    const room = roomRef.current
    const normalized = text.trim()
    if (!room || status !== 'connected' || !normalized) {
      return false
    }

    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'user_input',
          input_type: 'text',
          text: normalized,
          metadata: {
            transport: 'livekit_data',
            surface: 'mobile_workbench',
          },
          timestamp: Date.now(),
        })),
        {
          reliable: true,
          topic: room.name,
        },
      )
      setLatestUserTranscript(normalized)
      return true
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'realtime'))
      return false
    }
  }, [status])

  const publishControl = useCallback(async (
    type: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> => {
    const room = roomRef.current
    if (!room || status !== 'connected') {
      return false
    }

    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type, ...payload })),
        { reliable: true, topic: room.name },
      )
      return true
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'realtime'))
      return false
    }
  }, [status])

  const startTrainingCapture = useCallback(async (
    captureId: string,
    shortUtteranceExpected: boolean,
  ): Promise<boolean> => {
    const room = roomRef.current
    if (!room || status !== 'connected') {
      return false
    }

    transcriptCacheRef.current.delete(captureId)
    setCurrentUserTranscript('')
    const announced = await publishControl('speech_activity', {
      state: 'speech_started',
      auto_finalize: false,
      short_utterance_expected: shortUtteranceExpected,
      client_capture_id: captureId,
      detected_at: Date.now(),
    })
    if (!announced) {
      return false
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      setMicrophoneEnabled(true)
      return true
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'realtime'))
      return false
    }
  }, [publishControl, status])

  const stopTrainingCapture = useCallback(async (
    captureId: string,
  ): Promise<boolean> => {
    const room = roomRef.current
    if (!room || status !== 'connected') {
      return false
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(false)
      setMicrophoneEnabled(false)
    } catch (error) {
      setErrorMessage(toMobileProductMessage(error, 'realtime'))
      return false
    }

    const stopped = await publishControl('speech_activity', {
      state: 'speech_stopped',
      auto_finalize: true,
      client_capture_id: captureId,
      detected_at: Date.now(),
    })
    const committed = await publishControl('end_audio', {
      reason: 'manual_stop',
      client_capture_id: captureId,
    })
    return stopped && committed
  }, [publishControl, status])

  const waitForFinalTranscript = useCallback(async (
    captureId: string,
    timeoutMs = 8_500,
  ): Promise<string> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const transcript = transcriptCacheRef.current.get(captureId)?.trim()
      if (transcript) {
        return transcript
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 140)
      })
    }
    return transcriptCacheRef.current.get(captureId)?.trim() ?? ''
  }, [])

  const canConnect = status !== 'connecting' && status !== 'disconnecting'

  return useMemo(() => ({
    status,
    roomName,
    participantIdentity,
    audioSessionStarted,
    microphoneEnabled,
    currentUserTranscript,
    latestUserTranscript,
    latestUserTranscriptCaptureId,
    latestAssistantTranscript,
    errorMessage,
    canConnect,
    connect,
    disconnect,
    sendText,
    startTrainingCapture,
    stopTrainingCapture,
    waitForFinalTranscript,
  }), [
    audioSessionStarted,
    canConnect,
    connect,
    currentUserTranscript,
    disconnect,
    errorMessage,
    latestAssistantTranscript,
    latestUserTranscript,
    latestUserTranscriptCaptureId,
    microphoneEnabled,
    participantIdentity,
    roomName,
    sendText,
    startTrainingCapture,
    status,
    stopTrainingCapture,
    waitForFinalTranscript,
  ])
}
