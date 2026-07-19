'use client'
import type {
  LocalAudioTrack as LiveKitLocalAudioTrack,
  LocalTrackPublication,
  Room as LiveKitRoom,
} from 'livekit-client'
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react'
import type { RtcSessionMode } from './session-contract'
import type { SessionExecutionClient } from './session-execution'
import type { SessionMicrophoneTrack } from './session-types'
import { buildMicrophoneConstraints } from '@/lib/audio/microphone-preferences'

interface SessionAudioRefs {
  micTrackRef: MutableRefObject<SessionMicrophoneTrack | null>
  micStreamRef: MutableRefObject<MediaStream | null>
  preflightMicStreamRef: MutableRefObject<MediaStream | null>
  micAudioContextRef: MutableRefObject<AudioContext | null>
  micSourceNodeRef: MutableRefObject<MediaStreamAudioSourceNode | null>
  micAnalyserRef: MutableRefObject<AnalyserNode | null>
}

interface EnsurePublishedMicrophoneTrackOptions extends SessionAudioRefs {
  clientRef: MutableRefObject<SessionExecutionClient | null>
  connectPromiseRef: MutableRefObject<Promise<void> | null>
  mode: RtcSessionMode
  setAnalyser: Dispatch<SetStateAction<AnalyserNode | null>>
  cleanupMicrophoneResources: () => void
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      // ignore cleanup error
    }
  })
}

export function formatMicrophoneError(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name || '')
      : ''
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : ''
  const normalized = `${name} ${message}`.toLowerCase()

  if (
    normalized.includes('notallowed') ||
    normalized.includes('permission denied') ||
    normalized.includes('permission dismissed')
  ) {
    return '麦克风权限未开启，请在浏览器里允许后再试一次。'
  }

  if (
    normalized.includes('notfound') ||
    normalized.includes('found no microphone') ||
    normalized.includes('requested device not found') ||
    normalized.includes('devices not found')
  ) {
    return '当前设备未检测到可用麦克风，可先用文字或短语沟通。'
  }

  if (
    normalized.includes('notreadable') ||
    normalized.includes('could not start audio source') ||
    normalized.includes('aborterror') ||
    normalized.includes('trackstarterror')
  ) {
    return '麦克风暂时无法使用，可能正被其他应用占用。'
  }

  if (
    normalized.includes('mediadevices api') ||
    normalized.includes('secure context') ||
    normalized.includes('https')
  ) {
    return '当前环境暂时无法访问麦克风，请确认使用 HTTPS 或本地地址访问。'
  }

  return '暂时无法访问麦克风，请检查浏览器权限和设备设置。'
}

export function getSessionNotReadyMessage(mode: RtcSessionMode): string {
  return mode === 'training'
    ? '训练会话还没准备好，请重新点击开始录音。'
    : '请先连接助手。'
}

export function assertMicrophoneEnvironment(): void {
  if (typeof window === 'undefined') {
    throw new Error('当前环境暂时无法访问麦克风。')
  }

  if (!window.isSecureContext) {
    throw new Error('当前环境暂时无法访问麦克风，请确认使用 HTTPS 或本地地址访问。')
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器暂时不支持麦克风访问，请换到较新的浏览器再试。')
  }
}

export function cleanupSessionMicrophoneResources(
  refs: SessionAudioRefs,
  setAnalyser: Dispatch<SetStateAction<AnalyserNode | null>>,
): void {
  refs.micSourceNodeRef.current?.disconnect()
  refs.micSourceNodeRef.current = null

  refs.micAnalyserRef.current?.disconnect()
  refs.micAnalyserRef.current = null
  setAnalyser(null)

  const audioContext = refs.micAudioContextRef.current
  refs.micAudioContextRef.current = null
  if (audioContext) {
    void audioContext.close().catch((error) => {
      console.warn('[session-audio] audio context close failed:', error)
    })
  }

  const mediaStream = refs.micStreamRef.current
  refs.micStreamRef.current = null
  stopMediaStream(mediaStream)

  const preflightStream = refs.preflightMicStreamRef.current
  refs.preflightMicStreamRef.current = null
  stopMediaStream(preflightStream)
}

