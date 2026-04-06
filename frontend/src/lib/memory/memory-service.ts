// Memory Service

import { config } from '@/lib/config'
import { getValidToken } from '@/lib/supabase/client'
import {
  buildTrainingVoiceProfilePayload,
  getTrainingProfileSnapshot,
} from '@/lib/training/training-profile'
import { getTrainingGuidanceProfile } from '@/lib/training/training-guidance-profile'

export type MemoryType = 'episodic' | 'semantic' | 'skill' | 'voice_profile'

export interface ConversationTurn {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  originalText?: string
  timestamp: number
  sessionId: string
}

export interface Memory {
  id: string
  userId: string
  type: MemoryType
  content: string
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface Session {
  id: string
  userId: string
  startTime: number
  endTime?: number
  turns: ConversationTurn[]
  metadata?: Record<string, unknown>
}

export interface CreateMemoryInput {
  type?: MemoryType
  content: string
  metadata?: Record<string, unknown>
  createdAt?: number
  sessionMetadata?: Record<string, unknown>
}

export type HotwordCategory =
  | 'medical'
  | 'profession'
  | 'family'
  | 'daily'
  | 'emergency'
  | 'custom'

export interface HotwordProfile {
  id: string
  phrase: string
  category: HotwordCategory
  scenario: string
  note?: string
  createdAt: number
  updatedAt: number
}

export interface HotwordProfileInput {
  id?: string
  phrase: string
  category: HotwordCategory
  scenario?: string
  note?: string
}

const KEYS = {
  MEMORIES: 'voxflame_memories',
  SESSIONS: 'voxflame_sessions',
  CURRENT: 'voxflame_current_session',
  QUEUE: 'voxflame_sync_queue',
  SESSION_QUEUE: 'voxflame_session_sync_queue',
  HOTWORDS: 'voxflame_hotword_profiles',
  PREFIX: 'voxflame_user_',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function getSyncSessionId(metadata?: Record<string, unknown>): string {
  const candidate = metadata?.sessionId
  if (typeof candidate === 'string' && UUID_PATTERN.test(candidate)) {
    return candidate
  }

  return genId()
}

function normalizeHotwordCategory(value: unknown): HotwordCategory {
  if (
    value === 'medical' ||
    value === 'profession' ||
    value === 'family' ||
    value === 'daily' ||
    value === 'emergency'
  ) {
    return value
  }

  return 'custom'
}

function normalizeHotwordProfiles(value: unknown): HotwordProfile[] {
  if (!Array.isArray(value)) {
    return []
  }

  const profiles: HotwordProfile[] = []

  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const phrase = readString(item, 'phrase')
    if (!phrase) {
      continue
    }

    const createdAt = readNumber(item, 'createdAt') ?? Date.now()
    const updatedAt = readNumber(item, 'updatedAt') ?? createdAt

    profiles.push({
      id: readString(item, 'id') ?? genId(),
      phrase,
      category: normalizeHotwordCategory(readString(item, 'category')),
      scenario: readString(item, 'scenario') ?? '',
      note: readString(item, 'note') ?? undefined,
      createdAt,
      updatedAt,
    })
  }

  return profiles.sort((left, right) => right.updatedAt - left.updatedAt)
}

const userKey = (uid: string, k: string) => `${KEYS.PREFIX}${uid}_${k}`
const parseJson = <T>(s: string | null, d: T): T => s ? JSON.parse(s) : d

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function mergeMetadata(
  base: Record<string, unknown> | undefined,
  updates: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base && !updates) {
    return undefined
  }

  return {
    ...(base ?? {}),
    ...(updates ?? {}),
  }
}

function dedupeStrings(values: Array<string | null | undefined>, limit?: number): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    results.push(normalized)

    if (typeof limit === 'number' && results.length >= limit) {
      break
    }
  }

  return results
}

