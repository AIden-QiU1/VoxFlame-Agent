import type { MobileWorkbenchSurfaceId } from '@/constants/surfaces'
import type {
  MobileWorkbenchCapabilityId,
  MobileWorkbenchDeviceContext,
  MobileWorkbenchRtcSessionIntent,
  MobileWorkbenchScene,
  MobileWorkbenchSessionMode,
  MobileWorkbenchSessionStrategy,
} from '@/contracts/workbench-contracts'

const CAPABILITIES_BY_MODE: Record<MobileWorkbenchSessionMode, MobileWorkbenchCapabilityId[]> = {
  communication: [
    'transport_send_control',
    'workspace_snapshot_read',
  ],
  training: [
    'transport_send_control',
    'workspace_snapshot_read',
    'voice_profile_update',
    'upload_artifact_persist',
  ],
  quick_talk: [
    'transport_send_control',
  ],
}

export function defaultModeForMobileSurface(
  surfaceId: MobileWorkbenchSurfaceId,
): MobileWorkbenchSessionMode {
  if (surfaceId === 'practice') {
    return 'training'
  }

  if (surfaceId === 'communication') {
    return 'quick_talk'
  }

  return 'communication'
}

export function defaultStrategyForMobileMode(
  mode: MobileWorkbenchSessionMode,
): MobileWorkbenchSessionStrategy {
  return mode === 'quick_talk' ? 'light_voice' : 'heavy_realtime'
}

export function buildMobileWorkbenchRtcSessionIntent(input: {
  surfaceId: MobileWorkbenchSurfaceId
  mode?: MobileWorkbenchSessionMode
  scene?: MobileWorkbenchScene
  deviceContext?: MobileWorkbenchDeviceContext
}): MobileWorkbenchRtcSessionIntent {
  const mode = input.mode ?? defaultModeForMobileSurface(input.surfaceId)

  return {
    surface: 'mobile_workbench',
    mode,
    sessionStrategy: defaultStrategyForMobileMode(mode),
    requestedCapabilities: CAPABILITIES_BY_MODE[mode],
    scene: input.scene,
    deviceContext: input.deviceContext,
  }
}
