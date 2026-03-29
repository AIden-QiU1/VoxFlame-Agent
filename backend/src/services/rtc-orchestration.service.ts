import http from 'http'
import https from 'https'
import { URL } from 'url'
import { v4 as uuidv4 } from 'uuid'

export type RtcSessionMode = 'communication' | 'training' | 'quick_talk'
export type RtcSurface =
  | 'home_main'
  | 'communication_workspace'
  | 'training_workspace'
  | 'memory_workspace'
  | 'pwa_quick_talk'
  | 'mobile_companion'
  | 'desktop_companion'
export type RtcSessionStrategy = 'heavy_realtime' | 'light_voice'
export type RtcCapabilityId =
  | 'transport_send_control'
  | 'training_feedback_request'
  | 'voice_profile_update'
  | 'workspace_snapshot_read'
  | 'upload_artifact_persist'
export type RtcScene =
  | 'medical'
  | 'family'
  | 'stranger'
  | 'emergency'
  | 'work'
  | 'interview'
  | 'outing'
  | 'home'
export type RtcMicrophoneStatus = 'unknown' | 'available' | 'unavailable'
export type RtcPropertyOverrides = Record<string, Record<string, unknown>>

export interface RtcDeviceContext {
  secureContext?: boolean
  mediaDevicesSupported?: boolean
  microphoneStatus?: RtcMicrophoneStatus
  networkOnline?: boolean
}

export interface RtcSessionIntentInput {
  surface?: RtcSurface
  mode?: RtcSessionMode
  sessionStrategy?: RtcSessionStrategy
  requestedCapabilities?: RtcCapabilityId[]
  scene?: RtcScene
  deviceContext?: RtcDeviceContext
}

export interface RtcResolvedSessionIntent {
  surface: RtcSurface
  mode: RtcSessionMode
  sessionStrategy: RtcSessionStrategy
  requestedCapabilities: RtcCapabilityId[]
  grantedCapabilities: RtcCapabilityId[]
  scene: RtcScene | null
  deviceContext: RtcDeviceContext
}

export interface RtcSessionReadiness {
  canStart: boolean
  requestedStrategy: RtcSessionStrategy
  resolvedStrategy: RtcSessionStrategy
  recommendedStrategy: RtcSessionStrategy
  microphoneRequired: boolean
  blockers: string[]
  warnings: string[]
  summary: RtcSessionReadinessSummary
}

export interface RtcSessionReadinessSummary {
  status: 'needs_attention' | 'can_start' | 'ready'
  label: string
  detail: string
  nextAction: string
  blockerSummary: string | null
  warningSummary: string | null
}

export interface RtcControlPlaneStatus {
  supportedSurfaces: RtcSurface[]
  supportedSessionStrategies: RtcSessionStrategy[]
  activeExecutionStrategy: RtcSessionStrategy
  capabilityMatrix: Record<RtcSessionMode, RtcCapabilityId[]>
}

export interface StartRtcSessionInput {
  requestId?: string
  channelName?: string
  graphName?: string
  mode?: RtcSessionMode
  intent?: RtcSessionIntentInput
  userUid?: number
  botUid?: number
  timeoutSeconds?: number
  properties?: RtcPropertyOverrides
}

export interface StopRtcSessionInput {
  requestId?: string
  channelName: string
}

export interface PingRtcSessionInput {
  requestId?: string
  channelName: string
}

export interface RtcStartSessionResult {
  requestId: string
  channelName: string
  graphName: string
  userUid: number
  botUid: number
  appId: string
  token: string
  rtmUserId: string
  rtmChannelName: string
  rtmToken: string
  timeoutSeconds: number
  controlServerUrl: string
  intent: RtcResolvedSessionIntent
  readiness: RtcSessionReadiness
}

interface TenControlResponse<T> {
  code: string
  msg: string
  data: T
}

interface TenTokenResponse {
  appId: string
  token: string
  channel_name: string
  uid: number
}

interface GraphSummary {
  name: string
  graph_id: string
  auto_start: boolean
}

const SUPPORTED_SURFACES: RtcSurface[] = [
  'home_main',
  'communication_workspace',
  'training_workspace',
  'memory_workspace',
  'pwa_quick_talk',
  'mobile_companion',
  'desktop_companion',
]

const SUPPORTED_SESSION_STRATEGIES: RtcSessionStrategy[] = [
  'heavy_realtime',
  'light_voice',
]