export interface SessionCompactionMemoryInput {
  type: MemoryType
  content: string
  metadata: Record<string, unknown>
  createdAt?: number
}

export function buildSessionCompactionMemoryInput(session: Session): SessionCompactionMemoryInput | null {
  const metadata = isRecord(session.metadata) ? session.metadata : undefined
  const latestCorrectionOriginal = readString(metadata, 'latestCorrectionOriginal')
  const latestCorrectionText = readString(metadata, 'latestCorrectionText')
  const trainingSummary = readString(metadata, 'lastTrainingFeedbackSummary')
  const nextStep = readString(metadata, 'lastTrainingFeedbackNextStep')
  const scene = readString(metadata, 'communicationScene') ?? readString(metadata, 'scene')
  const clarityScore = readNumber(metadata, 'clarity_score')
  const pronunciationTargets = Array.isArray(metadata?.lastTrainingPronunciationTargets)
    ? metadata.lastTrainingPronunciationTargets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const focusSyllables = Array.isArray(metadata?.lastTrainingFocusSyllables)
    ? metadata.lastTrainingFocusSyllables.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const articulationTips = Array.isArray(metadata?.lastTrainingArticulationTips)
    ? metadata.lastTrainingArticulationTips.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const interruptionCount = readNumber(metadata, 'interruptionCount') ?? 0
  const bargeInCount = readNumber(metadata, 'bargeInCount') ?? 0
  const sessionTurnCount = session.turns.length

  const fallbackPhrases = dedupeStrings([
    latestCorrectionText,
  ], 3)
  const riskyTerms = dedupeStrings([
    latestCorrectionOriginal,
  ], 3)
  const pronunciationPatterns = dedupeStrings([
    ...focusSyllables,
    ...articulationTips,
  ], 6)
  const supportStrategies = dedupeStrings([
    ...articulationTips,
    nextStep,
    latestCorrectionText && latestCorrectionOriginal && latestCorrectionText !== latestCorrectionOriginal
      ? '现场如果系统听偏，优先切回更稳的改写版本。'
      : null,
  ], 4)
  const hotwords = dedupeStrings(pronunciationTargets, 6)

  const content = (() => {
    if (latestCorrectionOriginal && latestCorrectionText && latestCorrectionOriginal !== latestCorrectionText) {
      return `这次会话里，系统更容易把“${latestCorrectionOriginal}”听偏。当前更稳的表达是“${latestCorrectionText}”。`
    }

    if (trainingSummary) {
      return trainingSummary
    }

    if (supportStrategies[0]) {
      return `这次会话暴露出的关键准备点是：${supportStrategies[0]}`
    }

    if (pronunciationPatterns[0]) {
      return `这次会话里最值得继续盯住的是“${pronunciationPatterns[0]}”。`
    }

    return null
  })()

  if (!content) {
    return null
  }

  return {
    type: 'semantic',
    content,
    createdAt: session.endTime ?? Date.now(),
    metadata: {
      kind: 'session_compaction',
      scene: scene ?? undefined,
      clarity_score: clarityScore ?? undefined,
      risky_terms: riskyTerms,
      fallback_phrases: fallbackPhrases,
      pronunciation_patterns: pronunciationPatterns,
      support_strategies: supportStrategies,
      hotwords,
      latest_correction_original: latestCorrectionOriginal ?? undefined,
      latest_correction_text: latestCorrectionText ?? undefined,
      interruption_count: interruptionCount,
      barge_in_count: bargeInCount,
      next_step: nextStep ?? undefined,
      session_turn_count: sessionTurnCount,
      summary: content,
    },
  }
}

class MemoryService {
  private session: Session | null = null
  private userId: string | null = null
  private queue: Memory[] = []
  private sessionQueue: Session[] = []

  init(userId: string) {
    if (this.userId && this.userId !== userId) {
      this.session = null
      this.queue = []
      this.sessionQueue = []
    }
    this.userId = userId
    this.loadSession()
    this.loadQueue()
    this.loadSessionQueue()
    if (this.queue.length || this.sessionQueue.length) {
      void this.syncBackend()
    }
  }

