"use client"

import Link from "next/link"
import { Suspense } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Search, Menu, User, Ticket, AlertCircle } from "lucide-react"  // V7.16: AlertCircle 추가
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getAwsRegion } from "@/lib/runtime-config"

function SiteHeaderContent() {

    const [isScrolled, setIsScrolled] = useState(false)
    const [hasRecoveredReservation, setHasRecoveredReservation] = useState(false)  // V7.16: 복구 예약 여부
    const { user, logout } = useAuth()

    // V9.0: config.js의 getAwsRegion() 사용 (URL 파라미터 제거)
    const region = getAwsRegion()

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    // V7.16: 복구된 예약(DR_RECOVERED) 여부 확인
    useEffect(() => {
        const checkRecoveredReservations = async () => {
            if (!user) {
                setHasRecoveredReservation(false)
                return
            }
            try {
                console.log('[SiteHeader] Checking DR_RECOVERED reservations with region:', region);
                const response = await fetch(`/api/reservations?region=${region}&userId=${encodeURIComponent(user.id)}`)
                if (response.ok) {
                    const data = await response.json()
                    // API가 배열 자체를 반환하거나 { reservations: [] } 형태일 수 있음
                    const reservations = Array.isArray(data) ? data : (data.reservations || [])
                    const hasRecovered = reservations.some(
                        (r: { status: string }) => r.status === 'DR_RECOVERED' || r.status === 'dr_recovered'
                    )
                    setHasRecoveredReservation(hasRecovered || false)
                }
            } catch (error) {
                console.error('[SiteHeader] Failed to check recovered reservations:', error)
            }
        }
        checkRecoveredReservations()
        // 30초마다 확인 (DR_RECOVERED TTL이 15분이므로 적절한 간격)
        const interval = setInterval(checkRecoveredReservations, 30000)
        return () => clearInterval(interval)
    }, [user, region])


    return (
        <header className={cn(
            "sticky top-0 z-50 w-full transition-all duration-300",
            isScrolled ? "bg-white/80 backdrop-blur-md border-b shadow-sm" : "bg-transparent"
        )}>
            <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-center gap-4 md:gap-8">
                {/* Logo & Nav Group - Centered relative to screen with Search */}
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="font-bold text-xl md:text-2xl tracking-tight text-primary">
                            MegaTicket
                        </span>
                    </Link>
                    <nav className="hidden md:flex gap-4 lg:gap-6">
                        {[
                            { label: "뮤지컬", href: "#" },
                            { label: "콘서트", href: "#" },
                            { label: "연극", href: "#" },
                            { label: "클래식/무용", href: "#" },
                            { label: "스포츠", href: "#" },
                            { label: "전시/행사", href: "#" },
                            { label: "AI 챗봇", href: "/chat", className: "text-purple-600 font-bold hover:text-purple-700" }
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary whitespace-nowrap",
                                    item.className ? item.className : "text-muted-foreground"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>


                {/* Right Side Group */}
                <div className="flex items-center gap-4 md:gap-14">
                    <div className="relative hidden lg:block">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            type="search"
                            placeholder="공연, 전시장, 인물로 검색해보세요"
                            className="pl-9 w-[340px] bg-gray-100 border-gray-200 focus-visible:ring-1 focus-visible:ring-primary rounded-full transition-all hover:bg-white hover:shadow-sm"
                        />
                    </div>

                    <div className="flex items-center">
                        {user ? (
                            <>
                                <span className="text-sm font-medium mr-2 hidden md:block text-muted-foreground">
                                    {user.name}님
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => logout()}
                                    className="hidden md:flex gap-2 text-muted-foreground hover:text-gray-900 hover:bg-transparent"
                                >
                                    <span className="font-medium">로그아웃</span>
                                </Button>
                                <Link href="/my">
                                    <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-muted-foreground hover:text-gray-900 hover:bg-transparent relative">
                                        <Ticket className="h-5 w-5" />
                                        <span className="font-medium">내 예약</span>
                                        {/* V7.16: 복구 예약 알림 아이콘 */}
                                        {hasRecoveredReservation && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center">
                                                    <AlertCircle className="h-3 w-3 text-white" />
                                                </span>
                                            </span>
                                        )}
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <Link href="/login">
                                <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-muted-foreground hover:text-gray-900 hover:bg-transparent">
                                    <User className="h-5 w-5" />
                                    <span className="font-medium">로그인 / 회원가입</span>
                                </Button>
                            </Link>
                        )}
                    </div>

                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Menu</span>
                    </Button>
                </div>
            </div>
        </header >
    )
}

// [V8.0] Suspense 래퍼 - Next.js 15 useSearchParams 호환
export function SiteHeader() {
    return (
        <Suspense fallback={<header className="sticky top-0 z-50 w-full h-16 bg-white/80 backdrop-blur-md border-b" />}>
            <SiteHeaderContent />
        </Suspense>
    )
}
