import { Request, Response, Router } from 'express'
import { authMiddleware, validateUserId } from '../middlewares/auth.middleware'
import { respondCompatNotImplemented } from './compat-response'

const AGENT_COMPAT_GUIDANCE =
  'Use /api/rtc/session/start for runtime RTC sessions. Persist workspace-owned user data via /api/memory/workspace/:userId and /api/memory/workspace/:userId/preferences, then use /api/memory and /api/phrases for memory and phrase data.'
const AGENT_COMPAT_REMOVAL_TARGET =
  'Remove after external callers stop using legacy /api/agent/* compatibility endpoints.'

function respondAgentCompat(
  req: Request,
  res: Response,
  route: string,
  operation: string,
): void {
  console.warn(`[Compat] ${route} invoked from ${req.ip}`)
  respondCompatNotImplemented(res, {
    route,
    operation,
    guidance: AGENT_COMPAT_GUIDANCE,
    removalTarget: AGENT_COMPAT_REMOVAL_TARGET,
  })
}

function logSession(req: Request, res: Response): void {
  respondAgentCompat(req, res, '/api/agent/session/log', 'log_session')
}

function getSessionHistory(req: Request, res: Response): void {
  respondAgentCompat(
    req,
    res,
    '/api/agent/session/history/:userId',
    'get_session_history',
  )
}

function logToolExecution(req: Request, res: Response): void {
  respondAgentCompat(req, res, '/api/agent/tool/log', 'log_tool_execution')
}

function executeTool(req: Request, res: Response): void {
  respondAgentCompat(req, res, '/api/agent/tool/execute', 'execute_tool')
}

export const agentRouter = Router()

agentRouter.post('/session/log', authMiddleware, logSession)
agentRouter.get('/session/history/:userId', authMiddleware, validateUserId, getSessionHistory)
agentRouter.post('/tool/log', authMiddleware, logToolExecution)
agentRouter.post('/tool/execute', authMiddleware, executeTool)