  getSession(): Session {
    if (!this.session) this.startSession()
    return this.session!
  }

  peekSession(): Session | null {
    return this.session
  }

  startSession(options: { metadata?: Record<string, unknown> } = {}): Session {
    this.session = {
      id: genId(),
      userId: this.userId || 'anon',
      startTime: Date.now(),
      turns: [],
      metadata: options.metadata,
    }
    this.saveSession()
    return this.session
  }

  updateCurrentSessionMetadata(metadata: Record<string, unknown>) {
    if (!this.session) {
      this.startSession({ metadata })
      return
    }

    this.session = {
      ...this.session,
      metadata: mergeMetadata(this.session.metadata, metadata),
    }
    this.saveSession()
  }

  async endSession() {
    if (!this.session) return
    this.session.endTime = Date.now()
    const shouldPersistSession =
      this.session.turns.length > 0 || this.hasStoredMemoriesForSession(this.session.id)
    if (shouldPersistSession) {
      this.saveToHistory(this.session)
      this.enqueueSessionForSync(this.session)
    }
    await this.extractMemories(this.session)
    this.extractSessionCompaction(this.session)
    await this.syncBackend()
    this.session = null
    localStorage.removeItem(userKey(this.userId!, KEYS.CURRENT))
  }

  addTurn(role: 'user' | 'assistant', content: string, opts?: { originalText?: string }): ConversationTurn {
    const turn = { id: genId(), role, content, originalText: opts?.originalText, timestamp: Date.now(), sessionId: this.getSession().id }
    this.session!.turns.push(turn)
    this.saveSession()
    return turn
  }

  getHistory(limit = 50) { return this.getSession().turns.slice(-limit) }

  getAllSessions(): Session[] {
    if (!this.userId) return []
    return parseJson(localStorage.getItem(userKey(this.userId, KEYS.SESSIONS)), [])
  }

