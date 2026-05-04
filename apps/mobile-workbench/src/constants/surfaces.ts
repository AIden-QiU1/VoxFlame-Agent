export type MobileWorkbenchSurfaceId =
  | 'communication'
  | 'practice'
  | 'memory'
  | 'device'

export interface MobileWorkbenchSurfaceDefinition {
  id: MobileWorkbenchSurfaceId
  label: string
  title: string
  status: 'ready_for_contract' | 'native_boundary' | 'requires_backend' | 'planned'
  primaryAction: string
  contractOwner: 'backend' | 'mobile_cache' | 'livekit_runtime'
  acceptanceSignal: string
}

export const MOBILE_WORKBENCH_SURFACES: MobileWorkbenchSurfaceDefinition[] = [
  {
    id: 'communication',
    label: '沟通',
    title: '先说关键一句',
    status: 'requires_backend',
    primaryAction: '开始 quick talk',
    contractOwner: 'livekit_runtime',
    acceptanceSignal: '能通过 backend 拿 token，进入 LiveKit room，看到连接、中断和断网状态。',
  },
  {
    id: 'practice',
    label: '练习',
    title: '录一句，稳稳补传',
    status: 'native_boundary',
    primaryAction: '录制练习样本',
    contractOwner: 'mobile_cache',
    acceptanceSignal: '真机录音落盘，断网后留在本地队列，恢复后拿到 upload receipt。',
  },
  {
    id: 'memory',
    label: '准备',
    title: '把要说的话放在手边',
    status: 'ready_for_contract',
    primaryAction: '查看准备材料',
    contractOwner: 'backend',
    acceptanceSignal: '能读取 workspace snapshot，并展示 active prepared expression 与高频短句。',
  },
  {
    id: 'device',
    label: '设备',
    title: '权限、同步、本地文件',
    status: 'planned',
    primaryAction: '检查麦克风',
    contractOwner: 'mobile_cache',
    acceptanceSignal: '用户能看见麦克风权限、本地队列、补传失败原因和删除入口。',
  },
]

export function getMobileWorkbenchSurface(
  surfaceId: MobileWorkbenchSurfaceId,
): MobileWorkbenchSurfaceDefinition {
  const surface = MOBILE_WORKBENCH_SURFACES.find((item) => item.id === surfaceId)
  if (!surface) {
    return MOBILE_WORKBENCH_SURFACES[0]
  }

  return surface
}
