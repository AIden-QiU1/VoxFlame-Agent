import { createHash } from 'crypto'
import { appendFile, mkdir } from 'fs/promises'
import path from 'path'
import { Router } from 'express'

const MAX_REPORTS_PER_REQUEST = 20
const MAX_BREADCRUMBS_PER_REPORT = 30

type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal'
type DiagnosticKind =
  | 'app_start'
  | 'config'
  | 'api_failure'
  | 'rtc_failure'
  | 'recording_failure'
  | 'crash'
  | 'manual'

interface SanitizedBreadcrumb {
  at: string
  category: string
  action: string
  status?: string
}

interface SanitizedMobileDiagnostic {
  reportId: string
  installationId: string
  occurredAt: string
  receivedAt: string
  userFingerprint: string
  appVersion: string
  buildVersion: string
  platform: 'android' | 'ios' | 'unknown'
  osVersion: string
  deviceModel: string
  kind: DiagnosticKind
  severity: DiagnosticSeverity
  code: string
  surface?: string
  phase?: string
  endpoint?: string
  httpStatus?: number
  connectionState?: string
  stack?: string
  breadcrumbs: SanitizedBreadcrumb[]
}

const ALLOWED_KINDS = new Set<DiagnosticKind>([
  'app_start',
  'config',
  'api_failure',
  'rtc_failure',
  'recording_failure',
  'crash',
  'manual',
])
const ALLOWED_SEVERITIES = new Set<DiagnosticSeverity>([
  'info',
  'warning',
  'error',
  'fatal',
])
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_.:/-]+$/
const REPORT_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/

function readBoundedString(
  value: unknown,
  maxLength: number,
  pattern?: RegExp,
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    return null
  }

  if (pattern && !pattern.test(normalized)) {
    return null
  }

  return normalized
}

function readIsoDate(value: unknown): string | null {
  const normalized = readBoundedString(value, 40)
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    return null
  }

  return new Date(normalized).toISOString()
}

function sanitizeEndpoint(value: unknown): string | undefined {
  const normalized = readBoundedString(value, 160)
  if (!normalized) {
    return undefined
  }

  const withoutQuery = normalized.split(/[?#]/, 1)[0]
  if (!withoutQuery.startsWith('/') || !IDENTIFIER_PATTERN.test(withoutQuery)) {
    return undefined
  }

  return withoutQuery
}

function sanitizeStack(value: unknown): string | undefined {
  const normalized = readBoundedString(value, 2400)
  if (!normalized) {
    return undefined
  }

  const sanitized = normalized
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<redacted-email>')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer <redacted>')
    .replace(/([?&](?:token|key|secret|code)=)[^\s&]+/gi, '$1<redacted>')

  return sanitized.slice(0, 2400)
}

function sanitizeBreadcrumb(value: unknown): SanitizedBreadcrumb | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const at = readIsoDate(candidate.at)
  const category = readBoundedString(candidate.category, 40, IDENTIFIER_PATTERN)
  const action = readBoundedString(candidate.action, 80, IDENTIFIER_PATTERN)
  const status = readBoundedString(candidate.status, 40, IDENTIFIER_PATTERN)

  if (!at || !category || !action) {
    return null
  }

  return {
    at,
    category,
    action,
    ...(status ? { status } : {}),
  }
}

function fingerprintUser(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 20)
}

