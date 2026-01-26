'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSent, setIsSent] = useState(false)

    const { toast } = useToast()
    const supabase = createClient()

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        // Check if we are localhost
        const redirectUrl = `${window.location.origin}/auth/callback`

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: redirectUrl,
            },
        })

        if (error) {
            toast({
                variant: "destructive",
                title: "登录失败",
                description: error.message,
            })
        } else {
            setIsSent(true)
            toast({
                title: "邮件已发送",
                description: "请检查您的邮箱点击登录链接。",
            })
        }

        setIsLoading(false)
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        {/* Logo placeholder - using text for now */}
                        <h1 className="text-4xl font-normal tracking-tight">
                            <span className="text-amber-500">燃</span>
                            <span className="text-orange-500">言</span>
                        </h1>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">欢迎回来</CardTitle>
                    <CardDescription className="text-center">
                        登录或注册以同步您的语音数据和个性化设置
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSent ? (
                        <div className="text-center space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <Mail className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="text-green-800 bg-green-50 p-4 rounded-lg border border-green-100">
                                <p className="font-medium">登录链接已发送</p>
                                <p className="text-sm mt-1 text-green-700">请检查 <strong>{email}</strong> 的收件箱</p>
                            </div>
                            <Button variant="outline" onClick={() => setIsSent(false)} className="w-full">
                                使用其他邮箱
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full">
                            <form onSubmit={handleEmailLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">邮箱地址</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                                <Button type="submit" className="w-full h-11 text-base bg-amber-500 hover:bg-amber-600 border-none shadow-md transition-all active:scale-95" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            处理中...
                                        </>
                                    ) : (
                                        "发送登录/注册链接 (Magic Link)"
                                    )}
                                </Button>
                            </form>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center border-t border-gray-100 p-6">
                    <p className="text-xs text-center text-gray-400">
                        登录即代表您同意我们的<br />
                        <a href="#" className="underline hover:text-gray-600">服务条款</a> 和 <a href="#" className="underline hover:text-gray-600">隐私政策</a>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
