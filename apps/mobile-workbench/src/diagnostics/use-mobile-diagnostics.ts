import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

import type { MobileAuthTokenProvider } from '../api/mobile-workbench-client'

const DIAGNOSTIC_QUEUE_KEY = 'voxflame.mobile-diagnostics.v1'
const INSTALLATION_ID_KEY = 'voxflame.mobile-installation-id.v1'
const MAX_QUEUED_REPORTS = 50
const MAX_BREADCRUMBS = 30

export type MobileDiagnosticKind =
  | 'app_start'
  | 'config'
  | 'api_failure'
  | 'rtc_failure'
  | 'recording_failure'
  | 'crash'
  | 'manual'

export type MobileDiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal'

interface MobileDiagnosticBreadcrumb {
  at: string
  category: string
  action: string
  status?: string
}

interface MobileDiagnosticReport {
  reportId: string
  installationId: string
  occurredAt: string
  appVersion: string
  buildVersion: string
  platform: 'android' | 'ios' | 'unknown'
  osVersion: string
  deviceModel: string
  kind: MobileDiagnosticKind
  severity: MobileDiagnosticSeverity
  code: string
  surface?: string
  phase?: string
  endpoint?: string
  httpStatus?: number
  connectionState?: string
  stack?: string
  breadcrumbs: MobileDiagnosticBreadcrumb[]
}

export interface MobileDiagnosticEvent {
  kind: MobileDiagnosticKind
  severity: MobileDiagnosticSeverity
  code: string
  surface?: string
  phase?: string
  endpoint?: string
  httpStatus?: number
  connectionState?: string
  error?: unknown
}

export type MobileDiagnosticSyncStatus =
  | 'idle'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'error'

export interface MobileDiagnosticsState {
  status: MobileDiagnosticSyncStatus
  pendingCount: number
  capture(event: MobileDiagnosticEvent): Promise<void>
  addBreadcrumb(category: string, action: string, status?: string): void
  sendNow(): Promise<boolean>
}

interface ErrorUtilsShape {
  getGlobalHandler?(): (error: Error, isFatal?: boolean) => void
  setGlobalHandler?(handler: (error: Error, isFatal?: boolean) => void): void
}

const breadcrumbs: MobileDiagnosticBreadcrumb[] = []
let queueMutation = Promise.resolve()

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function normalizeIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_.:/-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120)

  return normalized || fallback
}

function sanitizeEndpoint(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const withoutQuery = value.trim().split(/[?#]/, 1)[0]
  if (!withoutQuery.startsWith('/')) {
    return undefined
  }

  return normalizeIdentifier(withoutQuery, '/unknown').slice(0, 160)
}

function sanitizeStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) {
    return undefined
  }

  const framesOnly = error.stack
    .split('\n')
    .slice(1, 13)
    .join('\n')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<redacted-email>')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer <redacted>')
    .replace(/([?&](?:token|key|secret|code)=)[^\s&]+/gi, '$1<redacted>')

  return framesOnly.trim().slice(0, 2400) || undefined
}

function platformName(): 'android' | 'ios' | 'unknown' {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return Platform.OS
  }

  return 'unknown'
}

function deviceModel(): string {
  const constants = Platform.constants as {
    Manufacturer?: string
    Model?: string
    interfaceIdiom?: string
  }

  return [constants.Manufacturer, constants.Model, constants.interfaceIdiom]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .slice(0, 80) || 'unknown'
}

async function installationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY)
  if (existing) {
    return existing
  }

  const created = createId('install')
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created)
  return created
}

async function readQueue(): Promise<MobileDiagnosticReport[]> {
  const raw = await AsyncStorage.getItem(DIAGNOSTIC_QUEUE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is MobileDiagnosticReport => Boolean(
        item
        && typeof item === 'object'
        && typeof (item as MobileDiagnosticReport).reportId === 'string',
      ))
      : []
  } catch {
    await AsyncStorage.removeItem(DIAGNOSTIC_QUEUE_KEY)
    return []
  }
}

async function writeQueue(reports: MobileDiagnosticReport[]): Promise<void> {
  await AsyncStorage.setItem(
    DIAGNOSTIC_QUEUE_KEY,
    JSON.stringify(reports.slice(-MAX_QUEUED_REPORTS)),
  )
}

function withQueueLock(operation: () => Promise<void>): Promise<void> {
  const next = queueMutation.then(operation, operation)
  queueMutation = next.catch(() => undefined)
  return next
}

export function addMobileDiagnosticBreadcrumb(
  category: string,
  action: string,
  status?: string,
): void {
  breadcrumbs.push({
    at: new Date().toISOString(),
    category: normalizeIdentifier(category, 'unknown').slice(0, 40),
    action: normalizeIdentifier(action, 'unknown').slice(0, 80),
    ...(status
      ? { status: normalizeIdentifier(status, 'unknown').slice(0, 40) }
      : {}),
  })

  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.splice(0, breadcrumbs.length - MAX_BREADCRUMBS)
  }
}

