import { Request, Response, Router } from 'express'
import { authMiddleware, validateUserId } from '../middlewares/auth.middleware'
import { SupabaseService, UserProfile } from '../services/supabase.service'
import { respondCompatNotImplemented } from './compat-response'

const AGENT_COMPAT_GUIDANCE =
  'Use /api/rtc/session/start for runtime RTC sessions. Persist user data via /api/agent/profile, /api/memory, and /api/phrases.'
const AGENT_COMPAT_REMOVAL_TARGET =
  'Remove after remaining callers migrate to RTC session APIs plus persisted user APIs.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function buildDefaultProfile(userId: string): UserProfile {
  return {
    id: userId,
    name: '',
    hotwords: [],
    preferences: {},
  }
}

function getService(res: Response): SupabaseService | null {
  try {
    return SupabaseService.getInstance()
  } catch (error) {
    console.error('Failed to initialize SupabaseService:', error)
    res.status(500).json({ error: 'Supabase service is not configured' })
    return null
  }
}

async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params

    if (!userId) {
      res.status(400).json({ error: 'Missing userId parameter' })
      return
    }

    const service = getService(res)
    if (!service) {
      return
    }

    const profile = await service.getUserProfile(userId)
    res.json(profile ?? buildDefaultProfile(userId))
  } catch (error) {
    console.error('Error in getUserProfile:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function updateUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params
    const updates = req.body as Partial<UserProfile>

    if (!userId) {
      res.status(400).json({ error: 'Missing userId parameter' })
      return
    }

    const service = getService(res)
    if (!service) {
      return
    }

    const existing = await service.getUserProfile(userId)
    const mergedPreferences =
      isRecord(existing?.preferences) && isRecord(updates.preferences)
        ? {
            ...existing.preferences,
            ...updates.preferences,
          }
        : updates.preferences ?? existing?.preferences
    const payload: UserProfile = {
      ...(existing ?? buildDefaultProfile(userId)),
      ...updates,
      id: userId,
      preferences: mergedPreferences,
    }

    const profile = existing
      ? await service.updateUserProfile(userId, payload)
      : await service.createUserProfile(payload)

    if (!profile) {
      res.status(500).json({ error: 'Failed to persist user profile' })
      return
    }

    res.json(profile)
  } catch (error) {
    console.error('Error in updateUserProfile:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function getHotwords(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params

    if (!userId) {
      res.status(400).json({ error: 'Missing userId parameter' })
      return
    }

    const service = getService(res)
    if (!service) {
      return
    }

    const hotwords = await service.extractHotwords(userId)
    res.json({ hotwords, count: hotwords.length })
  } catch (error) {
    console.error('Error in getHotwords:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function respondNotImplemented(res: Response, route: string, operation: string): void {
  respondCompatNotImplemented(res, {
    route,
    operation,
    guidance: AGENT_COMPAT_GUIDANCE,
    removalTarget: AGENT_COMPAT_REMOVAL_TARGET,
  })
}

function logSession(req: Request, res: Response): void {
  void req
  console.warn('[Compat] /api/agent/session/log invoked')
  respondNotImplemented(res, '/api/agent/session/log', 'log_session')
}

function getSessionHistory(req: Request, res: Response): void {
  void req
  console.warn('[Compat] /api/agent/session/history/:userId invoked')
  respondNotImplemented(
    res,
    '/api/agent/session/history/:userId',
    'get_session_history',
  )
}

function logToolExecution(req: Request, res: Response): void {
  void req
  console.warn('[Compat] /api/agent/tool/log invoked')
  respondNotImplemented(res, '/api/agent/tool/log', 'log_tool_execution')
}

function executeTool(req: Request, res: Response): void {
  void req
  console.warn('[Compat] /api/agent/tool/execute invoked')
  respondNotImplemented(res, '/api/agent/tool/execute', 'execute_tool')
}

export const agentRouter = Router()

agentRouter.get('/profile/:userId', authMiddleware, validateUserId, getUserProfile)
agentRouter.put('/profile/:userId', authMiddleware, validateUserId, updateUserProfile)
agentRouter.get('/hotwords/:userId', authMiddleware, validateUserId, getHotwords)
agentRouter.post('/session/log', authMiddleware, logSession)
agentRouter.get('/session/history/:userId', authMiddleware, validateUserId, getSessionHistory)
agentRouter.post('/tool/log', authMiddleware, logToolExecution)
agentRouter.post('/tool/execute', authMiddleware, executeTool)
