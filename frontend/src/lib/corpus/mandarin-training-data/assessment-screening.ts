import type { MandarinTrainingExercise } from './types'

const ASSESSMENT_SCREENING_TEXTS = [
  '爸爸',
  '妈妈',
  '喝水',
  '吃饭',
  '刷牙',
  '上学',
  '司机',
  '医生',
  '老师',
  '护士',
  '手机',
  '地铁',
  '公交',
  '蓝牙',
  '密码',
  '开门',
  '关灯',
  '谢谢',
  '知道',
  '睡觉',
] as const

export const ASSESSMENT_SCREENING_EXERCISES: MandarinTrainingExercise[] =
  ASSESSMENT_SCREENING_TEXTS.map((text, index) => ({
    id: `assessment_screening_${String(index + 1).padStart(3, '0')}`,
    text,
    category: '评估筛查',
  }))