const MODE_CAPABILITY_MATRIX: Record<RtcSessionMode, RtcCapabilityId[]> = {
  communication: [
    'transport_send_control',
    'workspace_snapshot_read',
  ],
  training: [
    'transport_send_control',
    'workspace_snapshot_read',
    'training_feedback_request',
    'voice_profile_update',
    'upload_artifact_persist',
  ],
  quick_talk: [
    'transport_send_control',
  ],
}

export class RtcOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'RtcOrchestrationError'
  }
}

export class RtcOrchestrationService {
  private readonly controlServerUrl = (
    process.env.TEN_AGENT_SERVER_URL || ''
  ).trim()

  private readonly defaultGraph =
    (process.env.RTC_DEFAULT_GRAPH || 'voxflame_voice_assistant_rtc_preview').trim()

  private readonly defaultTimeoutSeconds = this.parseTimeout(
    process.env.RTC_DEFAULT_TIMEOUT,
    120,
  )

  public isConfigured(): boolean {
    return this.controlServerUrl.length > 0
  }

  public getControlServerUrl(): string {
    return this.controlServerUrl
  }

  public getDefaultGraph(): string {
    return this.defaultGraph
  }

  public getDefaultTimeoutSeconds(): number {
    return this.defaultTimeoutSeconds
  }

  public getControlPlaneStatus(): RtcControlPlaneStatus {
    return {
      supportedSurfaces: [...SUPPORTED_SURFACES],
      supportedSessionStrategies: [...SUPPORTED_SESSION_STRATEGIES],
      activeExecutionStrategy: 'heavy_realtime',
      capabilityMatrix: {
        communication: [...MODE_CAPABILITY_MATRIX.communication],
        training: [...MODE_CAPABILITY_MATRIX.training],
        quick_talk: [...MODE_CAPABILITY_MATRIX.quick_talk],
      },
    }
  }

  public async listGraphs(): Promise<GraphSummary[]> {
    this.ensureConfigured()
    const response = await this.requestJson<GraphSummary[]>('/graphs', 'GET')
    return Array.isArray(response.data) ? response.data : []
  }

  public async startSession(
    input: StartRtcSessionInput,
  ): Promise<RtcStartSessionResult> {
    this.ensureConfigured()

    const intent = resolveSessionIntent(input)
    const readiness = buildSessionReadiness(intent)

    if (readiness.blockers.length > 0) {
      throw new RtcOrchestrationError(readiness.blockers[0], 400)
    }

    const requestId = input.requestId?.trim() || uuidv4()
    const channelName = sanitizeChannelName(
      input.channelName?.trim() || buildChannelName(intent.mode),
    )
    const graphName = input.graphName?.trim() || this.defaultGraph
    const userUid = normalizeUid(input.userUid) ?? generateRtcUid()
    const botUid = normalizeUid(input.botUid) ?? generateRtcUid(userUid)
    const timeoutSeconds =
      normalizePositiveInt(input.timeoutSeconds) ?? this.defaultTimeoutSeconds
    const properties = mergePropertyOverrides(
      buildModePropertyOverrides(intent.mode),
      input.properties ?? {},
    )

    await this.requestJson<null>('/start', 'POST', {
      request_id: requestId,
      channel_name: channelName,
      user_uid: userUid,
      bot_uid: botUid,
      graph_name: graphName,
      timeout: timeoutSeconds,
      properties,
    })

    const tokenResponse = await this.requestJson<TenTokenResponse>(
      '/token/generate',
      'POST',
      {
        request_id: requestId,
        channel_name: channelName,
        uid: userUid,
      },
    )

    return {
      requestId,
      channelName,
      graphName,
      userUid,
      botUid,
      appId: tokenResponse.data.appId,
      token: tokenResponse.data.token,
      rtmUserId: String(userUid),
      rtmChannelName: channelName,
      rtmToken: tokenResponse.data.token,
      timeoutSeconds,
      controlServerUrl: this.controlServerUrl,
      intent,
      readiness,
    }
  }

  public async stopSession(input: StopRtcSessionInput): Promise<void> {
    this.ensureConfigured()

    await this.requestJson<null>('/stop', 'POST', {
      request_id: input.requestId?.trim() || uuidv4(),
      channel_name: sanitizeChannelName(input.channelName),
    })
  }

  public async pingSession(input: PingRtcSessionInput): Promise<void> {
    this.ensureConfigured()

    await this.requestJson<null>('/ping', 'POST', {
      request_id: input.requestId?.trim() || uuidv4(),
      channel_name: sanitizeChannelName(input.channelName),
    })
  }

  private ensureConfigured(): void {
    if (!this.controlServerUrl) {
      throw new RtcOrchestrationError(
        'TEN_AGENT_SERVER_URL is not configured. RTC orchestration is unavailable.',
        503,
      )
    }
  }

