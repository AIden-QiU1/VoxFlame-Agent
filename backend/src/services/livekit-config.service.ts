export interface LiveKitExecutionStatus {
  backend: 'livekit'
  configured: boolean
  enabled: boolean
  serverUrl: string | null
  browserUrl: string | null
  apiKeyPresent: boolean
  apiSecretPresent: boolean
  agentName: string | null
  missingEnv: string[]
  detail: string
}

export class LiveKitConfigError extends Error {
  public readonly statusCode: number

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message)
    this.name = 'LiveKitConfigError'
    this.statusCode = statusCode
  }
}

function hasNonEmptyValue(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function deriveBrowserUrlFromPublicBaseUrl(
  value: string | undefined,
): string | null {
  const publicBaseUrl = normalizeOptionalValue(value)
  if (!publicBaseUrl) {
    return null
  }

  try {
    const url = new URL(publicBaseUrl)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export class LiveKitConfigService {
  public getStatus(): LiveKitExecutionStatus {
    const serverUrl = normalizeOptionalValue(process.env.LIVEKIT_URL)
    const browserUrl =
      normalizeOptionalValue(process.env.LIVEKIT_BROWSER_URL) ??
      deriveBrowserUrlFromPublicBaseUrl(process.env.VOXFLAME_PUBLIC_BASE_URL) ??
      serverUrl
    const apiKeyPresent = hasNonEmptyValue(process.env.LIVEKIT_API_KEY)
    const apiSecretPresent = hasNonEmptyValue(process.env.LIVEKIT_API_SECRET)
    const enabled = this.isExperimentEnabled()
    const agentName = normalizeOptionalValue(process.env.LIVEKIT_AGENT_NAME)
    const missingEnv = [
      !serverUrl ? 'LIVEKIT_URL' : null,
      !apiKeyPresent ? 'LIVEKIT_API_KEY' : null,
      !apiSecretPresent ? 'LIVEKIT_API_SECRET' : null,
    ].filter((item): item is string => Boolean(item))

    const configured = missingEnv.length === 0
    let detail = 'LiveKit execution backend is not configured yet.'

    if (configured && !enabled) {
      detail = 'LiveKit credentials are present, but experiment traffic is still disabled.'
    } else if (!configured && enabled) {
      detail = `LiveKit experiment is enabled, but required env is still missing: ${missingEnv.join(', ')}.`
    } else if (configured && enabled) {
      detail = 'LiveKit experiment is enabled and credentials are present. Transport wiring can be tested next.'
    }

    return {
      backend: 'livekit',
      configured,
      enabled,
      serverUrl,
      browserUrl,
      apiKeyPresent,
      apiSecretPresent,
      agentName,
      missingEnv,
      detail,
    }
  }

  public assertCanStart(): void {
    const status = this.getStatus()

    if (!status.enabled) {
      throw new LiveKitConfigError(
        'LiveKit execution backend is not enabled yet. Set RTC_ENABLE_LIVEKIT_EXPERIMENT=1 when you are ready to run parallel migration smoke.',
        501,
      )
    }

    if (!status.configured) {
      throw new LiveKitConfigError(
        `LiveKit execution backend is enabled but missing required env: ${status.missingEnv.join(', ')}.`,
        503,
      )
    }
  }

  public isExperimentEnabled(): boolean {
    const raw = process.env.RTC_ENABLE_LIVEKIT_EXPERIMENT?.trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes'
  }
}
