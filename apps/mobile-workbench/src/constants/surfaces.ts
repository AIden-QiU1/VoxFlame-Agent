export type MobileWorkbenchSurfaceId =
  | 'communication'
  | 'practice'
  | 'memory'
  | 'device'

export interface MobileWorkbenchSurfaceDefinition {
  id: MobileWorkbenchSurfaceId
  label: string
}

export const MOBILE_WORKBENCH_SURFACES: MobileWorkbenchSurfaceDefinition[] = [
  {
    id: 'communication',
    label: '沟通',
  },
  {
    id: 'practice',
    label: '练习',
  },
  {
    id: 'memory',
    label: '准备',
  },
  {
    id: 'device',
    label: '我的',
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
