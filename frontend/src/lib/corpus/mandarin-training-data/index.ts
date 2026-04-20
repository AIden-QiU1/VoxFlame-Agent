import GENERATED_REAL_CORPUS from '../generated/mandarin-training-real.json'
import { CURATED_TOPIC_EXERCISES } from './curated-topics'
import {
  MANDARIN_TRAINING_CATEGORY_ORDER,
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta,
  MandarinTrainingExercise,
} from './types'

interface GeneratedCategoryPayload {
  count: number
  items: MandarinTrainingExercise[]
}

interface GeneratedTrainingCorpus {
  generated_from: Record<string, string>
  categories: Partial<Record<MandarinTrainingCategory, GeneratedCategoryPayload>>
}

const REAL_CORPUS = GENERATED_REAL_CORPUS as GeneratedTrainingCorpus

export type {
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta,
  MandarinTrainingExercise,
} from './types'

export const MANDARIN_TRAINING_CATEGORIES = [...MANDARIN_TRAINING_CATEGORY_ORDER]

const CATEGORY_EXERCISE_MAP = MANDARIN_TRAINING_CATEGORIES.reduce(
  (accumulator, category) => {
    accumulator[category] =
      CURATED_TOPIC_EXERCISES[category]
      ?? REAL_CORPUS.categories[category]?.items
      ?? []
    return accumulator
  },
  {} as Record<MandarinTrainingCategory, MandarinTrainingExercise[]>,
)

export const MANDARIN_TRAINING_EXERCISES: MandarinTrainingExercise[] =
  MANDARIN_TRAINING_CATEGORIES.flatMap((category) => CATEGORY_EXERCISE_MAP[category])

export const MANDARIN_TRAINING_CATEGORY_META: Record<
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta
> = {
  '日常与出行': {
    label: '日常与出行',
    shortLabel: '常说常用',
    description: '把起手表达、见面、出门、乘车、点餐、付款这些真正高频的普通话短句放在一起，优先补最常开口的生活语料。',
    examples: ['可以再说一次吗', '请带我去地铁站', '可以扫码付款吗'],
    helper: '这组句子优先保证“日常能开口、出门能说清”的真实表达，不再混入帮助文档句。',
    trainingTips: ['先把句子里的动作词和对象说清楚。', '这一组重在高频口语，不求快，先求稳定。'],
    corpusCount: CATEGORY_EXERCISE_MAP['日常与出行'].length,
  },
  '看病与求助': {
    label: '看病与求助',
    shortLabel: '求助就医',
    description: '把症状描述、急救求助、挂号分诊、检查缴费这些关键节点短句放在一起，优先覆盖高风险场景里最需要说清的话。',
    examples: ['我有点喘不过气', '请帮我挂个急诊', '请帮我拨打一二零'],
    helper: '这组句子重点覆盖症状词、求助词和就医流程里的关键信息。',
    trainingTips: ['先把最关键的症状词或动作词说稳。', '求助句优先把对象、动作和地点说清楚。'],
    corpusCount: CATEGORY_EXERCISE_MAP['看病与求助'].length,
  },
  '人群与角色': {
    label: '人群与角色',
    shortLabel: '学生老人',
    description: '把家人、照护者、老师、同学、前台、客服这些角色沟通常用短句放在一起，补真实人际互动里的称呼、礼貌和请求。',
    examples: ['老师请再讲一次', '请别替我回答', '客服请转人工'],
    helper: '这组句子专门补不同角色之间常说的话，优先练“对谁说、怎么说”。',
    trainingTips: ['这一组先看角色词和动作词，再看整句语气。', '老师、老人、客服这类句子重在礼貌、称呼和回应节奏。'],
    corpusCount: CATEGORY_EXERCISE_MAP['人群与角色'].length,
  },
  '设备与数字': {
    label: '设备与数字',
    shortLabel: '设备数字',
    description: '把电话、短信、导航、支付、验证码、时间日期这些设备操作和数字表达放到一起，补最常见的结构化口语。',
    examples: ['请帮我打开蓝牙', '验证码是3816', '晚上八点提醒我'],
    helper: '这组句子专门补短指令、数字序列和设备操作的稳定性，不再混入产品帮助文档句。',
    trainingTips: ['数字相关内容一位一位说，停顿要清楚。', '设备口令尽量先说动作，再说对象。'],
    corpusCount: CATEGORY_EXERCISE_MAP['设备与数字'].length,
  },
  '发音与朗读': {
    label: '发音与朗读',
    shortLabel: '朗读音韵',
    description: '用经典文章打散句补声母、韵母、声调和整句节奏，让训练页不只练场景，也能补音韵音调覆盖。',
    examples: ['不宜妄自菲薄', '不知老之将至', '仰觀宇宙之大'],
    helper: '这组句子主要服务音韵、节奏和整句朗读能力。',
    trainingTips: ['先把整句节奏读顺，再抠单个字。', '这一组重点看声调、停顿和朗读起伏。'],
    corpusCount: CATEGORY_EXERCISE_MAP['发音与朗读'].length,
  },
}

export function getExercisesByCategory(
  category: MandarinTrainingCategory | 'all',
): MandarinTrainingExercise[] {
  if (category === 'all') {
    return MANDARIN_TRAINING_EXERCISES
  }

  return CATEGORY_EXERCISE_MAP[category]
}

export function getExerciseById(id: string): MandarinTrainingExercise | undefined {
  return MANDARIN_TRAINING_EXERCISES.find((exercise) => exercise.id === id)
}

export function getTrainingCategoryMeta(
  category: MandarinTrainingCategory,
): MandarinTrainingCategoryMeta {
  return MANDARIN_TRAINING_CATEGORY_META[category]
}

export function getTrainingTipsForCategory(category: MandarinTrainingCategory): string[] {
  return MANDARIN_TRAINING_CATEGORY_META[category].trainingTips
}
