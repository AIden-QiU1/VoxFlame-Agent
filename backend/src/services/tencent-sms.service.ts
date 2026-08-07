import * as tencentcloud from 'tencentcloud-sdk-nodejs-sms'

interface TencentSendSmsRequest {
  PhoneNumberSet: string[]
  SmsSdkAppId: string
  TemplateId: string
  SignName: string
  TemplateParamSet: string[]
  SessionContext: string
}

interface TencentSendStatus {
  Code?: string
  Message?: string
}

interface TencentSendSmsResponse {
  SendStatusSet?: TencentSendStatus[]
  RequestId?: string
}

export interface TencentSmsClient {
  SendSms(request: TencentSendSmsRequest): Promise<TencentSendSmsResponse>
}

export interface SmsSendResult {
  mode: 'dry_run' | 'tencent_cloud'
  requestId: string | null
}

interface TencentSmsConfig {
  secretId: string
  secretKey: string
  sdkAppId: string
  signName: string
  templateId: string
  region: string
  dryRun: boolean
}

export class TencentSmsConfigurationError extends Error {}

export class TencentSmsSendError extends Error {
  constructor(
    message: string,
    readonly providerCode: string,
    readonly requestId: string | null,
  ) {
    super(message)
  }
}

export function isMainlandChinaPhone(phone: string): boolean {
  return /^\+861[3-9]\d{9}$/.test(phone)
}

/** Normalizes signed Supabase hook phone formats to Tencent's required E.164 form. */
export function normalizeMainlandChinaPhone(phone: string): string {
  const normalized = phone.trim()
  if (isMainlandChinaPhone(normalized)) {
    return normalized
  }
  if (/^861[3-9]\d{9}$/.test(normalized)) {
    return `+${normalized}`
  }
  if (/^1[3-9]\d{9}$/.test(normalized)) {
    return `+86${normalized}`
  }
  throw new TencentSmsSendError(
    'Only mainland China mobile numbers are supported',
    'INVALID_PHONE',
    null,
  )
}

export function maskPhone(phone: string): string {
  if (!isMainlandChinaPhone(phone)) {
    return 'invalid-phone'
  }

  return `${phone.slice(0, 6)}****${phone.slice(-4)}`
}

function requiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim()
  if (!value) {
    throw new TencentSmsConfigurationError(`Missing required SMS configuration: ${name}`)
  }
  return value
}

function loadConfig(environment: NodeJS.ProcessEnv): TencentSmsConfig {
  return {
    secretId: requiredEnvironmentValue(environment, 'TENCENTCLOUD_SECRET_ID'),
    secretKey: requiredEnvironmentValue(environment, 'TENCENTCLOUD_SECRET_KEY'),
    sdkAppId: requiredEnvironmentValue(environment, 'TENCENT_SMS_SDK_APP_ID'),
    signName: requiredEnvironmentValue(environment, 'TENCENT_SMS_SIGN_NAME'),
    templateId: requiredEnvironmentValue(environment, 'TENCENT_SMS_TEMPLATE_ID'),
    region: environment.TENCENT_SMS_REGION?.trim() || 'ap-guangzhou',
    dryRun: environment.TENCENT_SMS_DRY_RUN !== '0',
  }
}

function createTencentSmsClient(config: TencentSmsConfig): TencentSmsClient {
  const SmsClient = tencentcloud.sms.v20210111.Client
  return new SmsClient({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: config.region,
    profile: {
      signMethod: 'TC3-HMAC-SHA256',
      httpProfile: {
        endpoint: 'sms.tencentcloudapi.com',
        protocol: 'https://',
        reqMethod: 'POST',
        reqTimeout: 3,
      },
    },
  })
}

/** Sends exactly one six-digit Supabase OTP through the approved Tencent template. */
export class TencentSmsService {
  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly injectedClient?: TencentSmsClient,
  ) {}

  async sendOtp(phone: string, otp: string, webhookId: string): Promise<SmsSendResult> {
    const normalizedPhone = normalizeMainlandChinaPhone(phone)
    if (!/^\d{6}$/.test(otp)) {
      throw new TencentSmsSendError('OTP must contain exactly six digits', 'INVALID_OTP', null)
    }

    const config = loadConfig(this.environment)
    const maskedPhone = maskPhone(normalizedPhone)
    const startedAt = Date.now()

    if (config.dryRun) {
      console.info('[TencentSms] dry-run accepted', {
        phone: maskedPhone,
        webhookId,
      })
      return { mode: 'dry_run', requestId: null }
    }

    const client = this.injectedClient || createTencentSmsClient(config)
    let response: TencentSendSmsResponse
    try {
      response = await client.SendSms({
        PhoneNumberSet: [normalizedPhone],
        SmsSdkAppId: config.sdkAppId,
        TemplateId: config.templateId,
        SignName: config.signName,
        TemplateParamSet: [otp],
        SessionContext: webhookId.slice(0, 128),
      })
    } catch (_error: unknown) {
      console.warn('[TencentSms] provider request did not complete', {
        phone: maskedPhone,
        latencyMs: Date.now() - startedAt,
      })
      throw new TencentSmsSendError('Tencent Cloud SMS request failed', 'REQUEST_FAILED', null)
    }

    const requestId = response.RequestId || null
    const status = response.SendStatusSet?.[0]
    if (!status || status.Code !== 'Ok') {
      console.warn('[TencentSms] provider rejected request', {
        phone: maskedPhone,
        requestId,
        providerCode: status?.Code || 'MISSING_STATUS',
        latencyMs: Date.now() - startedAt,
      })
      throw new TencentSmsSendError(
        'Tencent Cloud rejected the SMS request',
        status?.Code || 'MISSING_STATUS',
        requestId,
      )
    }

    console.info('[TencentSms] provider accepted request', {
      phone: maskedPhone,
      requestId,
      latencyMs: Date.now() - startedAt,
    })
    return { mode: 'tencent_cloud', requestId }
  }
}
