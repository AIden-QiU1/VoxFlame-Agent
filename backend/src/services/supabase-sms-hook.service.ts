import { Webhook, WebhookVerificationError } from 'standardwebhooks'
import {
  TencentSmsService,
  normalizeMainlandChinaPhone,
} from './tencent-sms.service'

interface SupabaseSendSmsEvent {
  user: {
    phone: string
  }
  sms: {
    otp: string
  }
}

export interface SmsHookHeaders {
  webhookId: string
  webhookTimestamp: string
  webhookSignature: string
}

export class SmsHookRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

interface PhoneRateState {
  timestamps: number[]
}

interface ReplayState {
  expiresAt: number
  operation: Promise<void>
}

export interface SmsOtpSender {
  sendOtp(phone: string, otp: string, webhookId: string): Promise<unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSendSmsEvent(value: unknown): SupabaseSendSmsEvent {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.sms)) {
    throw new SmsHookRequestError(400, 'INVALID_PAYLOAD', 'Invalid Send SMS Hook payload')
  }

  const phone = value.user.phone
  const otp = value.sms.otp
  if (typeof phone !== 'string' || typeof otp !== 'string') {
    throw new SmsHookRequestError(400, 'INVALID_PAYLOAD', 'Invalid Send SMS Hook payload')
  }

  return { user: { phone }, sms: { otp } }
}

/** Verifies Supabase Standard Webhooks signatures before any SMS side effect. */
export class SupabaseSmsHookService {
  private readonly phoneRates = new Map<string, PhoneRateState>()
  private readonly replayStates = new Map<string, ReplayState>()

  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly smsService: SmsOtpSender = new TencentSmsService(environment),
    private readonly now: () => number = Date.now,
  ) {}

  async handle(rawBody: Buffer, headers: SmsHookHeaders): Promise<void> {
    if (this.environment.PHONE_AUTH_ENABLED !== '1') {
      throw new SmsHookRequestError(404, 'PHONE_AUTH_DISABLED', 'Not found')
    }

    const hookSecret = this.environment.SUPABASE_SEND_SMS_HOOK_SECRET?.trim()
    if (!hookSecret) {
      throw new SmsHookRequestError(503, 'HOOK_NOT_CONFIGURED', 'SMS hook is not configured')
    }
    if (!headers.webhookId || !headers.webhookTimestamp || !headers.webhookSignature) {
      throw new SmsHookRequestError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature')
    }

    this.removeExpiredReplayStates()
    let verifiedPayload: unknown
    try {
      const webhook = new Webhook(hookSecret.replace(/^v1,whsec_/, ''))
      verifiedPayload = webhook.verify(rawBody, {
        'webhook-id': headers.webhookId,
        'webhook-timestamp': headers.webhookTimestamp,
        'webhook-signature': headers.webhookSignature,
      })
    } catch (error: unknown) {
      if (error instanceof WebhookVerificationError || error instanceof Error) {
        throw new SmsHookRequestError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature')
      }
      throw error
    }

    const existingReplay = this.replayStates.get(headers.webhookId)
    if (existingReplay) {
      return existingReplay.operation
    }

    const event = parseSendSmsEvent(verifiedPayload)
    const operation = this.sendVerifiedEvent(event, headers.webhookId)
    this.replayStates.set(headers.webhookId, {
      expiresAt: this.now() + 10 * 60 * 1000,
      operation,
    })
    return operation
  }

  private async sendVerifiedEvent(event: SupabaseSendSmsEvent, webhookId: string): Promise<void> {
    const normalizedPhone = normalizeMainlandChinaPhone(event.user.phone)
    this.enforcePhoneRateLimit(normalizedPhone)
    await this.smsService.sendOtp(normalizedPhone, event.sms.otp, webhookId)
  }

  private enforcePhoneRateLimit(phone: string): void {
    const now = this.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    const hourAgo = now - 60 * 60 * 1000
    const state = this.phoneRates.get(phone) || { timestamps: [] }
    const recent = state.timestamps.filter((timestamp) => timestamp > dayAgo)

    if (recent.some((timestamp) => timestamp > now - 60 * 1000)) {
      throw new SmsHookRequestError(429, 'SMS_RATE_LIMITED', 'Please wait before requesting another code')
    }
    if (recent.filter((timestamp) => timestamp > hourAgo).length >= 5 || recent.length >= 10) {
      throw new SmsHookRequestError(429, 'SMS_RATE_LIMITED', 'Too many verification code requests')
    }

    recent.push(now)
    this.phoneRates.set(phone, { timestamps: recent })
  }

  private removeExpiredReplayStates(): void {
    const now = this.now()
    for (const [webhookId, replay] of this.replayStates.entries()) {
      if (replay.expiresAt <= now) {
        this.replayStates.delete(webhookId)
      }
    }
  }
}
