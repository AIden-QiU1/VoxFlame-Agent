'use client'

export type TrainingEtiology =
  | 'unknown'
  | 'stroke'
  | 'parkinsons'
  | 'cerebral_palsy'
  | 'brain_injury'
  | 'hearing_loss'
  | 'neuromuscular'
  | 'other'

export type TrainingSeverity = 'unsure' | 'mild' | 'moderate' | 'severe'

export type TrainingPriority =
  | 'articulation'
  | 'breath_voice'
  | 'rate_prosody'

export interface TrainingGuidanceProfile {
  etiology: TrainingEtiology
  severity: TrainingSeverity
  priority: TrainingPriority
}

export interface TrainingGuidanceContext {
  priorityLabel: string
  evidenceSummary: string
  coachingPlan: string[]
}

export interface PersistedTrainingGuidanceProfileLike {
  etiology?: unknown
  severity?: unknown
}

export const DEFAULT_TRAINING_GUIDANCE_PROFILE: TrainingGuidanceProfile = {
  etiology: 'unknown',
  severity: 'unsure',
  priority: 'articulation',
}

export const TRAINING_ETIOLOGY_OPTIONS: Array<{
  value: TrainingEtiology
  label: string
}> = [
  { value: 'unknown', label: '暂不确定' },
  { value: 'stroke', label: '脑卒中 / 脑梗 / 脑出血后' },
  { value: 'parkinsons', label: '帕金森或运动障碍相关' },
  { value: 'cerebral_palsy', label: '脑瘫或儿童期运动障碍延续' },
  { value: 'brain_injury', label: '脑外伤 / 术后 / 其他神经损伤' },
  { value: 'hearing_loss', label: '听力相关' },
  { value: 'neuromuscular', label: '肌肉退化 / 神经肌肉相关' },
  { value: 'other', label: '其他或混合原因' },
]

export const TRAINING_SEVERITY_OPTIONS: Array<{
  value: TrainingSeverity
  label: string
}> = [
  { value: 'unsure', label: '暂不确定' },
  { value: 'mild', label: '轻度：熟人多半能听懂' },
  { value: 'moderate', label: '中度：熟人能猜到，陌生人常常听不全' },
  { value: 'severe', label: '重度：短句也常需要重复或辅助' },
]

const TRAINING_ETIOLOGY_LABEL_MAP = Object.fromEntries(
  TRAINING_ETIOLOGY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TrainingEtiology, string>

const TRAINING_SEVERITY_LABEL_MAP = Object.fromEntries(
  TRAINING_SEVERITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TrainingSeverity, string>

export const TRAINING_PRIORITY_OPTIONS: Array<{
  value: TrainingPriority
  label: string
}> = [
  { value: 'articulation', label: '咬字和发音位置' },
  { value: 'breath_voice', label: '气息、声音、响度' },
  { value: 'rate_prosody', label: '语速、停顿、节奏' },
]

const STORAGE_PREFIX = 'voxflame_training_labels_'

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readEtiology(value: unknown): TrainingEtiology {
  return TRAINING_ETIOLOGY_OPTIONS.some((option) => option.value === value)
    ? (value as TrainingEtiology)
    : DEFAULT_TRAINING_GUIDANCE_PROFILE.etiology
}

function readSeverity(value: unknown): TrainingSeverity {
  return TRAINING_SEVERITY_OPTIONS.some((option) => option.value === value)
    ? (value as TrainingSeverity)
    : DEFAULT_TRAINING_GUIDANCE_PROFILE.severity
}

function readPriority(value: unknown): TrainingPriority {
  return TRAINING_PRIORITY_OPTIONS.some((option) => option.value === value)
    ? (value as TrainingPriority)
    : DEFAULT_TRAINING_GUIDANCE_PROFILE.priority
}


export function getTrainingEtiologyLabel(value: TrainingEtiology): string {
  return TRAINING_ETIOLOGY_LABEL_MAP[value]
}

export function getTrainingSeverityLabel(value: TrainingSeverity): string {
  return TRAINING_SEVERITY_LABEL_MAP[value]
}

export function applyPersistedTrainingGuidanceProfile(
  baseProfile: TrainingGuidanceProfile,
  persistedProfile?: PersistedTrainingGuidanceProfileLike | null,
): TrainingGuidanceProfile {
  const nextEtiology = readEtiology(persistedProfile?.etiology)
  const nextSeverity = readSeverity(persistedProfile?.severity)

  return {
    etiology:
      baseProfile.etiology !== DEFAULT_TRAINING_GUIDANCE_PROFILE.etiology
        ? baseProfile.etiology
        : nextEtiology,
    severity:
      baseProfile.severity !== DEFAULT_TRAINING_GUIDANCE_PROFILE.severity
        ? baseProfile.severity
        : nextSeverity,
    priority: readPriority(baseProfile.priority),
  }
}

export function getTrainingGuidanceProfile(userId: string): TrainingGuidanceProfile {
  if (typeof window === 'undefined') {
    return DEFAULT_TRAINING_GUIDANCE_PROFILE
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) {
      return DEFAULT_TRAINING_GUIDANCE_PROFILE
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return DEFAULT_TRAINING_GUIDANCE_PROFILE
    }

    return {
      etiology: readEtiology(parsed.etiology),
      severity: readSeverity(parsed.severity),
      priority: readPriority(parsed.priority),
    }
  } catch {
    return DEFAULT_TRAINING_GUIDANCE_PROFILE
  }
}

export function saveTrainingGuidanceProfile(
  userId: string,
  profile: TrainingGuidanceProfile,
): TrainingGuidanceProfile {
  const normalized = {
    etiology: readEtiology(profile.etiology),
    severity: readSeverity(profile.severity),
    priority: readPriority(profile.priority),
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(normalized))
  }

  return normalized
}

export function buildTrainingGuidanceContext(
  profile: TrainingGuidanceProfile,
): TrainingGuidanceContext {
  const severityHint =
    profile.severity === 'severe'
      ? '这次只抓一个点，句子要更短。'
      : profile.severity === 'moderate'
        ? '先把关键词说稳，再连回整句。'
        : '在整句里保留自然节奏，但只改最明显的一处。'

  if (profile.priority === 'breath_voice') {
    return {
      priorityLabel: '气息、声音、响度',
      evidenceSummary:
        '优先看呼吸支持、响度和每口气能说多长。建议短句分组、坐直、先做持续发声再回整句。',
      coachingPlan: [
        '先坐直，吸气后只说一小段，不要一口气撑整句。',
        '先把关键词说得更响更稳，再回整句。',
        severityHint,
      ],
    }
  }

  if (profile.priority === 'rate_prosody') {
    return {
      priorityLabel: '语速、停顿、节奏',
      evidenceSummary:
        '优先看语速、停顿和重音是否帮助别人听懂。建议放慢、分组停顿、把关键词重一点。',
      coachingPlan: [
        '把句子拆成两小段，中间停一下再接。',
        '关键词说慢一点、重一点，别整句一个速度滑过去。',
        severityHint,
      ],
    }
  }

  return {
    priorityLabel: '咬字和发音位置',
    evidenceSummary:
      '优先看口型、舌位和辅音对比。建议只抓一组最容易混的音，用更大的口部动作完成清晰发音。',
    coachingPlan: [
      '先只盯一个最容易混的字或音节。',
      '嘴巴动作做大一点，把嘴唇或舌尖的位置摆清楚。',
      severityHint,
    ],
  }
}
