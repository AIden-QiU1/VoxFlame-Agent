export type CollectionPlanId = 'baseline' | 'anchor' | 'reading' | 'natural_speech'

export interface CollectionPlan {
  id: CollectionPlanId
  label: string
  description: string
  durationLabel: string
  materialPrefix: string
}

export const COLLECTION_PLANS: readonly CollectionPlan[] = [
  {
    id: 'baseline',
    label: '首轮基线',
    description: '固定字词和核心朗读，建立可比较的起点。',
    durationLabel: '10–15 分钟，可拆分',
    materialPrefix: 'M1/M2/R027',
  },
  {
    id: 'anchor',
    label: '跨天 Anchor',
    description: '重复同一小段，观察同人、同设备的变化。',
    durationLabel: '每次 2–4 分钟',
    materialPrefix: 'A001',
  },
  {
    id: 'reading',
    label: '连续朗读',
    description: '按自己的节奏读一段，保留真实停顿和回读。',
    durationLabel: '每篇 3–8 分钟',
    materialPrefix: 'R006/R014/R031/R036/R040',
  },
  {
    id: 'natural_speech',
    label: '自然表达',
    description: '从熟悉话题开始，先说 60 秒，累了随时结束。',
    durationLabel: '每题 1–2 分钟',
    materialPrefix: 'T001–T050',
  },
] as const

export interface CollectionPreflight {
  environmentReady: boolean
  distanceReady: boolean
  understandsConsent: boolean
}

export function isCollectionPreflightReady(preflight: CollectionPreflight): boolean {
  return preflight.environmentReady && preflight.distanceReady && preflight.understandsConsent
}
