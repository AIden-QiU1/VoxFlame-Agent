import type { StarterKitScene } from '@/lib/communication/starter-kit'
import type { MandarinTrainingCategory } from '@/lib/corpus/mandarin-training'

export interface TrainingSceneProfile {
  id: StarterKitScene['id']
  title: string
  summary: string
  rationale: string
  primaryCategory: MandarinTrainingCategory
  recommendedCategories: MandarinTrainingCategory[]
  coachingFocus: string
}

export const DEFAULT_TRAINING_SCENE_ID: StarterKitScene['id'] = 'interview'

export const TRAINING_SCENE_PROFILES: TrainingSceneProfile[] = [
  {
    id: 'interview',
    title: '求职 / 面试',
    summary: '先把自我介绍、节奏说明和关键判断练稳，再去面向陌生人表达。',
    rationale: '这类场景失败成本高，先练角色表达和起手句，比纯朗读更能提升真实信心。',
    primaryCategory: '人群与角色',
    recommendedCategories: ['人群与角色', '日常与出行', '发音与朗读'],
    coachingFocus: '先把“请先听我说完”“请直接和我沟通”这类角色句说稳。',
  },
  {
    id: 'workplace',
    title: '工作协作',
    summary: '先练会议里需要抢回表达权、澄清风险和补充判断的句子。',
    rationale: '团队压力里最伤人的不是一句没识别对，而是你根本没有完整说完的机会。',
    primaryCategory: '人群与角色',
    recommendedCategories: ['人群与角色', '日常与出行', '设备与数字'],
    coachingFocus: '优先练“关键点”“风险”“请先听我补充”这类工作沟通结构。',
  },
  {
    id: 'stranger',
    title: '陌生人开口',
    summary: '先练低负担起手句，让你能更快解释自己的节奏并继续沟通。',
    rationale: '陌生人场景里，先建立沟通预期比一次把所有话都说清更重要。',
    primaryCategory: '日常与出行',
    recommendedCategories: ['日常与出行', '人群与角色'],
    coachingFocus: '先练“请给我一点时间”“如果没听清请告诉我”这类补救句。',
  },
  {
    id: 'medical',
    title: '就医沟通',
    summary: '先把疼痛、需求、求助对象和决策节奏练稳，关键时刻更能顶住。',
    rationale: '医疗沟通里最有价值的是对象、动作和症状信息，不是复杂长句。',
    primaryCategory: '看病与求助',
    recommendedCategories: ['看病与求助', '日常与出行', '设备与数字'],
    coachingFocus: '先把“哪里不舒服”“需要谁帮助”“请慢一点说”这些核心信息说清楚。',
  },
  {
    id: 'caregiver',
    title: '家人 / 照护',
    summary: '先练表达需求、节奏和边界的句子，减少被家人提前替答。',
    rationale: '熟人场景常见问题不是没人关心，而是别人太快替你做了决定。',
    primaryCategory: '人群与角色',
    recommendedCategories: ['人群与角色', '日常与出行'],
    coachingFocus: '优先练“请先听我说完”“我现在想休息一下”这类边界表达。',
  },
  {
    id: 'emergency',
    title: '紧急求助',
    summary: '先练求助对象、紧急程度和安全需求，让关键句更短更稳。',
    rationale: '紧急状态下句子必须短、准、能重复，训练页也要围绕这个目标来准备。',
    primaryCategory: '看病与求助',
    recommendedCategories: ['看病与求助', '日常与出行'],
    coachingFocus: '先把“需要帮助”“联系急救”“带我去安全的地方”这一类短句说稳。',
  },
]

export function getTrainingSceneProfile(
  sceneId: StarterKitScene['id'] | undefined,
): TrainingSceneProfile {
  return (
    TRAINING_SCENE_PROFILES.find((profile) => profile.id === sceneId) ??
    TRAINING_SCENE_PROFILES[0]
  )
}

export function getTrainingSceneSuggestedCategories(
  sceneId: StarterKitScene['id'] | undefined,
): MandarinTrainingCategory[] {
  return getTrainingSceneProfile(sceneId).recommendedCategories
}
