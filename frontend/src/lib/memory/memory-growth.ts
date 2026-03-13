import type { Memory, Session } from '@/lib/memory/memory-service'

export type FeedbackStatus = 'excellent' | 'close' | 'retry' | 'unclear'
export type ImprovementDirection = 'improving' | 'stable' | 'declining'

export interface TrainingMemoryMetadata {
  kind?: string
  exercise_id?: string
  exercise_category?: string
  recognized_text?: string
  feedback_status?: FeedbackStatus
  clarity_score?: number
  keywords?: string[]
  focus_tags?: string[]
  focus_syllables?: string[]
  articulation_tips?: string[]
  target_pinyin?: string
  heard_pinyin?: string
  pronunciation_initial_pairs?: string[]
  pronunciation_final_pairs?: string[]
  pronunciation_tone_pairs?: string[]
  pronunciation_targets?: string[]
  pronunciation_summary?: string
  sessionId?: string
  sessionKind?: string
  sessionSource?: string
  sessionStartedAt?: number
  sessionEndedAt?: number
  sessionDurationSeconds?: number
  sessionTurnCount?: number
}

export interface MemoryLabelCount {
  label: string
  count: number
}

export interface MemorySessionSummary {
  id: string
  kind: string
  source: string
  startedAt: number
  endedAt?: number
  durationSeconds: number
  turnCount: number
  memoryCount: number
  trainingAttempts: number
  avgClarityScore: number
  topFocusTags: string[]
  topFocusSyllables: string[]
  topInitialPairs: string[]
  topFinalPairs: string[]
  topTonePairs: string[]
}

export interface MemoryTrendPoint {
  date: string
  sessionCount: number
  memoryCount: number
  trainingAttempts: number
  excellent: number
  close: number
  retry: number
  unclear: number
  avgClarityScore: number
}

export interface MemoryGrowthStats {
  totalSessions: number
  totalTurns: number
  totalMemories: number
  totalTrainingAttempts: number
  totalExpressionMemories: number
  totalDurationSeconds: number
  avgSessionDurationSeconds: number
  activeDays: number
  lastSessionAt: number | null
  currentTrainingStreak: number
  bestTrainingStreak: number
  rollingClarityAverage: number
  improvementSlope: number
  improvementDirection: ImprovementDirection
  totalConfusionPatterns: number
}

