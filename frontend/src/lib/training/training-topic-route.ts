import {
  MANDARIN_TRAINING_CATEGORY_META,
  type MandarinTrainingCategory,
} from '@/lib/corpus/mandarin-training'

export type TrainingTopicId =
  | 'custom-material'
  | 'assessment-screening'
  | 'daily-mobility'
  | 'medical-help'
  | 'roles'
  | 'devices-numbers'
  | 'pronunciation-reading'
  | 'classical-reading'

const CATEGORY_TO_TOPIC_ID: Record<MandarinTrainingCategory, TrainingTopicId> = {
  '评估筛查': 'assessment-screening',
  '日常与出行': 'daily-mobility',
  '看病与求助': 'medical-help',
  '人群与角色': 'roles',
  '设备与数字': 'devices-numbers',
  '现代文章朗读': 'pronunciation-reading',
  '文言文节奏': 'classical-reading',
}

const TOPIC_ID_TO_CATEGORY: Partial<Record<TrainingTopicId, MandarinTrainingCategory>> = Object.entries(
  CATEGORY_TO_TOPIC_ID,
).reduce((accumulator, [category, topicId]) => {
  accumulator[topicId] = category as MandarinTrainingCategory
  return accumulator
}, {} as Partial<Record<TrainingTopicId, MandarinTrainingCategory>>)

export function isTrainingTopicId(value: string): value is TrainingTopicId {
  return [
    'custom-material',
    'assessment-screening',
    'daily-mobility',
    'medical-help',
    'roles',
    'devices-numbers',
    'pronunciation-reading',
    'classical-reading',
  ].includes(value)
}

export function getTrainingTopicHref(topicId: TrainingTopicId): string {
  return `/contribute/topic/${topicId}`
}

export function getTrainingTopicIdForCategory(
  category: MandarinTrainingCategory,
): TrainingTopicId {
  return CATEGORY_TO_TOPIC_ID[category]
}

export function resolveTrainingTopicSelection(topicId: TrainingTopicId): {
  topicId: TrainingTopicId
  label: string
  description: string
  practiceMode: 'prepared_content' | 'sentence_corpus'
  category: MandarinTrainingCategory | null
} {
  if (topicId === 'custom-material') {
    return {
      topicId,
      label: '自定义训练',
      description: '直接围绕记忆区当前加载的参考材料切句、录音，并在录稳后自动切到下一句。',
      practiceMode: 'prepared_content',
      category: null,
    }
  }

  const category = TOPIC_ID_TO_CATEGORY[topicId]
  if (!category) {
    return {
      topicId: 'daily-mobility',
      label: MANDARIN_TRAINING_CATEGORY_META['日常与出行'].label,
      description: MANDARIN_TRAINING_CATEGORY_META['日常与出行'].description,
      practiceMode: 'sentence_corpus',
      category: '日常与出行',
    }
  }

  const meta = MANDARIN_TRAINING_CATEGORY_META[category]
  return {
    topicId,
    label: meta.label,
    description: meta.description,
    practiceMode: 'sentence_corpus',
    category,
  }
}