export async function recordMobileDiagnostic(
  event: MobileDiagnosticEvent,
): Promise<void> {
  const report: MobileDiagnosticReport = {
    reportId: createId('report'),
    installationId: await installationId(),
    occurredAt: new Date().toISOString(),
    appVersion: normalizeIdentifier(Constants.nativeAppVersion ?? 'unknown', 'unknown').slice(0, 32),
    buildVersion: normalizeIdentifier(Constants.nativeBuildVersion ?? 'unknown', 'unknown').slice(0, 32),
    platform: platformName(),
    osVersion: normalizeIdentifier(String(Platform.Version), 'unknown').slice(0, 40),
    deviceModel: deviceModel(),
    kind: event.kind,
    severity: event.severity,
    code: normalizeIdentifier(event.code, 'unknown_error'),
    ...(event.surface
      ? { surface: normalizeIdentifier(event.surface, 'unknown').slice(0, 40) }
      : {}),
    ...(event.phase
      ? { phase: normalizeIdentifier(event.phase, 'unknown').slice(0, 60) }
      : {}),
    ...(sanitizeEndpoint(event.endpoint) ? { endpoint: sanitizeEndpoint(event.endpoint) } : {}),
    ...(event.httpStatus ? { httpStatus: event.httpStatus } : {}),
    ...(event.connectionState
      ? {
        connectionState: normalizeIdentifier(
          event.connectionState,
          'unknown',
        ).slice(0, 40),
      }
      : {}),
    ...(sanitizeStack(event.error) ? { stack: sanitizeStack(event.error) } : {}),
    breadcrumbs: [...breadcrumbs],
  }

  await withQueueLock(async () => {
    const reports = await readQueue()
    reports.push(report)
    await writeQueue(reports)
  })
}

async function flushMobileDiagnostics(
  apiBaseUrl: string,
  tokenProvider: MobileAuthTokenProvider,
): Promise<{ pendingCount: number; sentCount: number }> {
  await queueMutation
  const reports = await readQueue()
  if (reports.length === 0) {
    return { pendingCount: 0, sentCount: 0 }
  }

  const token = await tokenProvider.getAccessToken()
  if (!token) {
    return { pendingCount: reports.length, sentCount: 0 }
  }

  const batch = reports.slice(0, 20)
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/mobile/diagnostics`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reports: batch }),
    },
  )

  if (!response.ok) {
    throw new Error(`mobile_diagnostics_upload_${response.status}`)
  }

  const acceptedIds = new Set(batch.map((report) => report.reportId))
  await withQueueLock(async () => {
    const latest = await readQueue()
    await writeQueue(latest.filter((report) => !acceptedIds.has(report.reportId)))
  })

  const remaining = await readQueue()
  return { pendingCount: remaining.length, sentCount: batch.length }
}

function installGlobalDiagnosticHandler(): () => void {
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsShape }).ErrorUtils
  if (!errorUtils?.setGlobalHandler) {
    return () => undefined
  }

  const previousHandler = errorUtils.getGlobalHandler?.()
  const diagnosticHandler = (error: Error, isFatal = false): void => {
    void recordMobileDiagnostic({
      kind: 'crash',
      severity: isFatal ? 'fatal' : 'error',
      code: error.name || 'javascript_error',
      phase: 'global_error_handler',
      error,
    })
    previousHandler?.(error, isFatal)
  }

  errorUtils.setGlobalHandler(diagnosticHandler)
  return () => {
    if (previousHandler) {
      errorUtils.setGlobalHandler?.(previousHandler)
    }
  }
}

export function useMobileDiagnostics(params: {
  apiBaseUrl: string | null
  authenticated: boolean
  tokenProvider: MobileAuthTokenProvider
}): MobileDiagnosticsState {
  const [status, setStatus] = useState<MobileDiagnosticSyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  const bootRecordedRef = useRef(false)

  const refreshPendingCount = useCallback(async (): Promise<void> => {
    await queueMutation
    setPendingCount((await readQueue()).length)
  }, [])

  const capture = useCallback(async (event: MobileDiagnosticEvent): Promise<void> => {
    await recordMobileDiagnostic(event)
    setStatus('pending')
    await refreshPendingCount()
  }, [refreshPendingCount])

  const sendNow = useCallback(async (): Promise<boolean> => {
    if (!params.apiBaseUrl || !params.authenticated) {
      await refreshPendingCount()
      return false
    }

    setStatus('sending')
    try {
      const result = await flushMobileDiagnostics(
        params.apiBaseUrl,
        params.tokenProvider,
      )
      setPendingCount(result.pendingCount)
      setStatus(result.pendingCount > 0 ? 'pending' : 'sent')
      return true
    } catch {
      await refreshPendingCount()
      setStatus('error')
      return false
    }
  }, [
    params.apiBaseUrl,
    params.authenticated,
    params.tokenProvider,
    refreshPendingCount,
  ])

  useEffect(() => installGlobalDiagnosticHandler(), [])

  useEffect(() => {
    if (bootRecordedRef.current) {
      return
    }

    bootRecordedRef.current = true
    void capture({
      kind: params.apiBaseUrl ? 'app_start' : 'config',
      severity: params.apiBaseUrl ? 'info' : 'error',
      code: params.apiBaseUrl ? 'app_started' : 'api_config_missing',
      phase: 'bootstrap',
    })
  }, [capture, params.apiBaseUrl])

  useEffect(() => {
    void refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    if (!params.apiBaseUrl || !params.authenticated) {
      return undefined
    }

    void sendNow()
    const timer = setInterval(() => {
      void sendNow()
    }, 60_000)

    return () => clearInterval(timer)
  }, [params.apiBaseUrl, params.authenticated, sendNow])

  return {
    status,
    pendingCount,
    capture,
    addBreadcrumb: addMobileDiagnosticBreadcrumb,
    sendNow,
  }
}
