'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, CheckCircle2, Loader2, Mail, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { displayMainlandPhone, normalizeMainlandPhone } from '@/lib/auth/phone'

type BindingStep = 'phone' | 'otp'

function phoneAuthMessage(error: { message: string }): string {
  const message = error.message.toLowerCase()
  if (message.includes('already') || message.includes('duplicate')) {
    return '这个手机号已经绑定了其他账号。'
  }
  if (message.includes('rate') || message.includes('too many')) {
    return '请求过于频繁，请稍后再试。'
  }
  if (message.includes('otp') && (message.includes('invalid') || message.includes('expired'))) {
    return '验证码错误或已过期，请重新获取。'
  }
  if (message.includes('phone provider') || message.includes('unsupported phone')) {
    return '手机号功能尚未启用，请暂时使用邮箱登录。'
  }
  return error.message
}

export default function AccountSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<BindingStep>('phone')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('绑定后，您仍可继续使用原邮箱和密码登录。')
  const [isError, setIsError] = useState(false)
  const phoneAuthEnabled = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === '1'

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) {
        return
      }
      if (!data.user) {
        window.location.replace('/login?next=%2Fsettings%2Faccount')
        return
      }
      setUser(data.user)
      setIsLoadingUser(false)
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  const requestBindingCode = async () => {
    let normalizedPhone: string
    try {
      normalizedPhone = normalizeMainlandPhone(phone)
    } catch (error: unknown) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : '请输入正确的手机号。')
      return
    }

    setIsSubmitting(true)
    setIsError(false)
    const { error } = await supabase.auth.updateUser({ phone: normalizedPhone })
    setIsSubmitting(false)

    if (error) {
      setIsError(true)
      setMessage(phoneAuthMessage(error))
      return
    }

    setStep('otp')
    setMessage(`验证码已发送至 ${displayMainlandPhone(normalizedPhone)}，5 分钟内有效。`)
  }

  const verifyBindingCode = async () => {
    let normalizedPhone: string
    try {
      normalizedPhone = normalizeMainlandPhone(phone)
    } catch (error: unknown) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : '请输入正确的手机号。')
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setIsError(true)
      setMessage('请输入短信中的 6 位验证码。')
      return
    }

    const originalUserId = user?.id
    setIsSubmitting(true)
    setIsError(false)
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: otp,
      type: 'phone_change',
    })
    if (error) {
      setIsSubmitting(false)
      setIsError(true)
      setMessage(phoneAuthMessage(error))
      return
    }

    const { data, error: refreshError } = await supabase.auth.getUser()
    setIsSubmitting(false)
    if (refreshError || !data.user || data.user.id !== originalUserId) {
      setIsError(true)
      setMessage('手机号已验证，但账号身份校验失败。请退出后重新登录。')
      return
    }

    setUser(data.user)
    setOtp('')
    setStep('phone')
    setMessage('手机号已绑定到当前账号，原邮箱、训练数据和沟通档案都保持不变。')
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">账号与登录</h1>
          <p className="mt-1 text-sm leading-6 text-stone-600">管理当前身份和备用登录方式，不会移动或复制您的数据。</p>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-stone-100 p-2 text-stone-700"><Mail className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-stone-950">邮箱登录</h2>
              <p className="mt-1 text-sm text-stone-600">
                {isLoadingUser ? '正在读取账号…' : user?.email || '当前账号没有邮箱'}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">现有邮箱密码登录会一直保留。</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-amber-50 p-2 text-amber-700"><Smartphone className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-stone-950">手机号登录</h2>
              {user?.phone ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    已绑定 {displayMainlandPhone(user.phone)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">现在可以在登录页选择“手机登录”。</p>
                </div>
              ) : phoneAuthEnabled ? (
                <div className="mt-4 max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="binding-phone">中国大陆手机号</Label>
                    <Input
                      id="binding-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="138 1234 5678"
                      disabled={step === 'otp' || isSubmitting}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-11"
                    />
                  </div>
                  {step === 'otp' ? (
                    <div className="space-y-2">
                      <Label htmlFor="binding-otp">6 位验证码</Label>
                      <Input
                        id="binding-otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="请输入短信验证码"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-11 text-center text-lg tracking-[0.3em]"
                      />
                    </div>
                  ) : null}
                  <p className={`rounded-xl px-3 py-2 text-sm leading-6 ${isError ? 'bg-red-50 text-red-800' : 'bg-stone-50 text-stone-600'}`}>
                    {message}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={isSubmitting || isLoadingUser}
                      onClick={() => void (step === 'phone' ? requestBindingCode() : verifyBindingCode())}
                      className="h-11 bg-amber-600 hover:bg-amber-700"
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {step === 'phone' ? '发送绑定验证码' : '确认绑定'}
                    </Button>
                    {step === 'otp' ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => {
                          setStep('phone')
                          setOtp('')
                          setMessage('可以修改手机号后重新发送验证码。')
                          setIsError(false)
                        }}
                        className="h-11"
                      >
                        修改手机号
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                  手机号登录尚未开放，现有邮箱登录不受影响。
                </p>
              )}
            </div>
          </div>
        </section>

        <p className="px-1 text-xs leading-5 text-stone-500">
          绑定动作发生在当前登录账号内，不会新建用户，也不会更改训练数据和沟通档案的归属。
        </p>
      </main>
    </div>
  )
}
