'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

    const { toast } = useToast()
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

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
            router.push('/')
        }

        setIsLoading(false)
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                },
            },
        })

        if (error) {
            toast({
                variant: "destructive",
                title: "注册失败",
                description: getErrorMessage(error, 'register'),
            })
        } else {
            toast({
                title: "注册成功",
                description: "已自动登录，正在跳转...",
            })
            router.push('/')
        }

        setIsLoading(false)
    }

    const handleSubmit = mode === 'login' ? handleLogin : handleRegister

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
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
                        <Button
                            type="submit"
                            className="w-full h-11 text-base bg-amber-500 hover:bg-amber-600 border-none shadow-md transition-all active:scale-95"
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
                    <p className="text-xs text-center text-gray-400">
                        登录即代表您同意我们的
                        <a href="#" className="underline hover:text-gray-600">服务条款</a> 和 <a href="#" className="underline hover:text-gray-600">隐私政策</a>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
