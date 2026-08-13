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
  errorMessage: string | null
  canConnect: boolean
  connect(session: MobileWorkbenchRtcSessionResponse): Promise<boolean>
  disconnect(): Promise<void>
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
  const [status, setStatus] = useState<MobileLiveKitConnectionStatus>('idle')
  const [roomName, setRoomName] = useState<string | null>(null)
  const [participantIdentity, setParticipantIdentity] = useState<string | null>(null)
  const [audioSessionStarted, setAudioSessionStarted] = useState(false)
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)
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
      await room.localParticipant.setMicrophoneEnabled(true)
      setMicrophoneEnabled(true)
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

  const canConnect = status !== 'connecting' && status !== 'disconnecting'

  return useMemo(() => ({
    status,
    roomName,
    participantIdentity,
    audioSessionStarted,
    microphoneEnabled,
    errorMessage,
    canConnect,
    connect,
    disconnect,
  }), [
    audioSessionStarted,
    canConnect,
    connect,
    disconnect,
    errorMessage,
    microphoneEnabled,
    participantIdentity,
    roomName,
    status,
  ])
}
