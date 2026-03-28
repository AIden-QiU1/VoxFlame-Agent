export type MandarinTrainingCategory =
  | '日常与出行'
  | '看病与求助'
  | '人群与角色'
  | '设备与数字'
  | '发音与朗读'

export type MandarinTrainingSourceId =
  | 'public_aac'
  | 'apple_support_cn'
  | 'public_service_guides'
  | 'people_roles_public'
  | 'mccsd'
  | 'public_classics'

export interface MandarinTrainingSource {
  id: MandarinTrainingSourceId
  label: string
  url: string
  summary: string
}

export interface MandarinTrainingExercise {
  id: string
  text: string
  pinyin: string
  category: MandarinTrainingCategory
}

export interface MandarinTrainingCategoryMeta {
  label: string
  shortLabel: string
  description: string
  examples: string[]
  helper: string
  trainingTips: string[]
  sourceIds: MandarinTrainingSourceId[]
  corpusCount: number
}

export interface TrainingPhrase {
  text: string
  pinyin: string
}
