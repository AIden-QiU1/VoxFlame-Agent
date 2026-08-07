import assert from 'node:assert/strict'
import { Webhook } from 'standardwebhooks'
import {
  SmsHookRequestError,
  SmsOtpSender,
  SupabaseSmsHookService,
} from './supabase-sms-hook.service'
import {
  TencentSmsClient,
  TencentSmsSendError,
  TencentSmsService,
  isMainlandChinaPhone,
  maskPhone,
  normalizeMainlandChinaPhone,
} from './tencent-sms.service'

class FakeOtpSender implements SmsOtpSender {
  readonly calls: Array<{ phone: string; otp: string; webhookId: string }> = []

  async sendOtp(phone: string, otp: string, webhookId: string): Promise<void> {
    this.calls.push({ phone, otp, webhookId })
  }
}

async function expectHookError(operation: Promise<unknown>, statusCode: number): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    return error instanceof SmsHookRequestError && error.statusCode === statusCode
  })
}

async function testTencentAdapter(): Promise<void> {
  const requests: Array<Parameters<TencentSmsClient['SendSms']>[0]> = []
  const client: TencentSmsClient = {
    async SendSms(request) {
      requests.push(request)
      return {
        RequestId: 'request-1',
        SendStatusSet: [{ Code: 'Ok' }],
      }
    },
  }
  const environment: NodeJS.ProcessEnv = {
    TENCENTCLOUD_SECRET_ID: 'test-secret-id',
    TENCENTCLOUD_SECRET_KEY: 'test-secret-key',
    TENCENT_SMS_SDK_APP_ID: '1400000000',
    TENCENT_SMS_SIGN_NAME: '测试签名',
    TENCENT_SMS_TEMPLATE_ID: '2702800',
    TENCENT_SMS_DRY_RUN: '0',
  }
  const service = new TencentSmsService(environment, client)
  const result = await service.sendOtp('8613812345678', '123456', 'webhook-1')

  assert.deepEqual(result, { mode: 'tencent_cloud', requestId: 'request-1' })
  assert.deepEqual(requests, [{
    PhoneNumberSet: ['+8613812345678'],
    SmsSdkAppId: '1400000000',
    TemplateId: '2702800',
    SignName: '测试签名',
    TemplateParamSet: ['123456'],
    SessionContext: 'webhook-1',
  }])
  assert.equal(isMainlandChinaPhone('+8613812345678'), true)
  assert.equal(isMainlandChinaPhone('+85251234567'), false)
  assert.equal(normalizeMainlandChinaPhone('8613812345678'), '+8613812345678')
  assert.equal(normalizeMainlandChinaPhone('13812345678'), '+8613812345678')
  assert.equal(maskPhone('+8613812345678'), '+86138****5678')

  await assert.rejects(
    service.sendOtp('+8613812345678', '12345', 'webhook-2'),
    TencentSmsSendError,
  )
}

function signedHeaders(secret: string, webhookId: string, payload: string) {
  const timestamp = new Date()
  const webhook = new Webhook(secret)
  return {
    webhookId,
    webhookTimestamp: Math.floor(timestamp.getTime() / 1000).toString(),
    webhookSignature: webhook.sign(webhookId, timestamp, payload),
  }
}

async function testSignedHookAndReplayProtection(): Promise<void> {
  const secret = Buffer.from('voxflame-test-webhook-secret-32-bytes').toString('base64')
  const sender = new FakeOtpSender()
  let now = Date.now()
  const service = new SupabaseSmsHookService({
    PHONE_AUTH_ENABLED: '1',
    SUPABASE_SEND_SMS_HOOK_SECRET: `v1,whsec_${secret}`,
  }, sender, () => now)
  const payload = JSON.stringify({
    user: { phone: '8613812345678' },
    sms: { otp: '654321' },
  })
  const body = Buffer.from(payload)
  const firstHeaders = signedHeaders(secret, 'hook-1', payload)

  await service.handle(body, firstHeaders)
  await service.handle(body, firstHeaders)
  assert.deepEqual(sender.calls, [{
    phone: '+8613812345678',
    otp: '654321',
    webhookId: 'hook-1',
  }])

  await expectHookError(service.handle(body, {
    ...firstHeaders,
    webhookSignature: 'v1,invalid',
  }), 401)

  const invalidHeaders = { ...signedHeaders(secret, 'hook-2', payload), webhookSignature: 'v1,invalid' }
  await expectHookError(service.handle(body, invalidHeaders), 401)

  const secondHeaders = signedHeaders(secret, 'hook-3', payload)
  await expectHookError(service.handle(body, secondHeaders), 429)

  now += 61_000
  const thirdHeaders = signedHeaders(secret, 'hook-4', payload)
  await service.handle(body, thirdHeaders)
  assert.equal(sender.calls.length, 2)
}

async function testDisabledHook(): Promise<void> {
  const service = new SupabaseSmsHookService({ PHONE_AUTH_ENABLED: '0' }, new FakeOtpSender())
  await expectHookError(service.handle(Buffer.from('{}'), {
    webhookId: 'disabled',
    webhookTimestamp: '0',
    webhookSignature: 'invalid',
  }), 404)
}

async function main(): Promise<void> {
  await testTencentAdapter()
  await testSignedHookAndReplayProtection()
  await testDisabledHook()
  console.log('SMS auth service tests passed')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