  private parseTimeout(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value || '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  private async requestJson<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<TenControlResponse<T>> {
    const url = new URL(path, ensureTrailingSlash(this.controlServerUrl))
    const payload = body ? JSON.stringify(body) : undefined
    const transport = url.protocol === 'https:' ? https : http

    return new Promise((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method,
          headers: payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : undefined,
        },
        (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })

          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8')

            if (response.statusCode && response.statusCode >= 400) {
              reject(
                new RtcOrchestrationError(
                  `TEN agent control request failed (${response.statusCode}): ${raw || response.statusMessage || 'unknown error'}`,
                  502,
                ),
              )
              return
            }

            try {
              const parsed = JSON.parse(raw) as TenControlResponse<T>
              resolve(parsed)
            } catch (error) {
              reject(
                new RtcOrchestrationError(
                  `TEN agent control returned invalid JSON: ${String(error)}`,
                  502,
                ),
              )
            }
          })
        },
      )

      request.on('error', (error) => {
        reject(
          new RtcOrchestrationError(
            `Failed to reach TEN agent control server: ${error.message}`,
            502,
          ),
        )
      })

      if (payload) {
        request.write(payload)
      }

      request.end()
    })
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function normalizeUid(value: number | undefined): number | null {
  if (!Number.isInteger(value) || !value || value <= 0) {
    return null
  }

  return value
}

function normalizePositiveInt(value: number | undefined): number | null {
  if (!Number.isInteger(value) || !value || value <= 0) {
    return null
  }

  return value
}

function generateRtcUid(existingUid?: number): number {
  let candidate = 0

  do {
    candidate = 100000 + Math.floor(Math.random() * 800000)
  } while (candidate === existingUid)

  return candidate
}

function buildChannelName(mode: RtcSessionMode | undefined): string {
  const prefix =
    mode === 'training'
      ? 'voxtrain'
      : mode === 'quick_talk'
        ? 'voxquick'
        : 'voxrtc'
  return `${prefix}_${Date.now().toString(36)}_${uuidv4().slice(0, 8)}`
}

function buildModePropertyOverrides(
  mode: RtcSessionMode | undefined,
): RtcPropertyOverrides {
  if (mode !== 'training') {
    return {}
  }

  // Keep training on the same shared app/memory path, but turn off
  // conversation-oriented behaviors that do not belong to practice mode.
  return {
    main_control: {
      enable_greeting: false,
      enable_correction: false,
      enable_interrupt: false,
    },
  }
}

function resolveSessionIntent(input: StartRtcSessionInput): RtcResolvedSessionIntent {
  const requestedMode = input.intent?.mode ?? input.mode ?? 'communication'
  const mode = requestedMode
  const requestedStrategy =
    input.intent?.sessionStrategy ??
    (mode === 'quick_talk' ? 'light_voice' : 'heavy_realtime')
  const resolvedStrategy =
    requestedStrategy === 'light_voice'
      ? 'heavy_realtime'
      : requestedStrategy
  const surface = resolveSurface(input.intent?.surface, mode)
  const requestedCapabilities = resolveRequestedCapabilities(
    mode,
    input.intent?.requestedCapabilities,
  )
  const grantedCapabilities = requestedCapabilities.filter((capability) =>
    MODE_CAPABILITY_MATRIX[mode].includes(capability),
  )

  return {
    surface,
    mode,
    sessionStrategy: resolvedStrategy,
    requestedCapabilities,
    grantedCapabilities,
    scene: input.intent?.scene ?? null,
    deviceContext: {
      secureContext: input.intent?.deviceContext?.secureContext,
      mediaDevicesSupported: input.intent?.deviceContext?.mediaDevicesSupported,
      microphoneStatus: input.intent?.deviceContext?.microphoneStatus,
      networkOnline: input.intent?.deviceContext?.networkOnline,
    },
  }
}

function resolveSurface(
  surface: RtcSurface | undefined,
  mode: RtcSessionMode,
): RtcSurface {
  if (surface) {
    return surface
  }

  if (mode === 'training') {
    return 'training_workspace'
  }

  if (mode === 'quick_talk') {
    return 'pwa_quick_talk'
  }

  return 'communication_workspace'
}

