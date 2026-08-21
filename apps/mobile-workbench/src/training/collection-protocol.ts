export const MOBILE_COLLECTION_PROTOCOL_VERSION = '2026-08-18.v1'

export type MobileCollectionPlanId = 'baseline' | 'anchor' | 'reading' | 'natural_speech'

export const MOBILE_COLLECTION_PLANS: readonly {
  id: MobileCollectionPlanId
  label: string
  description: string
}[] = [
  { id: 'baseline', label: '首轮基线', description: '固定字词和核心朗读，建立可比较的起点。' },
  { id: 'anchor', label: '跨天 Anchor', description: '重复同一小段，观察同人、同设备的变化。' },
  { id: 'reading', label: '连续朗读', description: '按自己的节奏朗读，保留真实停顿和回读。' },
  { id: 'natural_speech', label: '自然表达', description: '从熟悉话题开始，状态不好时随时结束。' },
] as const

export interface MobileCollectionPreflight {
  environmentReady: boolean
  distanceReady: boolean
  understandsConsent: boolean
}

export function isMobileCollectionPreflightReady(
  preflight: MobileCollectionPreflight,
): boolean {
  return preflight.environmentReady && preflight.distanceReady && preflight.understandsConsent
}
