import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng'
import type {
  AgoraRtmClient,
  RtmMessageEvent,
  RtmStatusEvent,
  StartRtcSessionResponse,
} from './session-types'

interface ConnectAgoraTransportOptions {
  session: StartRtcSessionResponse
  onRtmMessage: (event: RtmMessageEvent) => void
  onRtmStatus: (event: RtmStatusEvent) => void
  onRemoteAudioStart: () => void
  onRemoteAudioStop: () => void
  onRtcDisconnected: () => void
}

export interface AgoraTransportConnection {
  client: IAgoraRTCClient
  rtmClient: AgoraRtmClient
}

function configureAgoraRtcLogging(agoraRtc: { setLogLevel?: (level: number) => void }) {
  try {
    // In production we prefer WARNING/ERROR only so vendor INFO noise does not
    // drown actual runtime issues. In development we keep INFO for diagnosis.
    const logLevel = process.env.NODE_ENV === 'production' ? 2 : 1
    agoraRtc.setLogLevel?.(logLevel)
  } catch (error) {
    console.warn('[agora-transport] setLogLevel failed:', error)
  }
}

async function createRtmClient(
  session: StartRtcSessionResponse,
): Promise<AgoraRtmClient> {
  const AgoraRTMModule = await import('agora-rtm')
  const AgoraRTM = AgoraRTMModule.default
  return new AgoraRTM.RTM(session.appId, session.rtmUserId)
}

export async function connectAgoraTransport(
  options: ConnectAgoraTransportOptions,
): Promise<AgoraTransportConnection> {
  const { session } = options
  const AgoraRTCModule = await import('agora-rtc-sdk-ng')
  const AgoraRTC = AgoraRTCModule.default
  configureAgoraRtcLogging(AgoraRTC)
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })

  client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
    if (mediaType !== 'audio') {
      return
    }

    await client.subscribe(user, 'audio')
    user.audioTrack?.play()
    options.onRemoteAudioStart()
  })

  client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType) => {
    if (mediaType === 'audio' && user.uid === session.botUid) {
      options.onRemoteAudioStop()
    }
  })

  client.on('connection-state-change', (currentState) => {
    if (currentState === 'DISCONNECTED') {
      options.onRtcDisconnected()
    }
  })

  await client.join(session.appId, session.channelName, session.token, session.userUid)

  const rtmClient = await createRtmClient(session)
  rtmClient.addEventListener('message', options.onRtmMessage)
  rtmClient.addEventListener('status', options.onRtmStatus)
  await rtmClient.login({ token: session.rtmToken || session.token })
  await rtmClient.subscribe(session.rtmChannelName || session.channelName)

  return {
    client,
    rtmClient,
  }
}

export async function disconnectAgoraTransport({
  client,
  rtmClient,
  micTrack,
  session,
}: {
  client: IAgoraRTCClient | null
  rtmClient: AgoraRtmClient | null
  micTrack: ILocalAudioTrack | null
  session: StartRtcSessionResponse | null
}): Promise<void> {
  try {
    if (micTrack && client) {
      await client.unpublish([micTrack])
    }
  } catch (error) {
    console.warn('[agora-transport] unpublish failed:', error)
  }

  try {
    micTrack?.close()
  } catch (error) {
    console.warn('[agora-transport] mic close failed:', error)
  }

  try {
    if (rtmClient && session) {
      await rtmClient.unsubscribe(session.rtmChannelName || session.channelName)
    }
  } catch (error) {
    console.warn('[agora-transport] RTM unsubscribe failed:', error)
  }

  try {
    await rtmClient?.logout()
  } catch (error) {
    console.warn('[agora-transport] RTM logout failed:', error)
  }

  try {
    await client?.leave()
  } catch (error) {
    console.warn('[agora-transport] leave failed:', error)
  }
}