function resolveRequestedCapabilities(
  mode: RtcSessionMode,
  requestedCapabilities: RtcCapabilityId[] | undefined,
): RtcCapabilityId[] {
  if (!requestedCapabilities || requestedCapabilities.length === 0) {
    return [...MODE_CAPABILITY_MATRIX[mode]]
  }

  const deduped = new Set<RtcCapabilityId>()
  for (const capability of requestedCapabilities) {
    if (MODE_CAPABILITY_MATRIX[mode].includes(capability)) {
      deduped.add(capability)
    }
  }

  return [...deduped]
}

function buildSessionReadiness(
  intent: RtcResolvedSessionIntent,
): RtcSessionReadiness {
  const blockers: string[] = []
  const warnings: string[] = []
  const microphoneRequired = intent.mode === 'training'
  const requestedStrategy =
    intent.mode === 'quick_talk'
      ? 'light_voice'
      : 'heavy_realtime'
  const resolvedStrategy = intent.sessionStrategy
  const recommendedStrategy = requestedStrategy

  if (recommendedStrategy !== resolvedStrategy) {
    warnings.push(
      'light_voice 仍是预留 contract，当前控制面会回退到 heavy_realtime 执行面。',
    )
  }

  if (intent.deviceContext.networkOnline === false) {
    blockers.push('当前设备离线，暂时无法启动实时语音会话。')
  }

  if (microphoneRequired) {
    if (intent.deviceContext.secureContext === false) {
      blockers.push('训练模式需要安全上下文，当前页面请使用 HTTPS 或 localhost。')
    }

    if (intent.deviceContext.mediaDevicesSupported === false) {
      blockers.push('当前浏览器暂不支持麦克风访问，训练模式无法启动。')
    }

    if (intent.deviceContext.microphoneStatus === 'unavailable') {
      blockers.push('当前设备未准备好麦克风，训练模式请先检查设备或权限。')
    }
  } else if (intent.deviceContext.secureContext === false) {
    warnings.push('当前页面不是安全上下文，后续若要录音请切到 HTTPS 或 localhost。')
  }

  const summary = buildSessionReadinessSummary({
    mode: intent.mode,
    blockers,
    warnings,
    canStart: blockers.length === 0,
  })

  return {
    canStart: blockers.length === 0,
    requestedStrategy,
    resolvedStrategy,
    recommendedStrategy,
    microphoneRequired,
    blockers,
    warnings,
    summary,
  }
}

function buildSessionReadinessSummary(input: {
  mode: RtcSessionMode
  blockers: string[]
  warnings: string[]
  canStart: boolean
}): RtcSessionReadinessSummary {
  const blockerSummary = input.blockers[0] || null
  const warningSummary = input.warnings[0] || null

  if (!input.canStart) {
    return {
      status: 'needs_attention',
      label: '需要处理',
      detail: blockerSummary || '当前页面还不满足启动条件。',
      nextAction: '先处理当前阻塞项，再继续这一轮任务。',
      blockerSummary,
      warningSummary,
    }
  }

  if (warningSummary) {
    return {
      status: 'can_start',
      label: '可以开始',
      detail: warningSummary,
      nextAction:
        input.mode === 'training'
          ? '可以先开始这一句训练，但最好先留意这条提醒。'
          : '可以继续连接或直接表达，但最好先留意这条提醒。',
      blockerSummary,
      warningSummary,
    }
  }

  return {
    status: 'ready',
    label: '已经准备好',
    detail:
      input.mode === 'training'
        ? '这页已经满足训练会话的基础条件，可以直接开始这一句。'
        : '这页已经满足沟通会话的基础条件，可以直接连接并开始表达。',
    nextAction:
      input.mode === 'training'
        ? '可以直接点录音开始，不需要再做额外准备。'
        : '可以直接连接助手或开始表达，不需要再做额外准备。',
    blockerSummary,
    warningSummary,
  }
}

function mergePropertyOverrides(
  base: RtcPropertyOverrides,
  override: RtcPropertyOverrides,
): RtcPropertyOverrides {
  const merged: RtcPropertyOverrides = { ...base }

  Object.entries(override).forEach(([extensionName, extensionProperties]) => {
    merged[extensionName] = mergeNestedRecords(
      merged[extensionName] ?? {},
      extensionProperties,
    )
  })

  return merged
}

function mergeNestedRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }

  Object.entries(override).forEach(([key, value]) => {
    const existingValue = merged[key]
    if (isPlainRecord(existingValue) && isPlainRecord(value)) {
      merged[key] = mergeNestedRecords(existingValue, value)
      return
    }

    merged[key] = value
  })

  return merged
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeChannelName(channelName: string): string {
  const sanitized = channelName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!sanitized) {
    throw new RtcOrchestrationError('channel_name is required', 400)
  }

  return sanitized.slice(0, 64)
}