export function sanitizeMobileDiagnosticBatch(
  body: unknown,
  authenticatedUserId: string,
  receivedAt = new Date().toISOString(),
): SanitizedMobileDiagnostic[] {
  if (!body || typeof body !== 'object') {
    return []
  }

  const reports = (body as Record<string, unknown>).reports
  if (!Array.isArray(reports)) {
    return []
  }

  const userFingerprint = fingerprintUser(authenticatedUserId)

  return reports.slice(0, MAX_REPORTS_PER_REQUEST).flatMap((value) => {
    if (!value || typeof value !== 'object') {
      return []
    }

    const candidate = value as Record<string, unknown>
    const reportId = readBoundedString(candidate.reportId, 80, REPORT_ID_PATTERN)
    const installationId = readBoundedString(candidate.installationId, 80, REPORT_ID_PATTERN)
    const occurredAt = readIsoDate(candidate.occurredAt)
    const appVersion = readBoundedString(candidate.appVersion, 32, IDENTIFIER_PATTERN)
    const buildVersion = readBoundedString(candidate.buildVersion, 32, IDENTIFIER_PATTERN)
    const osVersion = readBoundedString(candidate.osVersion, 40, IDENTIFIER_PATTERN)
    const deviceModel = readBoundedString(candidate.deviceModel, 80)
    const code = readBoundedString(candidate.code, 120, IDENTIFIER_PATTERN)
    const kind = readBoundedString(candidate.kind, 40) as DiagnosticKind | null
    const severity = readBoundedString(candidate.severity, 20) as DiagnosticSeverity | null
    const platform = candidate.platform === 'android' || candidate.platform === 'ios'
      ? candidate.platform
      : 'unknown'

    if (
      !reportId
      || !installationId
      || !occurredAt
      || !appVersion
      || !buildVersion
      || !osVersion
      || !deviceModel
      || !code
      || !kind
      || !ALLOWED_KINDS.has(kind)
      || !severity
      || !ALLOWED_SEVERITIES.has(severity)
    ) {
      return []
    }

    const httpStatus = typeof candidate.httpStatus === 'number'
      && Number.isInteger(candidate.httpStatus)
      && candidate.httpStatus >= 100
      && candidate.httpStatus <= 599
      ? candidate.httpStatus
      : undefined
    const surface = readBoundedString(candidate.surface, 40, IDENTIFIER_PATTERN) ?? undefined
    const phase = readBoundedString(candidate.phase, 60, IDENTIFIER_PATTERN) ?? undefined
    const connectionState = readBoundedString(
      candidate.connectionState,
      40,
      IDENTIFIER_PATTERN,
    ) ?? undefined
    const breadcrumbs = Array.isArray(candidate.breadcrumbs)
      ? candidate.breadcrumbs
        .slice(-MAX_BREADCRUMBS_PER_REPORT)
        .map(sanitizeBreadcrumb)
        .filter((item): item is SanitizedBreadcrumb => Boolean(item))
      : []

    return [{
      reportId,
      installationId,
      occurredAt,
      receivedAt,
      userFingerprint,
      appVersion,
      buildVersion,
      platform,
      osVersion,
      deviceModel,
      kind,
      severity,
      code,
      ...(surface ? { surface } : {}),
      ...(phase ? { phase } : {}),
      ...(sanitizeEndpoint(candidate.endpoint)
        ? { endpoint: sanitizeEndpoint(candidate.endpoint) }
        : {}),
      ...(httpStatus ? { httpStatus } : {}),
      ...(connectionState ? { connectionState } : {}),
      ...(sanitizeStack(candidate.stack) ? { stack: sanitizeStack(candidate.stack) } : {}),
      breadcrumbs,
    }]
  })
}

function diagnosticsLogPath(): string {
  return process.env.VOXFLAME_MOBILE_DIAGNOSTICS_LOG?.trim()
    || path.resolve(process.cwd(), 'logs/mobile-diagnostics.jsonl')
}

export const mobileDiagnosticsRouter = Router()

mobileDiagnosticsRouter.post('/', async (req, res, next) => {
  try {
    const authenticatedUserId = (req as typeof req & {
      user?: { id: string }
    }).user?.id
    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const reports = sanitizeMobileDiagnosticBatch(req.body, authenticatedUserId)
    if (reports.length === 0) {
      return res.status(400).json({
        error: 'invalid_mobile_diagnostics',
        message: 'No valid diagnostic reports were provided.',
      })
    }

    const logPath = diagnosticsLogPath()
    await mkdir(path.dirname(logPath), { recursive: true })
    await appendFile(
      logPath,
      `${reports.map((report) => JSON.stringify(report)).join('\n')}\n`,
      'utf8',
    )

    return res.status(202).json({
      acceptedReportIds: reports.map((report) => report.reportId),
    })
  } catch (error) {
    return next(error)
  }
})

export default mobileDiagnosticsRouter
