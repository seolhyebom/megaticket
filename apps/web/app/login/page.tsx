"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LockKeyhole } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const [error, setError] = React.useState<string>("")
    const [loading, setLoading] = React.useState(false)

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(event.currentTarget)
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        try {
            await login(email, password)
            router.push("/")
        } catch {
            setError("로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-4">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary z-10">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <LockKeyhole className="w-8 h-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">로그인</CardTitle>
                    <CardDescription>
                        MegaTicket 서비스를 이용하시려면 로그인해주세요.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={onSubmit}>
                    <CardContent className="grid gap-6">
                        <div className="grid gap-2">
                            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">이메일</label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">비밀번호</label>
                                <Link href="#" className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline">
                                    비밀번호 찾기
                                </Link>
                            </div>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>
                        {error && (
                            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-md flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                                {error}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4 pt-4">
                        <Button className="w-full h-11 text-base font-medium shadow-md transition-all hover:shadow-lg" type="submit" disabled={loading}>
                            {loading ? "로그인 중..." : "로그인"}
                        </Button>
                        <div className="text-center text-sm text-gray-500 mt-2">
                            아직 회원이 아니신가요?{" "}
                            <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
                                회원가입
                            </Link>
                        </div>
                        {/* Mock Creds Hint */}
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-400 text-center">
                            테스트 계정: test@example.com / password
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
