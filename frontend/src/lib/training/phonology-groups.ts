import PHONOLOGY_INDEX from '@/lib/corpus/generated/mandarin-phonology-index.json'
import COVERAGE_STATUS from '@/lib/corpus/generated/mandarin-coverage-product-status.json'
import REINFORCEMENT_PRODUCT_INDEX from '@/lib/corpus/generated/mandarin-reinforcement-product-index.json'
import type { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'


export const PHONOLOGY_GROUP_IDS = [
  'all',
  'coverage-core',
  'coverage-reinforcement',
  'labial',
  'tongue-tip-mid',
  'velar',
  'palatal',
  'sibilants',
  'nasal-finals',
  'compound-finals',
  'tones',
] as const

export type PhonologyGroupId = (typeof PHONOLOGY_GROUP_IDS)[number]
export type PhonologyTargetGroupId = Exclude<PhonologyGroupId, 'all' | 'coverage-core' | 'coverage-reinforcement'>

export interface PhonologyGroupMeta {
  id: PhonologyGroupId
  label: string
  shortLabel: string
  description: string
}

export interface PhonologyExerciseTarget {
  id: PhonologyTargetGroupId
  focus: string
  score: number
}

interface GeneratedPhonologyIndex {
  groups: Array<PhonologyGroupMeta & { id: PhonologyTargetGroupId; count: number }>
  items: Record<string, PhonologyExerciseTarget[]>
}

const INDEX = PHONOLOGY_INDEX as GeneratedPhonologyIndex
const REINFORCEMENT_PROMPTS = new Map(
  Object.entries((REINFORCEMENT_PRODUCT_INDEX as {
    items: Record<string, {
      low_frequency_targets: string[]
      planned_recording_slots: number
    }>
  }).items).map(([exerciseId, prompt]) => [exerciseId, {
    exercise_id: exerciseId,
    ...prompt,
  }]),
)

function reinforcementPriority(exerciseId: string): number {
  return REINFORCEMENT_PROMPTS.get(exerciseId)?.planned_recording_slots ?? 0
}

export const PHONOLOGY_GROUPS: PhonologyGroupMeta[] = [
  {
    id: 'coverage-core',
    label: '核心补音',
    shortLabel: '审核后推荐',
    description: '只显示通过语言学、自然度、用户负担、安全、许可和产品审核的核心缺口词句。',
  },
  {
    id: 'coverage-reinforcement',
    label: '低频补强',
    shortLabel: '按缺口优先录',
    description: '从现役安全题库中优先选择低于最低题面门槛的音节—声调；计划槽位不等于已经获得的真实录音。',
  },
  {
    id: 'all',
    label: '全部音系句',
    shortLabel: '综合覆盖',
    description: '不限定专项，按当前音系强化句池连续练习。',
  },
  ...INDEX.groups.map(({ id, label, shortLabel, description }) => ({
    id,
    label,
    shortLabel,
    description,
  })),
]

export function isPhonologyGroupId(value: string): value is PhonologyGroupId {
  return (PHONOLOGY_GROUP_IDS as readonly string[]).includes(value)
}

export function getPhonologyExerciseTargets(exerciseId: string): PhonologyExerciseTarget[] {
  return INDEX.items[exerciseId] ?? []
}

export function getPhonologyGroupMeta(groupId: PhonologyGroupId): PhonologyGroupMeta {
  return PHONOLOGY_GROUPS.find((group) => group.id === groupId) ?? PHONOLOGY_GROUPS[0]
}

export function filterExercisesByPhonologyGroup(
  exercises: MandarinTrainingExercise[],
  groupId: PhonologyGroupId,
): MandarinTrainingExercise[] {
  if (groupId === 'all') {
    return exercises
  }

  if (groupId === 'coverage-core') {
    return exercises.filter((exercise) => exercise.id.startsWith('coverage-gap-'))
  }

  if (groupId === 'coverage-reinforcement') {
    return exercises
      .filter((exercise) => REINFORCEMENT_PROMPTS.has(exercise.id))
      .sort((left, right) => (
        reinforcementPriority(right.id) - reinforcementPriority(left.id)
          || left.id.localeCompare(right.id, 'zh-CN')
      ))
  }

  return exercises.filter((exercise) => (
    getPhonologyExerciseTargets(exercise.id).some((target) => target.id === groupId)
  ))
}

export function getPhonologyFocusForGroup(
  exerciseId: string,
  groupId: PhonologyGroupId,
): string | null {
  const targets = getPhonologyExerciseTargets(exerciseId)
  if (groupId === 'coverage-core') {
    return exerciseId.startsWith('coverage-gap-') ? '经审核的核心音节—声调缺口' : null
  }
  if (groupId === 'coverage-reinforcement') {
    const prompt = REINFORCEMENT_PROMPTS.get(exerciseId)
    return prompt
      ? `低频目标 ${prompt.low_frequency_targets.slice(0, 4).join(' / ')}${prompt.low_frequency_targets.length > 4 ? ' 等' : ''}`
      : null
  }
  if (groupId === 'all') {
    return targets[0]?.focus ?? null
  }

  return targets.find((target) => target.id === groupId)?.focus ?? null
}

export const MANDARIN_COVERAGE_PRODUCT_STATUS = COVERAGE_STATUS