  search(query: string, limit = 10): Memory[] {
    if (!this.userId) return []
    const memories = parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), [])
    return memories.filter(m => m.content.toLowerCase().includes(query.toLowerCase())).slice(0, limit)
  }

  getRecent(limit = 20): Memory[] {
    if (!this.userId) return []
    return parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), []).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
  }

  getAllMemories(): Memory[] {
    if (!this.userId) return []
    return parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), []).sort((a, b) => b.createdAt - a.createdAt)
  }

  getHotwordProfiles(): HotwordProfile[] {
    if (!this.userId) {
      return []
    }

    const stored = parseJson<unknown>(
      localStorage.getItem(userKey(this.userId, KEYS.HOTWORDS)),
      [],
    )

    return normalizeHotwordProfiles(stored)
  }

  replaceHotwordProfiles(profiles: HotwordProfile[]): HotwordProfile[] {
    if (!this.userId) {
      return []
    }

    const normalized = normalizeHotwordProfiles(profiles)
    localStorage.setItem(
      userKey(this.userId, KEYS.HOTWORDS),
      JSON.stringify(normalized),
    )

    return normalized
  }

  upsertHotwordProfile(input: HotwordProfileInput): HotwordProfile | null {
    if (!this.userId) {
      return null
    }

    const phrase = input.phrase.trim()
    if (!phrase) {
      return null
    }

    const now = Date.now()
    const existing = this.getHotwordProfiles()
    const previous = input.id
      ? existing.find((profile) => profile.id === input.id)
      : undefined
    const nextProfile: HotwordProfile = {
      id: previous?.id ?? input.id ?? genId(),
      phrase,
      category: normalizeHotwordCategory(input.category),
      scenario: input.scenario?.trim() ?? previous?.scenario ?? '',
      note: input.note?.trim() || previous?.note,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }

    const nextProfiles = existing.filter((profile) => profile.id !== nextProfile.id)
    nextProfiles.unshift(nextProfile)
    this.replaceHotwordProfiles(nextProfiles)
    return nextProfile
  }

  deleteHotwordProfile(profileId: string): HotwordProfile[] {
    if (!this.userId) {
      return []
    }

    const nextProfiles = this.getHotwordProfiles().filter(
      (profile) => profile.id !== profileId,
    )
    return this.replaceHotwordProfiles(nextProfiles)
  }

  getHotwordStrings(): string[] {
    return Array.from(
      new Set(this.getHotwordProfiles().map((profile) => profile.phrase)),
    ).slice(0, 20)
  }

  buildVoiceProfileSyncPayload():
    | {
        hotwords: Array<{ word: string; category: HotwordCategory }>
        confusion_patterns?: Record<string, unknown>[]
        clarity_score?: number
        preferences: {
          hotword_profiles: HotwordProfile[]
          training_profile_summary?: Record<string, unknown>
          dominant_training_categories?: string[]
          training_data_volume?: {
            uploaded_recordings: number
            duration_seconds: number
          }
          next_training_step?: string
        }
      }
    | null {
    const profiles = this.getHotwordProfiles()
    const trainingProfile = this.userId ? getTrainingProfileSnapshot(this.userId) : null
    const trainingGuidanceProfile = this.userId
      ? getTrainingGuidanceProfile(this.userId)
      : null
    const trainingVoiceProfile =
      trainingProfile && trainingProfile.totalUploadedRecordings > 0
        ? buildTrainingVoiceProfilePayload(trainingProfile, trainingGuidanceProfile)
        : null

    if (profiles.length === 0 && !trainingVoiceProfile) {
      return null
    }

    const trainingHotwords = Array.isArray(trainingVoiceProfile?.hotwords)
      ? trainingVoiceProfile.hotwords as Array<{ word: string; category: HotwordCategory }>
      : []
    const mergedHotwords = [
      ...profiles.map((profile) => ({
        word: profile.phrase,
        category: profile.category,
      })),
      ...trainingHotwords,
    ]

    return {
      hotwords: mergedHotwords,
      confusion_patterns: Array.isArray(trainingVoiceProfile?.confusion_patterns)
        ? trainingVoiceProfile.confusion_patterns as Record<string, unknown>[]
        : undefined,
      clarity_score:
        typeof trainingVoiceProfile?.clarity_score === 'number'
          ? trainingVoiceProfile.clarity_score
          : undefined,
      preferences: {
        hotword_profiles: profiles,
        ...(trainingVoiceProfile?.preferences as Record<string, unknown> | undefined),
      },
    }
  }

  addMemoryEntry(input: CreateMemoryInput): Memory | null {
    if (!this.userId) return null

    const timestamp = input.createdAt ?? Date.now()
    if (this.session && input.sessionMetadata) {
      this.updateCurrentSessionMetadata(input.sessionMetadata)
    }
    const session = this.session ?? this.startSession({ metadata: input.sessionMetadata })
    const sessionMetadata = mergeMetadata(session.metadata, input.sessionMetadata)
    const sessionKind = readString(sessionMetadata, 'kind') ?? 'general'
    const sessionSource = readString(sessionMetadata, 'source') ?? 'local_memory'
    const metadata = {
      ...(input.metadata ?? {}),
      sessionId: session.id,
      sessionKind,
      sessionSource,
      sessionStartedAt: session.startTime,
      sessionEndedAt: session.endTime,
      sessionDurationSeconds: session.endTime
        ? Math.max(0, Math.round((session.endTime - session.startTime) / 1000))
        : undefined,
    }

    const memory: Memory = {
      id: genId(),
      userId: this.userId,
      type: input.type ?? 'episodic',
      content: input.content,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const existing = parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), [])
    existing.push(memory)
    localStorage.setItem(userKey(this.userId, KEYS.MEMORIES), JSON.stringify(existing.slice(-1000)))
    this.queue.push(memory)
    this.saveQueue()
    void this.syncBackend()
    return memory
  }

  getStats() {
    const sessions = this.getAllSessions()
    const memories = this.userId ? parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), []) : []
    return { totalSessions: sessions.length, totalTurns: sessions.reduce((s, x) => s + x.turns.length, 0), totalMemories: memories.length }
  }

  private loadSession() {
    if (!this.userId) return
    const data = localStorage.getItem(userKey(this.userId, KEYS.CURRENT))
    if (data) {
      this.session = JSON.parse(data) as Session
    }
  }

  private loadQueue() {
    if (!this.userId) return
    this.queue = parseJson<Memory[]>(
      localStorage.getItem(userKey(this.userId, KEYS.QUEUE)),
      [],
    )
  }

  private loadSessionQueue() {
    if (!this.userId) return
    this.sessionQueue = parseJson<Session[]>(
      localStorage.getItem(userKey(this.userId, KEYS.SESSION_QUEUE)),
      [],
    )
  }

  private saveSession() {
    if (!this.userId || !this.session) return
    localStorage.setItem(userKey(this.userId, KEYS.CURRENT), JSON.stringify(this.session))
  }

  private saveToHistory(session: Session) {
    if (!this.userId) return
    const sessions = parseJson<Session[]>(localStorage.getItem(userKey(this.userId, KEYS.SESSIONS)), [])
    sessions.unshift(session)
    localStorage.setItem(userKey(this.userId, KEYS.SESSIONS), JSON.stringify(sessions.slice(0, 100)))
  }

  private saveQueue() {
    if (!this.userId) return
    localStorage.setItem(userKey(this.userId, KEYS.QUEUE), JSON.stringify(this.queue))
  }

  private saveSessionQueue() {
    if (!this.userId) return
    localStorage.setItem(userKey(this.userId, KEYS.SESSION_QUEUE), JSON.stringify(this.sessionQueue))
  }

  private enqueueSessionForSync(session: Session) {
    const queuedSessions = this.sessionQueue.filter((queued) => queued.id !== session.id)
    queuedSessions.push(session)
    this.sessionQueue = queuedSessions.slice(-100)
    this.saveSessionQueue()
  }

  private async extractMemories(session: Session) {
    if (!this.userId || !session.turns.length) return
    const sessionKind = readString(session.metadata, 'kind') ?? 'communication'
    const sessionSource = readString(session.metadata, 'source') ?? 'agent_chat'
    const sessionDurationSeconds = session.endTime
      ? Math.max(0, Math.round((session.endTime - session.startTime) / 1000))
      : undefined

    const memories: Memory[] = session.turns.filter(t => t.role === 'user' && t.content.length >= 3).map(t => ({
      id: genId(), userId: this.userId!, type: 'episodic' as MemoryType, content: t.content,
      metadata: {
        sessionId: session.id,
        originalText: t.originalText,
        sessionKind,
        sessionSource,
        sessionStartedAt: session.startTime,
        sessionEndedAt: session.endTime,
        sessionDurationSeconds,
      },
      createdAt: t.timestamp, updatedAt: t.timestamp
    }))
    if (memories.length) {
      const existing = parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), [])
      existing.push(...memories)
      localStorage.setItem(userKey(this.userId, KEYS.MEMORIES), JSON.stringify(existing.slice(-1000)))
      this.queue.push(...memories)
      this.saveQueue()
    }
  }

  private extractSessionCompaction(session: Session) {
    const input = buildSessionCompactionMemoryInput(session)
    if (!input) {
      return
    }

    this.addMemoryEntry(input)
  }

  private async syncBackend() {
    if (!this.queue.length && !this.sessionQueue.length) return
    const token = await getValidToken()
    if (!token) {
      this.saveQueue()
      this.saveSessionQueue()
      return
    }

    const remaining: Memory[] = []
    for (const m of this.queue) {
      try {
        const sessionPayload = this.buildSyncSessionPayload(m)
        const response = await fetch(`${config.api.baseUrl}/memory/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            user_id: m.userId,
            session_id: sessionPayload.id,
            content: m.content,
            metadata: m.metadata,
            session: sessionPayload,
          })
        })
        if (!response.ok) {
          remaining.push(m)
        }
      } catch (e) {
        console.error('[MemoryService] Sync error:', e)
        remaining.push(m)
      }
    }
    this.queue = remaining
    this.saveQueue()
    await this.syncSessionQueue(token)
  }

  private buildSyncSessionPayload(memory: Memory): Record<string, unknown> {
    const metadata = isRecord(memory.metadata) ? memory.metadata : undefined
    const sessionId = getSyncSessionId(metadata)
    const foundSession = this.findSessionById(sessionId)
    if (foundSession) {
      return this.buildSessionSyncPayload(foundSession)
    }
    const sessionMetadata = mergeMetadata(undefined, metadata)
    const startTime =
      readNumber(metadata, 'sessionStartedAt') ??
      memory.createdAt
    const endTime = readNumber(metadata, 'sessionEndedAt')
    const durationSeconds =
      readNumber(metadata, 'sessionDurationSeconds')
    const transcript = undefined

    return {
      id: sessionId,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : undefined,
      duration: durationSeconds ?? undefined,
      transcript: transcript || undefined,
      metadata: {
        ...(sessionMetadata ?? {}),
        kind: readString(sessionMetadata, 'kind') ?? 'general',
        source: readString(sessionMetadata, 'source') ?? 'local_memory',
        turnCount: readNumber(metadata, 'sessionTurnCount') ?? 0,
      },
    }
  }

  private buildSessionSyncPayload(session: Session): Record<string, unknown> {
    const durationSeconds = session.endTime
      ? Math.max(0, Math.round((session.endTime - session.startTime) / 1000))
      : undefined
    const transcript = session.turns.map((turn) => turn.content).join('\n')

    return {
      id: session.id,
      start_time: new Date(session.startTime).toISOString(),
      end_time: session.endTime ? new Date(session.endTime).toISOString() : undefined,
      duration: durationSeconds,
      transcript: transcript || undefined,
      metadata: {
        ...(session.metadata ?? {}),
        kind: readString(session.metadata, 'kind') ?? 'general',
        source: readString(session.metadata, 'source') ?? 'local_memory',
        turnCount: session.turns.length,
      },
    }
  }

  private async syncSessionQueue(token: string) {
    if (!this.sessionQueue.length) {
      return
    }

    const remaining: Session[] = []

    for (const session of this.sessionQueue) {
      try {
        const response = await fetch(`${config.api.baseUrl}/memory/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: session.userId,
            session_id: session.id,
            session: this.buildSessionSyncPayload(session),
          }),
        })

        if (!response.ok) {
          remaining.push(session)
        }
      } catch (error) {
        console.error('[MemoryService] Session sync error:', error)
        remaining.push(session)
      }
    }

    this.sessionQueue = remaining
    this.saveSessionQueue()
  }

  private findSessionById(sessionId: string): Session | null {
    if (this.session?.id === sessionId) {
      return this.session
    }

    if (!this.userId) {
      return null
    }

    const sessions = parseJson<Session[]>(
      localStorage.getItem(userKey(this.userId, KEYS.SESSIONS)),
      [],
    )

    return sessions.find((session) => session.id === sessionId) ?? null
  }

  private hasStoredMemoriesForSession(sessionId: string): boolean {
    if (!this.userId) {
      return false
    }

    const memories = parseJson<Memory[]>(
      localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)),
      [],
    )

    return memories.some((memory) => getSyncSessionId(memory.metadata) === sessionId)
  }
}

export const memoryService = new MemoryService()
export default MemoryService
