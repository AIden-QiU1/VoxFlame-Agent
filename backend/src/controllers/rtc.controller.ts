import { Request, Response, Router } from 'express'
import {
  RtcOrchestrationError,
  RtcOrchestrationService,
  RtcPropertyOverrides,
  RtcSessionMode,
} from '../services/rtc-orchestration.service'

const router = Router()
const rtcService = new RtcOrchestrationService()

function parseMode(value: unknown): RtcSessionMode | undefined {
  return value === 'training' ? 'training' : value === 'communication' ? 'communication' : undefined
}

function parseOptionalInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}

function parsePropertyOverrides(value: unknown): RtcPropertyOverrides | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  return value as RtcPropertyOverrides
}

function handleRtcError(res: Response, error: unknown): void {
  if (error instanceof RtcOrchestrationError) {
    res.status(error.statusCode).json({ error: error.message })
    return
  }

  console.error('[RTC] Unexpected controller error:', error)
  res.status(500).json({ error: 'Internal server error' })
}

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    enabled: rtcService.isConfigured(),
    controlServerUrl: rtcService.getControlServerUrl() || null,
    defaultGraph: rtcService.getDefaultGraph(),
    defaultTimeoutSeconds: rtcService.getDefaultTimeoutSeconds(),
  })
})

router.get('/graphs', async (_req: Request, res: Response) => {
  try {
    const graphs = await rtcService.listGraphs()
    res.json({ graphs })
  } catch (error) {
    handleRtcError(res, error)
  }
})

router.post('/session/start', async (req: Request, res: Response) => {
  try {
    const result = await rtcService.startSession({
      requestId:
        typeof req.body?.requestId === 'string' ? req.body.requestId : undefined,
      channelName:
        typeof req.body?.channelName === 'string' ? req.body.channelName : undefined,
      graphName:
        typeof req.body?.graphName === 'string' ? req.body.graphName : undefined,
      mode: parseMode(req.body?.mode),
      userUid: parseOptionalInteger(req.body?.userUid),
      botUid: parseOptionalInteger(req.body?.botUid),
      timeoutSeconds: parseOptionalInteger(req.body?.timeoutSeconds),
      properties: parsePropertyOverrides(req.body?.properties),
    })

    res.json(result)
  } catch (error) {
    handleRtcError(res, error)
  }
})

router.post('/session/stop', async (req: Request, res: Response) => {
  try {
    if (typeof req.body?.channelName !== 'string' || !req.body.channelName.trim()) {
      res.status(400).json({ error: 'channelName is required' })
      return
    }

    await rtcService.stopSession({
      requestId:
        typeof req.body?.requestId === 'string' ? req.body.requestId : undefined,
      channelName: req.body.channelName,
    })

    res.json({ stopped: true, channelName: req.body.channelName })
  } catch (error) {
    handleRtcError(res, error)
  }
})

router.post('/session/ping', async (req: Request, res: Response) => {
  try {
    if (typeof req.body?.channelName !== 'string' || !req.body.channelName.trim()) {
      res.status(400).json({ error: 'channelName is required' })
      return
    }

    await rtcService.pingSession({
      requestId:
        typeof req.body?.requestId === 'string' ? req.body.requestId : undefined,
      channelName: req.body.channelName,
    })

    res.json({ ok: true, channelName: req.body.channelName })
  } catch (error) {
    handleRtcError(res, error)
  }
})

export default router