export interface MemoryGrowthProfile {
  stats: MemoryGrowthStats
  memories: Memory[]
  trainingMemories: Memory[]
  expressionMemories: Memory[]
  recentTraining: Memory[]
  recentSessions: MemorySessionSummary[]
  frequentExpressions: MemoryLabelCount[]
  frequentFocus: MemoryLabelCount[]
  frequentSyllables: MemoryLabelCount[]
  frequentInitialPairs: MemoryLabelCount[]
  frequentFinalPairs: MemoryLabelCount[]
  frequentTonePairs: MemoryLabelCount[]
  frequentConfusions: MemoryLabelCount[]
  articulationTips: MemoryLabelCount[]
  statusCounts: Record<FeedbackStatus, number>
  hotwords: string[]
  trends: MemoryTrendPoint[]
  nextStep: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(record: Record<string, unknown> | undefined, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | null {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function statusToClarityScore(
  status: FeedbackStatus,
  explicitScore?: number | null,
): number {
  if (typeof explicitScore === 'number' && Number.isFinite(explicitScore)) {
    return Math.max(0, Math.min(1, explicitScore))
  }

  if (status === 'excellent') {
    return 0.95
  }

  if (status === 'close') {
    return 0.75
  }

  if (status === 'retry') {
    return 0.45
  }

  return 0.2
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildLinearSlope(values: number[]): number {
  if (values.length < 2) {
    return 0
  }

  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (let index = 0; index < n; index += 1) {
    const x = index
    const y = values[index]
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) {
    return 0
  }

  return (n * sumXY - sumX * sumY) / denominator
}

function getImprovementDirection(slope: number): ImprovementDirection {
  if (slope >= 0.03) {
    return 'improving'
  }

  if (slope <= -0.03) {
    return 'declining'
  }

  return 'stable'
}

function buildTrainingStreaks(trainingMemories: Memory[]): {
  currentTrainingStreak: number
  bestTrainingStreak: number
} {
  const dayKeys = Array.from(new Set(trainingMemories.map((memory) => toDayKey(memory.createdAt)))).sort()

  if (dayKeys.length === 0) {
    return {
      currentTrainingStreak: 0,
      bestTrainingStreak: 0,
    }
  }

  let bestTrainingStreak = 1
  let running = 1

  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = new Date(`${dayKeys[index - 1]}T00:00:00.000Z`).getTime()
    const current = new Date(`${dayKeys[index]}T00:00:00.000Z`).getTime()
    const diffDays = Math.round((current - previous) / 86_400_000)

    if (diffDays === 1) {
      running += 1
      bestTrainingStreak = Math.max(bestTrainingStreak, running)
    } else if (diffDays > 1) {
      running = 1
    }
  }

  const latestDay = new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00.000Z`).getTime()
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const latestGap = Math.round((todayUtc - latestDay) / 86_400_000)

  if (latestGap > 1) {
    return {
      currentTrainingStreak: 0,
      bestTrainingStreak,
    }
  }

  let currentTrainingStreak = 1
  for (let index = dayKeys.length - 1; index > 0; index -= 1) {
    const current = new Date(`${dayKeys[index]}T00:00:00.000Z`).getTime()
    const previous = new Date(`${dayKeys[index - 1]}T00:00:00.000Z`).getTime()
    const diffDays = Math.round((current - previous) / 86_400_000)

    if (diffDays === 1) {
      currentTrainingStreak += 1
      continue
    }

    break
  }

  return {
    currentTrainingStreak,
    bestTrainingStreak,
  }
}

function countValues(values: string[], limit?: number): MemoryLabelCount[] {
  const counts = new Map<string, number>()

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) {
      continue
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  const results = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)

  return typeof limit === 'number' ? results.slice(0, limit) : results
}

function toTrainingMetadata(memory: Memory): TrainingMemoryMetadata {
  return isRecord(memory.metadata) ? (memory.metadata as TrainingMemoryMetadata) : {}
}

function getMemorySessionId(memory: Memory): string | null {
  const metadata = toTrainingMetadata(memory)
  return metadata.sessionId ?? null
}

function toDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function buildMemorySignature(memory: Memory): string {
  const metadata = toTrainingMetadata(memory)
  return [
    memory.content,
    memory.createdAt,
    metadata.kind ?? '',
    metadata.sessionId ?? '',
  ].join('::')
}

export function mergeMemoryCollections(localMemories: Memory[], remoteMemories: Memory[]): Memory[] {
  const merged = new Map<string, Memory>()

  for (const memory of [...remoteMemories, ...localMemories]) {
    merged.set(buildMemorySignature(memory), memory)
  }

  return Array.from(merged.values()).sort((left, right) => right.createdAt - left.createdAt)
}

function mergeSessionMetadata(
  base: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base && !next) {
    return undefined
  }

  return {
    ...(base ?? {}),
    ...(next ?? {}),
  }
}

export function mergeSessionCollections(localSessions: Session[], remoteSessions: Session[]): Session[] {
  const merged = new Map<string, Session>()

  for (const session of [...remoteSessions, ...localSessions]) {
    const existing = merged.get(session.id)
    if (!existing) {
      merged.set(session.id, session)
      continue
    }

    merged.set(session.id, {
      ...existing,
      ...session,
      turns: session.turns.length >= existing.turns.length ? session.turns : existing.turns,
      metadata: mergeSessionMetadata(existing.metadata, session.metadata),
    })
  }

  return Array.from(merged.values()).sort((left, right) => right.startTime - left.startTime)
}

function buildNextStep(
  frequentInitialPairs: MemoryLabelCount[],
  frequentFinalPairs: MemoryLabelCount[],
  frequentTonePairs: MemoryLabelCount[],
  frequentSyllables: MemoryLabelCount[],
  frequentFocus: MemoryLabelCount[],
  improvementDirection: ImprovementDirection,
): string {
  if (frequentInitialPairs[0]) {
    return `下一步先盯住声母 ${frequentInitialPairs[0].label}，拆到单音节慢练 2 到 3 次，再回到整句。`
  }

  if (frequentFinalPairs[0]) {
    return `下一步先盯住韵母 ${frequentFinalPairs[0].label}，把口型和收尾做稳，再回到整句。`
  }

  if (frequentTonePairs[0]) {
    return `下一步先把声调 ${frequentTonePairs[0].label} 单独拉开，避免一口气冲过去。`
  }

  if (frequentSyllables[0]) {
    return `下一步先继续盯住 ${frequentSyllables[0].label}，把它单独慢练 2 到 3 次，再回到整句。`
  }

  if (frequentFocus[0]) {
    return `下一步先围绕 ${frequentFocus[0].label} 做短句重复，不要同时改太多点。`
  }

  if (improvementDirection === 'declining') {
    return '最近有一点回落，先缩回到最熟的一条句子，把节奏和清晰度重新拉稳。'
  }

  return '先从一条最常用的句子开始，重复练到系统稳定听清，再慢慢加长。'
}

function buildSessionSummaries(memories: Memory[], sessions: Session[]): MemorySessionSummary[] {
  const memoryGroups = new Map<string, Memory[]>()

  for (const memory of memories) {
    const sessionId = getMemorySessionId(memory)
    if (!sessionId) {
      continue
    }

    const group = memoryGroups.get(sessionId) ?? []
    group.push(memory)
    memoryGroups.set(sessionId, group)
  }

  const summaries = new Map<string, MemorySessionSummary>()

  for (const session of sessions) {
    const metadata = isRecord(session.metadata) ? session.metadata : undefined
    const memoriesInSession = memoryGroups.get(session.id) ?? []
    const trainingInSession = memoriesInSession.filter(
      (memory) => toTrainingMetadata(memory).kind === 'training_result',
    )
    const durationSeconds =
      session.endTime && session.startTime
        ? Math.max(0, Math.round((session.endTime - session.startTime) / 1000))
        : readNumber(metadata, 'durationSeconds') ??
          readNumber(metadata, 'sessionDurationSeconds') ??
          0
    const clarityScores = trainingInSession.map((memory) => {
      const trainingMetadata = toTrainingMetadata(memory)
      return statusToClarityScore(
        trainingMetadata.feedback_status ?? 'unclear',
        readNumber(trainingMetadata as Record<string, unknown>, 'clarity_score'),
      )
    })

    summaries.set(session.id, {
      id: session.id,
      kind: readString(metadata, 'kind') ?? 'general',
      source: readString(metadata, 'source') ?? 'local_memory',
      startedAt: session.startTime,
      endedAt: session.endTime,
      durationSeconds,
      turnCount:
        session.turns.length ||
        readNumber(metadata, 'turnCount') ||
        readNumber(metadata, 'sessionTurnCount') ||
        0,
      memoryCount: memoriesInSession.length,
      trainingAttempts: trainingInSession.length,
      avgClarityScore: average(clarityScores),
      topFocusTags: countValues(
        trainingInSession.flatMap((memory) => toTrainingMetadata(memory).focus_tags ?? []),
        3,
      ).map((item) => item.label),
      topFocusSyllables: countValues(
        trainingInSession.flatMap((memory) => toTrainingMetadata(memory).focus_syllables ?? []),
        4,
      ).map((item) => item.label),
      topInitialPairs: countValues(
        trainingInSession.flatMap((memory) => toTrainingMetadata(memory).pronunciation_initial_pairs ?? []),
        3,
      ).map((item) => item.label),
      topFinalPairs: countValues(
        trainingInSession.flatMap((memory) => toTrainingMetadata(memory).pronunciation_final_pairs ?? []),
        3,
      ).map((item) => item.label),
      topTonePairs: countValues(
        trainingInSession.flatMap((memory) => toTrainingMetadata(memory).pronunciation_tone_pairs ?? []),
        3,
      ).map((item) => item.label),
    })
  }

  for (const [sessionId, memoriesInSession] of Array.from(memoryGroups.entries())) {
    if (summaries.has(sessionId)) {
      continue
    }

    const firstMemory = memoriesInSession.reduce((earliest: Memory, memory: Memory) =>
      memory.createdAt < earliest.createdAt ? memory : earliest,
    )
    const lastMemory = memoriesInSession.reduce((latest: Memory, memory: Memory) =>
      memory.createdAt > latest.createdAt ? memory : latest,
    )
    const firstMetadata = toTrainingMetadata(firstMemory)
    const trainingInSession = memoriesInSession.filter(
      (memory: Memory) => toTrainingMetadata(memory).kind === 'training_result',
    )
    const clarityScores = trainingInSession.map((memory: Memory) => {
      const trainingMetadata = toTrainingMetadata(memory)
      return statusToClarityScore(
        trainingMetadata.feedback_status ?? 'unclear',
        readNumber(trainingMetadata as Record<string, unknown>, 'clarity_score'),
      )
    })

    summaries.set(sessionId, {
      id: sessionId,
      kind: firstMetadata.sessionKind ?? 'general',
      source: firstMetadata.sessionSource ?? 'local_memory',
      startedAt: firstMetadata.sessionStartedAt ?? firstMemory.createdAt,
      endedAt: firstMetadata.sessionEndedAt ?? lastMemory.createdAt,
      durationSeconds:
        firstMetadata.sessionDurationSeconds ??
        Math.max(0, Math.round((lastMemory.createdAt - firstMemory.createdAt) / 1000)),
      turnCount: firstMetadata.sessionTurnCount ?? 0,
      memoryCount: memoriesInSession.length,
      trainingAttempts: trainingInSession.length,
      avgClarityScore: average(clarityScores),
      topFocusTags: countValues(
        trainingInSession.flatMap((memory: Memory) => toTrainingMetadata(memory).focus_tags ?? []),
        3,
      ).map((item) => item.label),
      topFocusSyllables: countValues(
        trainingInSession.flatMap((memory: Memory) => toTrainingMetadata(memory).focus_syllables ?? []),
        4,
      ).map((item) => item.label),
      topInitialPairs: countValues(
        trainingInSession.flatMap((memory: Memory) => toTrainingMetadata(memory).pronunciation_initial_pairs ?? []),
        3,
      ).map((item) => item.label),
      topFinalPairs: countValues(
        trainingInSession.flatMap((memory: Memory) => toTrainingMetadata(memory).pronunciation_final_pairs ?? []),
        3,
      ).map((item) => item.label),
      topTonePairs: countValues(
        trainingInSession.flatMap((memory: Memory) => toTrainingMetadata(memory).pronunciation_tone_pairs ?? []),
        3,
      ).map((item) => item.label),
    })
  }

  return Array.from(summaries.values()).sort((left, right) => right.startedAt - left.startedAt)
}

function buildTrendPoints(
  memories: Memory[],
  sessions: MemorySessionSummary[],
): MemoryTrendPoint[] {
  const points = new Map<string, MemoryTrendPoint & { clarityTotal: number; claritySamples: number }>()

  for (const session of sessions) {
    const key = toDayKey(session.startedAt)
    const point = points.get(key) ?? {
      date: key,
      sessionCount: 0,
      memoryCount: 0,
      trainingAttempts: 0,
      excellent: 0,
      close: 0,
      retry: 0,
      unclear: 0,
      avgClarityScore: 0,
      clarityTotal: 0,
      claritySamples: 0,
    }
    point.sessionCount += 1
    points.set(key, point)
  }

  for (const memory of memories) {
    const key = toDayKey(memory.createdAt)
    const point = points.get(key) ?? {
      date: key,
      sessionCount: 0,
      memoryCount: 0,
      trainingAttempts: 0,
      excellent: 0,
      close: 0,
      retry: 0,
      unclear: 0,
      avgClarityScore: 0,
      clarityTotal: 0,
      claritySamples: 0,
    }
    point.memoryCount += 1

    const metadata = toTrainingMetadata(memory)
    if (metadata.kind === 'training_result') {
      point.trainingAttempts += 1
      if (metadata.feedback_status) {
        point[metadata.feedback_status] += 1
        point.clarityTotal += statusToClarityScore(
          metadata.feedback_status,
          readNumber(metadata as Record<string, unknown>, 'clarity_score'),
        )
        point.claritySamples += 1
      }
    }

    points.set(key, point)
  }

  return Array.from(points.values())
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8)
    .map((point) => ({
      date: point.date,
      sessionCount: point.sessionCount,
      memoryCount: point.memoryCount,
      trainingAttempts: point.trainingAttempts,
      excellent: point.excellent,
      close: point.close,
      retry: point.retry,
      unclear: point.unclear,
      avgClarityScore: point.claritySamples > 0 ? point.clarityTotal / point.claritySamples : 0,
    }))
}

export function buildMemoryGrowthProfile(params: {
  memories: Memory[]
  sessions: Session[]
  hotwords?: string[]
}): MemoryGrowthProfile {
  const memories = [...params.memories].sort((left, right) => right.createdAt - left.createdAt)
  const sessions = mergeSessionCollections(params.sessions, [])
  const sessionSummaries = buildSessionSummaries(memories, sessions)
  const trainingMemories = memories.filter((memory) => toTrainingMetadata(memory).kind === 'training_result')
  const expressionMemories = memories.filter((memory) => toTrainingMetadata(memory).kind !== 'training_result')
  const frequentExpressions = countValues(expressionMemories.map((memory) => memory.content), 5)
  const frequentFocus = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).focus_tags ?? []),
    5,
  )
  const frequentSyllables = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).focus_syllables ?? []),
    6,
  )
  const frequentInitialPairs = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).pronunciation_initial_pairs ?? []),
    6,
  )
  const frequentFinalPairs = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).pronunciation_final_pairs ?? []),
    6,
  )
  const frequentTonePairs = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).pronunciation_tone_pairs ?? []),
    6,
  )
  const frequentConfusions = countValues(
    trainingMemories.flatMap((memory) => {
      const metadata = toTrainingMetadata(memory)
      return [
        ...(metadata.pronunciation_initial_pairs ?? []).map((item) => `声母 ${item}`),
        ...(metadata.pronunciation_final_pairs ?? []).map((item) => `韵母 ${item}`),
        ...(metadata.pronunciation_tone_pairs ?? []).map((item) => `声调 ${item}`),
      ]
    }),
    8,
  )
  const articulationTips = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).articulation_tips ?? []),
    4,
  )
  const keywordHotwords = countValues(
    trainingMemories.flatMap((memory) => toTrainingMetadata(memory).keywords ?? []),
  ).map((item) => item.label)
  const hotwords = Array.from(new Set([...(params.hotwords ?? []), ...keywordHotwords])).slice(0, 12)

  const totalTurns = sessions.reduce((sum, session) => sum + session.turns.length, 0)
  const totalDurationSeconds = sessionSummaries.reduce((sum, session) => sum + session.durationSeconds, 0)
  const activeDays = new Set([
    ...memories.map((memory) => toDayKey(memory.createdAt)),
    ...sessionSummaries.map((session) => toDayKey(session.startedAt)),
  ]).size
  const lastSessionAt = sessionSummaries[0]?.startedAt ?? memories[0]?.createdAt ?? null
  const trainingScores = [...trainingMemories]
    .sort((left, right) => left.createdAt - right.createdAt)
    .map((memory) => {
      const metadata = toTrainingMetadata(memory)
      return statusToClarityScore(
        metadata.feedback_status ?? 'unclear',
        readNumber(metadata as Record<string, unknown>, 'clarity_score'),
      )
    })
  const recentScores = trainingScores.slice(-7)
  const rollingClarityAverage = average(recentScores)
  const improvementSlope = Number(buildLinearSlope(trainingScores.slice(-12)).toFixed(4))
  const improvementDirection = getImprovementDirection(improvementSlope)
  const { currentTrainingStreak, bestTrainingStreak } = buildTrainingStreaks(trainingMemories)

  const statusCounts: Record<FeedbackStatus, number> = {
    excellent: trainingMemories.filter(
      (memory) => toTrainingMetadata(memory).feedback_status === 'excellent',
    ).length,
    close: trainingMemories.filter(
      (memory) => toTrainingMetadata(memory).feedback_status === 'close',
    ).length,
    retry: trainingMemories.filter(
      (memory) => toTrainingMetadata(memory).feedback_status === 'retry',
    ).length,
    unclear: trainingMemories.filter(
      (memory) => toTrainingMetadata(memory).feedback_status === 'unclear',
    ).length,
  }

  return {
    stats: {
      totalSessions: sessionSummaries.length,
      totalTurns,
      totalMemories: memories.length,
      totalTrainingAttempts: trainingMemories.length,
      totalExpressionMemories: expressionMemories.length,
      totalDurationSeconds,
      avgSessionDurationSeconds:
        sessionSummaries.length > 0 ? totalDurationSeconds / sessionSummaries.length : 0,
      activeDays,
      lastSessionAt,
      currentTrainingStreak,
      bestTrainingStreak,
      rollingClarityAverage,
      improvementSlope,
      improvementDirection,
      totalConfusionPatterns: frequentConfusions.length,
    },
    memories,
    trainingMemories,
    expressionMemories,
    recentTraining: trainingMemories.slice(0, 6),
    recentSessions: sessionSummaries.slice(0, 6),
    frequentExpressions,
    frequentFocus,
    frequentSyllables,
    frequentInitialPairs,
    frequentFinalPairs,
    frequentTonePairs,
    frequentConfusions,
    articulationTips,
    statusCounts,
    hotwords,
    trends: buildTrendPoints(memories, sessionSummaries),
    nextStep: buildNextStep(
      frequentInitialPairs,
      frequentFinalPairs,
      frequentTonePairs,
      frequentSyllables,
      frequentFocus,
      improvementDirection,
    ),
  }
}
