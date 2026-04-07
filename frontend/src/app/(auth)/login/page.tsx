'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildLoginPath, normalizeNextPath } from '@/lib/auth/navigation'
import {
    buildLegalConsentSnapshot,
    buildLegalConsentUserData,
    persistLocalLegalConsent,
} from '@/lib/auth/legal-consent'
import { createClient, getFreshSession } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail, Lock, User } from 'lucide-react'

type Mode = 'login' | 'register'

/**
 * 友好的错误提示映射
 */
function getErrorMessage(error: { message: string }, mode: Mode): string {
    const msg = error.message.toLowerCase()

    if (mode === 'login') {
        if (msg.includes('invalid login credentials') || msg.includes('email not confirmed')) {
            return '邮箱或密码错误，请检查后重试'
        }
        if (msg.includes('email not confirmed')) {
            return '请先验证您的邮箱'
        }
        if (msg.includes('too many requests')) {
            return '请求过于频繁，请稍后再试'
        }
    }

    if (mode === 'register') {
        if (msg.includes('user already exists') || msg.includes('already registered')) {
            return '该邮箱已被注册，请直接登录'
        }
        if (msg.includes('password') && msg.includes('character')) {
            return '密码长度至少需要 6 个字符'
        }
        if (msg.includes('invalid email')) {
            return '请输入有效的邮箱地址'
        }
    }

    // 网络错误
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
        return '网络连接失败，请检查您的网络'
    }

    // 默认返回原始错误信息
    return error.message
}

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [privacyAccepted, setPrivacyAccepted] = useState(true)
    const [dataCollectionAccepted, setDataCollectionAccepted] = useState(true)

    const { toast } = useToast()
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const [nextPath, setNextPath] = useState('/')

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const params = new URLSearchParams(window.location.search)
        setNextPath(normalizeNextPath(params.get('next')))
    }, [])

    useEffect(() => {
        let cancelled = false

        async function redirectIfLoggedIn() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!cancelled && session?.user) {
                window.location.replace(nextPath)
            }
        }

        void redirectIfLoggedIn()

        return () => {
            cancelled = true
        }
    }, [nextPath, router, supabase])

    const ensureLegalConsent = (): boolean => {
        if (privacyAccepted && dataCollectionAccepted) {
            return true
        }

        toast({
            variant: "destructive",
            title: "请先确认授权文件",
            description: "登录前需要先确认《用户隐私》与《数据采集说明》。",
        })
        return false
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!ensureLegalConsent()) {
            return
        }
        setIsLoading(true)

        const consentSnapshot = buildLegalConsentSnapshot()
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            toast({
                variant: "destructive",
                title: "登录失败",
                description: getErrorMessage(error, 'login'),
            })
        } else {
            toast({
                title: "登录成功",
                description: "正在跳转...",
            })
            persistLocalLegalConsent(consentSnapshot)
            void supabase.auth.updateUser({
                data: buildLegalConsentUserData(consentSnapshot),
            }).catch((updateError) => {
                console.warn('[login] updateUser skipped after sign-in:', updateError)
            })
            await getFreshSession()
            window.location.replace(nextPath)
        }

        setIsLoading(false)
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!ensureLegalConsent()) {
            return
        }
        setIsLoading(true)

        const consentSnapshot = buildLegalConsentSnapshot()
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    ...buildLegalConsentUserData(consentSnapshot),
                },
            },
        })

        if (error) {
            toast({
                variant: "destructive",
                title: "注册失败",
                description: getErrorMessage(error, 'register'),
            })
        } else if (data.session) {
            toast({
                title: "注册成功",
                description: "已自动登录，正在跳转...",
            })
            persistLocalLegalConsent(consentSnapshot)
            await getFreshSession()
            window.location.replace(nextPath)
        } else {
            toast({
                title: "注册成功",
                description: "请先完成邮箱验证，然后再登录。",
            })
            persistLocalLegalConsent(consentSnapshot)
            router.replace(buildLoginPath(nextPath))
        }

        setIsLoading(false)
    }

    const handleSubmit = mode === 'login' ? handleLogin : handleRegister

    return (
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_36%),linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_54%,_#f8f7f4_100%)] p-4">
            <Card className="w-full max-w-md border border-amber-100 bg-white shadow-[0_24px_80px_rgba(120,53,15,0.10)]">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <h1 className="text-4xl font-normal tracking-tight">
                            <span className="text-amber-500">燃</span>
                            <span className="text-orange-500">言</span>
                        </h1>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        {mode === 'login' ? '欢迎回来' : '创建账户'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {mode === 'login'
                            ? '登录以同步您的语音数据和个性化设置'
                            : '注册以保存您的个人偏好'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div className="space-y-2">
                                <Label htmlFor="name">昵称</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="name"
                                        placeholder="您的昵称"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-9 h-11"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">邮箱地址</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-9 h-11"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-9 h-11"
                                />
                            </div>
                        </div>
                        <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                            <div className="flex items-start gap-3">
                                <input
                                    id="privacy-consent"
                                    type="checkbox"
                                    checked={privacyAccepted}
                                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                                />
                                <Label htmlFor="privacy-consent" className="space-y-1 text-sm font-normal leading-6 text-gray-700">
                                    <span className="block font-medium text-gray-900">我已阅读《用户隐私》</span>
                                    <span className="block text-pretty text-gray-600">
                                        了解燃言会保存哪些账号信息、训练数据如何隔离，以及你能如何停止使用或删除数据。
                                    </span>
                                    <Link href="/privacy" className="inline-flex text-amber-700 underline underline-offset-4">
                                        查看用户隐私
                                    </Link>
                                </Label>
                            </div>
                            <div className="mt-4 flex items-start gap-3">
                                <input
                                    id="data-consent"
                                    type="checkbox"
                                    checked={dataCollectionAccepted}
                                    onChange={(event) => setDataCollectionAccepted(event.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                                />
                                <Label htmlFor="data-consent" className="space-y-1 text-sm font-normal leading-6 text-gray-700">
                                    <span className="block font-medium text-gray-900">我已阅读《数据采集说明》</span>
                                    <span className="block text-pretty text-gray-600">
                                        了解录音样本如何进入训练语料、哪些字段会进入 manifest，以及本地待同步队列的行为边界。
                                    </span>
                                    <Link href="/data-collection" className="inline-flex text-amber-700 underline underline-offset-4">
                                        查看数据采集说明
                                    </Link>
                                </Label>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="h-11 w-full border-none bg-amber-500 text-base shadow-md transition-all active:scale-95 hover:bg-amber-600"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    处理中...
                                </>
                            ) : mode === 'login' ? (
                                '登录'
                            ) : (
                                '注册'
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col items-center gap-2 p-6">
                    <p className="text-sm text-gray-500">
                        {mode === 'login' ? '还没有账户？' : '已有账户？'}
                        <button
                            type="button"
                            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                            className="ml-1 text-amber-600 hover:text-amber-700 font-medium underline"
                        >
                            {mode === 'login' ? '立即注册' : '直接登录'}
                        </button>
                    </p>
                    <p className="text-center text-xs leading-5 text-gray-400">
                        登录完成后，训练页不再重复弹出授权勾选；录音、训练和反馈会直接围绕主任务展开。
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
