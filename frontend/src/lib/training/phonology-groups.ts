import PHONOLOGY_INDEX from '@/lib/corpus/generated/mandarin-phonology-index.json'
import type { MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'


export const PHONOLOGY_GROUP_IDS = [
  'all',
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
export type PhonologyTargetGroupId = Exclude<PhonologyGroupId, 'all'>

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

export const PHONOLOGY_GROUPS: PhonologyGroupMeta[] = [
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

  return exercises.filter((exercise) => (
    getPhonologyExerciseTargets(exercise.id).some((target) => target.id === groupId)
  ))
}

export function getPhonologyFocusForGroup(
  exerciseId: string,
  groupId: PhonologyGroupId,
): string | null {
  const targets = getPhonologyExerciseTargets(exerciseId)
  if (groupId === 'all') {
    return targets[0]?.focus ?? null
  }

  return targets.find((target) => target.id === groupId)?.focus ?? null
}
