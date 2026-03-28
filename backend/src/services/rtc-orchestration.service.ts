import http from 'http'
import https from 'https'
import { URL } from 'url'
import { v4 as uuidv4 } from 'uuid'

export type RtcSessionMode = 'communication' | 'training'
export type RtcPropertyOverrides = Record<string, Record<string, unknown>>

export interface StartRtcSessionInput {
  requestId?: string
  channelName?: string
  graphName?: string
  mode?: RtcSessionMode
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

  public async listGraphs(): Promise<GraphSummary[]> {
    this.ensureConfigured()
    const response = await this.requestJson<GraphSummary[]>('/graphs', 'GET')
    return Array.isArray(response.data) ? response.data : []
  }

  public async startSession(
    input: StartRtcSessionInput,
  ): Promise<RtcStartSessionResult> {
    this.ensureConfigured()

    const requestId = input.requestId?.trim() || uuidv4()
    const channelName = sanitizeChannelName(
      input.channelName?.trim() || buildChannelName(input.mode),
    )
    const graphName = input.graphName?.trim() || this.defaultGraph
    const userUid = normalizeUid(input.userUid) ?? generateRtcUid()
    const botUid = normalizeUid(input.botUid) ?? generateRtcUid(userUid)
    const timeoutSeconds =
      normalizePositiveInt(input.timeoutSeconds) ?? this.defaultTimeoutSeconds
    const properties = mergePropertyOverrides(
      buildModePropertyOverrides(input.mode),
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
  const prefix = mode === 'training' ? 'voxtrain' : 'voxrtc'
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
