import PHONOLOGY_INDEX from '@/lib/corpus/generated/mandarin-phonology-index.json'
import COVERAGE_STATUS from '@/lib/corpus/generated/mandarin-coverage-product-status.json'
import REINFORCEMENT_PRODUCT_INDEX from '@/lib/corpus/generated/mandarin-reinforcement-product-index.json'
import RECORDING_CORE_GAP_CORPUS from '@/lib/corpus/generated/mandarin-recording-core-gap-corpus.json'
import RECORDING_REINFORCEMENT_CORPUS from '@/lib/corpus/generated/mandarin-recording-reinforcement-corpus.json'
import RECORDING_OPEN_RESEARCH_CORPUS from '@/lib/corpus/generated/mandarin-recording-open-research-corpus.json'
import type { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'


export const PHONOLOGY_GROUP_IDS = [
  'all',
  'coverage-core',
  'coverage-open-research',
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
export type PhonologyTargetGroupId = Exclude<PhonologyGroupId, 'all' | 'coverage-core' | 'coverage-open-research' | 'coverage-reinforcement'>

/** The targeted-gap recorder opens on machine-checked core prompts so new coverage is immediately discoverable. */
export const DEFAULT_PHONOLOGY_GROUP_ID: PhonologyGroupId = 'coverage-core'

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
const RECORDING_CORE_GAP_IDS = new Set(
  (RECORDING_CORE_GAP_CORPUS as { items: Array<{ id: string }> }).items.map((item) => item.id),
)
const RECORDING_REINFORCEMENT_IDS = new Set(
  (RECORDING_REINFORCEMENT_CORPUS as { items: Array<{ id: string }> }).items.map((item) => item.id),
)
const RECORDING_OPEN_RESEARCH_IDS = new Set(
  (RECORDING_OPEN_RESEARCH_CORPUS as { items: Array<{ id: string }> }).items.map((item) => item.id),
)

function reinforcementPriority(exerciseId: string): number {
  return REINFORCEMENT_PROMPTS.get(exerciseId)?.planned_recording_slots ?? 0
}

export const PHONOLOGY_GROUPS: PhonologyGroupMeta[] = [
  {
    id: 'coverage-core',
    label: '系统易漏听',
    shortLabel: '优先让系统认识',
    description: '优先练系统当前较少见、容易听错的字词和短句；按平时方式说即可，不把方言或个人发音当成缺陷。',
  },
  {
    id: 'coverage-open-research',
    label: '开放研究补充',
    shortLabel: '长尾补充录',
    description: '显示来源可追溯、通过机器语言学与安全门的开放研究补充句；它们不是教材原文，也不代表训练导入批准。',
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
    return exercises.filter((exercise) => RECORDING_CORE_GAP_IDS.has(exercise.id) || exercise.id.startsWith('coverage-gap-'))
  }

  if (groupId === 'coverage-reinforcement') {
    return exercises
      .filter((exercise) => REINFORCEMENT_PROMPTS.has(exercise.id) || RECORDING_REINFORCEMENT_IDS.has(exercise.id))
      .sort((left, right) => (
        reinforcementPriority(right.id) - reinforcementPriority(left.id)
          || left.id.localeCompare(right.id, 'zh-CN')
      ))
  }

  if (groupId === 'coverage-open-research') {
    return exercises.filter((exercise) => RECORDING_OPEN_RESEARCH_IDS.has(exercise.id))
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
    return RECORDING_CORE_GAP_IDS.has(exerciseId) || exerciseId.startsWith('coverage-gap-')
      ? '核心音节—声调缺口（录音就绪）'
      : null
  }
  if (groupId === 'coverage-reinforcement') {
    const prompt = REINFORCEMENT_PROMPTS.get(exerciseId)
    if (RECORDING_REINFORCEMENT_IDS.has(exerciseId)) return '低频目标（录音就绪）'
    return prompt
      ? `低频目标 ${prompt.low_frequency_targets.slice(0, 4).join(' / ')}${prompt.low_frequency_targets.length > 4 ? ' 等' : ''}`
      : null
  }
  if (groupId === 'coverage-open-research') {
    return RECORDING_OPEN_RESEARCH_IDS.has(exerciseId) ? '开放研究补充（录音就绪）' : null
  }
  if (groupId === 'all') {
    return targets[0]?.focus ?? null
  }

  return targets.find((target) => target.id === groupId)?.focus ?? null
}

export const MANDARIN_COVERAGE_PRODUCT_STATUS = COVERAGE_STATUS
