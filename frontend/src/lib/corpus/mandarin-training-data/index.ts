import GENERATED_REAL_CORPUS from '../generated/mandarin-training-real.json'
import APPROVED_CORE_GAP_CORPUS from '../generated/mandarin-approved-core-gap-corpus.json'
import { ASSESSMENT_SCREENING_EXERCISES } from './assessment-screening'
import { CURATED_TOPIC_EXERCISES } from './curated-topics'
import {
  MANDARIN_TRAINING_CATEGORY_ORDER,
} from './types'
import type {
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta,
  MandarinTrainingExercise,
} from './types'

interface GeneratedCategoryPayload {
  count: number
  items: MandarinTrainingExercise[]
}

interface GeneratedTrainingCorpus {
  generated_at?: string
  generated_from: Record<string, unknown>
  policy?: Record<string, unknown>
  categories: Partial<Record<MandarinTrainingCategory, GeneratedCategoryPayload>>
}

const REAL_CORPUS = GENERATED_REAL_CORPUS as GeneratedTrainingCorpus
const APPROVED_CORE_GAP_EXERCISES = (APPROVED_CORE_GAP_CORPUS as {
  items: MandarinTrainingExercise[]
}).items

export type {
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta,
  MandarinTrainingExercise,
} from './types'

export const MANDARIN_TRAINING_CATEGORIES = [...MANDARIN_TRAINING_CATEGORY_ORDER]

function mergeExercises(
  category: MandarinTrainingCategory,
  primary: MandarinTrainingExercise[],
  generated: MandarinTrainingExercise[],
): MandarinTrainingExercise[] {
  const seen = new Set<string>()
  const merged: MandarinTrainingExercise[] = []

  for (const exercise of [...primary, ...generated]) {
    const text = exercise.text.trim()
    if (!text || seen.has(text)) {
      continue
    }

    seen.add(text)
    merged.push({
      ...exercise,
      text,
      category,
    })
  }

  return merged
}

const CATEGORY_EXERCISE_MAP = MANDARIN_TRAINING_CATEGORIES.reduce(
  (accumulator, category) => {
    const generated = REAL_CORPUS.categories[category]?.items ?? []
    if (category === '评估筛查') {
      accumulator[category] = ASSESSMENT_SCREENING_EXERCISES
      return accumulator
    }

    const approvedGapExercises = category === '音系强化'
      ? APPROVED_CORE_GAP_EXERCISES
      : []
    accumulator[category] = mergeExercises(
      category,
      approvedGapExercises,
      [...(CURATED_TOPIC_EXERCISES[category] ?? []), ...generated],
    ).filter((exercise) => {
      if (accumulator.__seenTexts.has(exercise.text)) {
        return false
      }

      accumulator.__seenTexts.add(exercise.text)
      return true
    })
    return accumulator
  },
  { __seenTexts: new Set<string>() } as Record<
    MandarinTrainingCategory,
    MandarinTrainingExercise[]
  > & { __seenTexts: Set<string> },
)

export const MANDARIN_TRAINING_EXERCISES: MandarinTrainingExercise[] =
  MANDARIN_TRAINING_CATEGORIES.flatMap((category) => CATEGORY_EXERCISE_MAP[category])

export const MANDARIN_TRAINING_CATEGORY_META: Record<
  MandarinTrainingCategory,
  MandarinTrainingCategoryMeta
> = {
  '评估筛查': {
    label: '评估主题区',
    shortLabel: '20 词筛查',
    description: '用 20 条高频双字词做一次轻量普通话筛查，先看正确字数 / 总字数和系统听懂分。',
    examples: ['爸爸', '刷牙', '蓝牙'],
    helper: '这组不是普通训练句，而是筛查词表。先完整录完，再看字符准确率和系统听懂分。',
    trainingTips: ['先把每个字说完整，不用刻意求快。', '这一组先看字准率，结果只作为训练筛查，不替代医学评估。'],
    corpusCount: CATEGORY_EXERCISE_MAP['评估筛查'].length,
  },
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
  '现代文章朗读': {
    label: '现代文章朗读',
    shortLabel: '现代短文',
    description: '以普通话现代白话、公开转写句和朗读作品为主，练连续语流、停连、轻重音和自然语调。',
    examples: ['尊重科学规律的要求', '每个人都有自己的路', '清晨的空气很新鲜'],
    helper: '这组是朗读训练的默认入口，优先使用现代中文片段，降低理解负担。',
    trainingTips: ['先按现代汉语语序自然断句。', '注意停连、轻重音和整句流畅度，不用故意读成播音腔。'],
    corpusCount: CATEGORY_EXERCISE_MAP['现代文章朗读'].length,
  },
  '会议与协作': {
    label: '会议与协作',
    shortLabel: '会议协作',
    description: '覆盖开会、汇报、确认、协商、补充观点和工作沟通里的短句，练真实协作场景中的表达权。',
    examples: ['请先听我补充', '这个风险要确认', '我们再对一下时间'],
    helper: '这组句子专门补工作和会议里的轮次、确认和补充表达。',
    trainingTips: ['先把“请听我补充”“我想确认”这类起手结构说稳。', '遇到观点句，先说关键动词，再补对象。'],
    corpusCount: CATEGORY_EXERCISE_MAP['会议与协作'].length,
  },
  '车载与导航': {
    label: '车载与导航',
    shortLabel: '车内导航',
    description: '覆盖车内沟通、导航、停车、转向、空调、加油充电和出行路况短句，补移动环境里的高频表达。',
    examples: ['前面路口右转', '请打开车内空调', '先找地方停车'],
    helper: '这组句子面向车内和路上场景，重点练方向、动作、设备和安全提醒。',
    trainingTips: ['方向和动作要分开说清。', '车内噪声大时，先把最关键的地点或动作词说稳。'],
    corpusCount: CATEGORY_EXERCISE_MAP['车载与导航'].length,
  },
  '音系强化': {
    label: '音系强化',
    shortLabel: '声韵声调',
    description: '从真实现代中文转写和朗读材料中挑选声母、韵母、声调覆盖更密的短句，专门练连续音系稳定性。',
    examples: ['清晨的空气很新鲜', '群众生活更加便利', '声音变化比较明显'],
    helper: '这组不是古文进阶，也不是绕口令；它用真实来源句补声韵调覆盖，适合做专项稳定练习。',
    trainingTips: ['先慢读，确保每个音节都站稳。', '遇到声调变化密集的句子，先分两拍读，再连起来。'],
    corpusCount: CATEGORY_EXERCISE_MAP['音系强化'].length,
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
