import GENERATED_REAL_CORPUS from '../generated/mandarin-training-real.json'
import {
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
  categories: Record<MandarinTrainingCategory, GeneratedCategoryPayload>
}

const REAL_CORPUS = GENERATED_REAL_CORPUS as GeneratedTrainingCorpus

export type {
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta,
  MandarinTrainingExercise,
} from './types'

export const MANDARIN_TRAINING_CATEGORIES = Object.keys(
  REAL_CORPUS.categories,
) as MandarinTrainingCategory[]

const CATEGORY_EXERCISE_MAP = MANDARIN_TRAINING_CATEGORIES.reduce(
  (accumulator, category) => {
    accumulator[category] = REAL_CORPUS.categories[category]?.items ?? []
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
    description: '把起手表达、问人、回复、联系、见面、出门这些真会说出口的话放在一起，优先保证训练页先覆盖用户最常开的口。',
    examples: ['可以再说一次吗', '我需要帮助', '拨打张晨的移动电话'],
    helper: '这组句子先保证“日常能开口、出门能说清”的真实表达。',
    trainingTips: ['先把句子里的动作词和对象说清楚。', '这一组重在高频口语，不求快，先求稳定。'],
    corpusCount: CATEGORY_EXERCISE_MAP['日常与出行'].length,
  },
  '看病与求助': {
    label: '看病与求助',
    shortLabel: '求助就医',
    description: '把急救、求助、病历、门诊、用药这些会影响沟通成败的句子放在一起，优先覆盖关键时刻最需要说清的话。',
    examples: ['向公园管理人员求助并拨打120急救电话', '急诊需提供急诊诊断证明', '进一步了解你的药品'],
    helper: '这组句子重点覆盖求助词、诊断词和就医流程里的关键信息。',
    trainingTips: ['先把最关键的症状词或动作词说稳。', '求助句优先把对象、动作和地点说清楚。'],
    corpusCount: CATEGORY_EXERCISE_MAP['看病与求助'].length,
  },
  '人群与角色': {
    label: '人群与角色',
    shortLabel: '学生老人',
    description: '把学生、老师、老人、照护者、护士和客服这些带角色感的真实表达放在一起，补课堂互动、照护沟通和服务岗位语言。',
    examples: ['学生不懂随时提问', '老师即时作答', '请问您有什么需要帮助的吗'],
    helper: '这组句子专门补不同人群和角色常说的话，不再只练通用场景。',
    trainingTips: ['这一组先看角色词和动作词，再看整句语气。', '老师、老人、客服这类句子重在礼貌、称呼和回应节奏。'],
    corpusCount: CATEGORY_EXERCISE_MAP['人群与角色'].length,
  },
  '设备与数字': {
    label: '设备与数字',
    shortLabel: '设备数字',
    description: '把电话、信息、定位、闹钟、蓝牙、号码这类结构化表达放到一起，兼顾设备短指令和数字信息覆盖。',
    examples: ['重拨上个号码', '打开或关闭手电筒', '然后输入每个收件人的电话号码'],
    helper: '这组句子专门补短指令、数字序列和电话信息的稳定性。',
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
