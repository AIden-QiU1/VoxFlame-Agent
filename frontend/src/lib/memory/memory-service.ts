// Memory Service

import { getValidToken } from '@/lib/supabase/client'

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
}

export interface CreateMemoryInput {
  type?: MemoryType
  content: string
  metadata?: Record<string, unknown>
  createdAt?: number
}

const KEYS = {
  MEMORIES: 'voxflame_memories',
  SESSIONS: 'voxflame_sessions',
  CURRENT: 'voxflame_current_session',
  PREFIX: 'voxflame_user_',
}

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const userKey = (uid: string, k: string) => `${KEYS.PREFIX}${uid}_${k}`
const parseJson = <T>(s: string | null, d: T): T => s ? JSON.parse(s) : d

class MemoryService {
  private session: Session | null = null
  private userId: string | null = null
  private queue: Memory[] = []

  init(userId: string) {
    this.userId = userId
    this.loadSession()
  }

  getSession(): Session {
    if (!this.session) this.startSession()
    return this.session!
  }

  startSession(): Session {
    this.session = { id: genId(), userId: this.userId || 'anon', startTime: Date.now(), turns: [] }
    this.saveSession()
    return this.session
  }

  async endSession() {
    if (!this.session) return
    this.session.endTime = Date.now()
    this.saveToHistory(this.session)
    await this.extractMemories(this.session)
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

  addMemoryEntry(input: CreateMemoryInput): Memory | null {
    if (!this.userId) return null

    const timestamp = input.createdAt ?? Date.now()
    const memory: Memory = {
      id: genId(),
      userId: this.userId,
      type: input.type ?? 'episodic',
      content: input.content,
      metadata: input.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const existing = parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), [])
    existing.push(memory)
    localStorage.setItem(userKey(this.userId, KEYS.MEMORIES), JSON.stringify(existing.slice(-1000)))
    this.queue.push(memory)
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
    if (data) this.session = JSON.parse(data)
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

  private async extractMemories(session: Session) {
    if (!this.userId || !session.turns.length) return
    const memories: Memory[] = session.turns.filter(t => t.role === 'user' && t.content.length >= 3).map(t => ({
      id: genId(), userId: this.userId!, type: 'episodic' as MemoryType, content: t.content,
      metadata: { sessionId: session.id, originalText: t.originalText },
      createdAt: t.timestamp, updatedAt: t.timestamp
    }))
    if (memories.length) {
      const existing = parseJson<Memory[]>(localStorage.getItem(userKey(this.userId, KEYS.MEMORIES)), [])
      existing.push(...memories)
      localStorage.setItem(userKey(this.userId, KEYS.MEMORIES), JSON.stringify(existing.slice(-1000)))
      this.queue.push(...memories)
    }
  }

  private async syncBackend() {
    if (!this.queue.length) return
    const token = await getValidToken()
    if (!token) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    for (const m of this.queue) {
      try {
        await fetch(`${apiUrl}/api/memory/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ user_id: m.userId, session_id: (m.metadata as Record<string, unknown>)?.sessionId || 'unknown', content: m.content, metadata: m.metadata })
        })
      } catch (e) { console.error('[MemoryService] Sync error:', e) }
    }
    this.queue = []
  }
}

export const memoryService = new MemoryService()
export default MemoryService