export async function warmUpSessionMicrophone(
  preflightMicStreamRef: MutableRefObject<MediaStream | null>,
): Promise<MediaStream> {
  const existingStream = preflightMicStreamRef.current
  const existingTrack = existingStream?.getAudioTracks()[0]

  if (existingStream && existingTrack?.readyState === 'live') {
    return existingStream
  }

  preflightMicStreamRef.current = null
  assertMicrophoneEnvironment()

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: buildMicrophoneConstraints(),
    })
    const mediaStreamTrack = mediaStream.getAudioTracks()[0]

    if (!mediaStreamTrack) {
      stopMediaStream(mediaStream)
      throw new Error('当前设备未检测到可用麦克风，可先用文字或短语沟通。')
    }

    preflightMicStreamRef.current = mediaStream
    return mediaStream
  } catch (error) {
    throw new Error(formatMicrophoneError(error))
  }
}

export async function ensurePublishedMicrophoneTrack(
  options: EnsurePublishedMicrophoneTrackOptions,
): Promise<SessionMicrophoneTrack> {
  const existingTrack = options.micTrackRef.current
  if (existingTrack?.getMediaStreamTrack().readyState === 'live') {
    return existingTrack
  }

  if (existingTrack) {
    try {
      existingTrack.close()
    } catch {
      // ignore cleanup error
    }
    options.micTrackRef.current = null
    options.cleanupMicrophoneResources()
  }

  if (!options.clientRef.current && options.connectPromiseRef.current) {
    await options.connectPromiseRef.current
  }

  const client = options.clientRef.current
  if (!client) {
    throw new Error(getSessionNotReadyMessage(options.mode))
  }

  assertMicrophoneEnvironment()

  let mediaStream: MediaStream | null = null
  let liveKitTrack: SessionMicrophoneTrack | null = null
  let audioContext: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let analyserNode: AnalyserNode | null = null

  try {
    mediaStream = options.preflightMicStreamRef.current
    options.preflightMicStreamRef.current = null

    if (!mediaStream) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: buildMicrophoneConstraints(),
      })
    }

    const mediaStreamTrack = mediaStream.getAudioTracks()[0]
    if (!mediaStreamTrack) {
      throw new Error('当前设备未检测到可用麦克风，可先用文字或短语沟通。')
    }

    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    sourceNode = audioContext.createMediaStreamSource(mediaStream)
    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 2048
    analyserNode.smoothingTimeConstant = 0.85
    sourceNode.connect(analyserNode)

    const LiveKitModule = await import('livekit-client')
    const localAudioTrack = new LiveKitModule.LocalAudioTrack(
      mediaStreamTrack,
      undefined,
      true,
      audioContext,
    )
    await localAudioTrack.mute()
    const publication = await client.room.localParticipant.publishTrack(localAudioTrack, {
      source: LiveKitModule.Track.Source.Microphone,
    })
    liveKitTrack = createLiveKitMicrophoneTrack(client.room, localAudioTrack, publication)
    options.micTrackRef.current = liveKitTrack

    options.micStreamRef.current = mediaStream
    options.micAudioContextRef.current = audioContext
    options.micSourceNodeRef.current = sourceNode
    options.micAnalyserRef.current = analyserNode
    options.setAnalyser(analyserNode)
    return options.micTrackRef.current!
  } catch (error) {
    try {
      liveKitTrack?.close()
    } catch {
      // ignore cleanup error
    }
    try {
      sourceNode?.disconnect()
    } catch {
      // ignore cleanup error
    }
    try {
      analyserNode?.disconnect()
    } catch {
      // ignore cleanup error
    }
    if (audioContext) {
      void audioContext.close().catch(() => {
        // ignore cleanup error
      })
    }
    stopMediaStream(mediaStream)
    throw new Error(formatMicrophoneError(error))
  }
}

function createLiveKitMicrophoneTrack(
  room: LiveKitRoom,
  track: LiveKitLocalAudioTrack,
  publication: LocalTrackPublication,
): SessionMicrophoneTrack {
  return {
    provider: 'livekit',
    room,
    rawTrack: track,
    publication,
    async setEnabled(enabled: boolean): Promise<void> {
      if (enabled) {
        await track.unmute()
        return
      }

      await track.mute()
    },
    getMediaStreamTrack(): MediaStreamTrack {
      return track.mediaStreamTrack
    },
    stop(): void {
      track.stop()
    },
    close(): void {
      void room.localParticipant.unpublishTrack(track).catch(() => {
        // ignore cleanup error
      })
      track.stop()
    },
  }
}
