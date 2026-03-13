/**
 * Session Controller
 * Compat-only HTTP shell kept temporarily while callers migrate to /ws/agent.
 */
import { Request, Response, Router } from 'express'
import { respondCompatNotImplemented } from './compat-response'

const router = Router()

const SESSION_COMPAT_GUIDANCE =
  'Runtime sessions now bootstrap by opening /ws/agent directly with token or anon_id query params. Persist user state via /api/agent/profile, /api/memory, and /api/phrases.'
const SESSION_COMPAT_REMOVAL_TARGET =
  'Remove after remaining callers stop using legacy HTTP session bootstrap endpoints.'

function respondSessionCompat(
  req: Request,
  res: Response,
  route: string,
  operation: string,
): void {
  console.warn(`[Compat] ${route} invoked from ${req.ip}`)
  respondCompatNotImplemented(res, {
    route,
    operation,
    guidance: SESSION_COMPAT_GUIDANCE,
    removalTarget: SESSION_COMPAT_REMOVAL_TARGET,
  })
}

router.post('/start', (req: Request, res: Response) => {
  respondSessionCompat(req, res, '/api/session/start', 'start_session')
})

router.post('/stop', (req: Request, res: Response) => {
  respondSessionCompat(req, res, '/api/session/stop', 'stop_session')
})

router.get('/:sessionId', (req: Request, res: Response) => {
  respondSessionCompat(req, res, '/api/session/:sessionId', 'get_session')
})

router.post('/reload-hotwords', (req: Request, res: Response) => {
  respondSessionCompat(req, res, '/api/session/reload-hotwords', 'reload_hotwords')
})

export default router
