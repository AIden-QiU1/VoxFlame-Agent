import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from 'livekit-server-sdk'
import type {
  RtcResolvedSessionIntent,
  RtcSessionReadiness,
} from './rtc-orchestration.service'

export interface LiveKitSessionInput {
  requestId: string
  roomName: string
  userUid: number
  userDisplayName?: string | null
  timeoutSeconds: number
  intent: RtcResolvedSessionIntent
  readiness: RtcSessionReadiness
  serverUrl: string
  apiKey: string
  apiSecret: string
  agentName?: string | null
}

export interface LiveKitSessionResult {
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

export class LiveKitSessionService {
  public async createSession(
    input: LiveKitSessionInput,
  ): Promise<LiveKitSessionResult> {
    const participantIdentity = this.buildParticipantIdentity(
      input.userUid,
      input.requestId,
    )
    const participantName =
      input.userDisplayName?.trim() || `voxflame-user-${input.userUid}`
    const participantMetadata = JSON.stringify({
      request_id: input.requestId,
      session_intent: {
        surface: input.intent.surface,
        mode: input.intent.mode,
        sessionStrategy: input.intent.sessionStrategy,
        scene: input.intent.scene,
        requestedCapabilities: input.intent.requestedCapabilities,
        deviceContext: input.intent.deviceContext,
      },
      granted_capabilities: input.intent.grantedCapabilities,
      readiness: {
        requestedStrategy: input.readiness.requestedStrategy,
        resolvedStrategy: input.readiness.resolvedStrategy,
        recommendedStrategy: input.readiness.recommendedStrategy,
        canStart: input.readiness.canStart,
      },
    })
    const participantAttributes = this.buildParticipantAttributes(input)

    const token = new AccessToken(input.apiKey, input.apiSecret, {
      identity: participantIdentity,
      name: participantName,
      metadata: participantMetadata,
      attributes: participantAttributes,
      ttl: `${input.timeoutSeconds}s`,
    })

    token.addGrant({
      roomJoin: true,
      room: input.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const agentDispatch = this.buildAgentDispatch(input)
    if (agentDispatch) {
      token.roomConfig = new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: agentDispatch.agentName,
            metadata: agentDispatch.metadata,
          }),
        ],
      })
    }

    return {
      roomName: input.roomName,
      participantIdentity,
      participantName,
      participantToken: await token.toJwt(),
      participantMetadata,
      participantAttributes,
      agentDispatch,
    }
  }

  private buildParticipantIdentity(userUid: number, requestId: string): string {
    return `vox-user-${userUid}-${requestId.slice(0, 8)}`
  }

  private buildParticipantAttributes(
    input: LiveKitSessionInput,
  ): Record<string, string> {
    return {
      'vox.mode': input.intent.mode,
      'vox.surface': input.intent.surface,
      'vox.strategy': input.intent.sessionStrategy,
      ...(input.intent.scene ? { 'vox.scene': input.intent.scene } : {}),
      'vox.request_id': input.requestId,
    }
  }

  private buildAgentDispatch(
    input: LiveKitSessionInput,
  ): { agentName: string; metadata: string } | null {
    const agentName = input.agentName?.trim()
    if (!agentName) {
      return null
    }

    return {
      agentName,
      metadata: JSON.stringify({
        request_id: input.requestId,
        participant_identity: this.buildParticipantIdentity(
          input.userUid,
          input.requestId,
        ),
        session_intent: {
          surface: input.intent.surface,
          mode: input.intent.mode,
          sessionStrategy: input.intent.sessionStrategy,
          scene: input.intent.scene,
        },
        granted_capabilities: input.intent.grantedCapabilities,
      }),
    }
  }
}
