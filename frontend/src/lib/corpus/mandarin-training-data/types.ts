export const MANDARIN_TRAINING_CATEGORY_ORDER = [
  '日常与出行',
  '看病与求助',
  '人群与角色',
  '设备与数字',
  '发音与朗读',
] as const

export type MandarinTrainingCategory =
  (typeof MANDARIN_TRAINING_CATEGORY_ORDER)[number]

export interface MandarinTrainingExercise {
  id: string
  text: string
  category: MandarinTrainingCategory
}

export interface MandarinTrainingCategoryMeta {
  label: string
  shortLabel: string
  description: string
  examples: string[]
  helper: string
  trainingTips: string[]
  corpusCount: number
}

export interface TrainingPhrase {
  text: string
}
