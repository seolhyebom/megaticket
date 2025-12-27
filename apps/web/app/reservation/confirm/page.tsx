"use client"

import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { reservationStore, ReservationSession } from "@/lib/reservation-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, MapPin, Ticket } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

function ReservationConfirmContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const holdingId = searchParams.get('holdingId')
    const expiresAt = searchParams.get('expiresAt')

    const [session, setSession] = useState<ReservationSession | null>(null)
    const [timeLeft, setTimeLeft] = useState(60) // Default fallback
    const [isProcessing, setIsProcessing] = useState(false)

    const isConfirmedRef = useRef(false) // Track if reservation is confirmed to prevent auto-release
    const isTimeoutHandled = useRef(false) // Prevent multiple alerts

    const handleTimeout = useCallback(async () => {
        isTimeoutHandled.current = true
        try {
            if (holdingId) {
                await apiClient.deleteHolding(holdingId)
            }
            alert('예약 시간이 초과되었습니다. 다시 좌석을 선택해주세요.')

            // Redirect to original performance page
            if (session?.performanceId) {
                const performaceUrl = `/performances/${session.performanceId}/seats?date=${session.date}&time=${session.time}`
                router.push(performaceUrl)
            } else {
                router.push('/')
            }

        } catch (e) {
            console.error("Timeout cleanup failed", e)
            router.push('/')
        }
    }, [holdingId, router, session?.date, session?.performanceId, session?.time])

    // 1. Initial Load & Session Check
    useEffect(() => {
        const data = reservationStore.getSession()

        // If data is missing OR holdingId is missing, invalid access
        if (!data || !holdingId) {
            alert("잘못된 접근입니다. 다시 시도해주세요.")
            router.push("/")
            return
        }
        setSession(data)

        // Initialize timer based on server expiration time
        if (expiresAt) {
            const expireDate = new Date(expiresAt)
            const now = new Date()
            const diffSeconds = Math.floor((expireDate.getTime() - now.getTime()) / 1000)

            if (!isNaN(diffSeconds)) {
                setTimeLeft(diffSeconds > 0 ? diffSeconds : 0)
            }
        }
    }, [router, holdingId, expiresAt])

    // 2. Timer Logic
    useEffect(() => {
        if (!session || !holdingId || !expiresAt) return

        const expireTime = new Date(expiresAt).getTime()

        const updateTimer = () => {
            const now = new Date().getTime()
            const diff = Math.floor((expireTime - now) / 1000)

            if (diff <= 0) {
                setTimeLeft(0)
                if (!isTimeoutHandled.current) {
                    handleTimeout()
                }
            } else {
                setTimeLeft(diff)
            }
        }

        updateTimer()
        const timer = setInterval(updateTimer, 1000)
        return () => clearInterval(timer)
    }, [session, holdingId, expiresAt, handleTimeout])

    const handlePayment = async () => {
        if (isProcessing) return
        setIsProcessing(true)

        try {
            if (!session) throw new Error("Session not found");

            await apiClient.createReservation({
                holdingId: holdingId!,
                performanceTitle: session.performanceTitle,
                venue: "Charlotte Theater"
            });

            isConfirmedRef.current = true
            router.push("/reservation/complete")

        } catch (e: unknown) {
            console.error(e)
            const err = e as Error;
            if (err.message === "Expired") {
                alert("예약 시간이 만료되었습니다.")
                router.push('/')
            } else {
                alert(err.message || "결제 처리 중 오류가 발생했습니다.")
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const formatTime = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    const handleCancel = async () => {
        if (holdingId) {
            try {
                await apiClient.deleteHolding(holdingId)
            } catch (e) {
                console.error(e)
            }
        }
        router.back()
    }

    if (!session) return <div className="p-20 text-center">로딩 중...</div>

    return (
        <div className="container mx-auto max-w-xl py-4 px-4 h-full flex flex-col justify-center items-center">
            <style jsx>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes color-pulse {
                    0%, 100% { background-color: #ffffff; color: #ea580c; }
                    50% { background-color: #fff1f2; color: #e11d48; }
                }
                @keyframes scale-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
            `}</style>
            <Card className="shadow-lg w-full overflow-hidden border-none ring-1 ring-gray-200 p-0 relative">
                <CardHeader className="bg-primary/10 border-b py-4 m-0 relative">
                    <div className="absolute top-3 right-4 z-20">
                        {/* Border Wrapper */}
                        <div className={cn(
                            "relative rounded-full p-[2px] overflow-hidden shadow-sm transition-transform duration-500",
                            timeLeft < 10 && "animate-[scale-pulse_2s_ease-in-out_infinite]"
                        )}>
                            {/* Rotating Gradient Background (Large enough to cover pill rotation) */}
                            <div className="absolute top-[-100%] left-[-100%] w-[300%] h-[300%] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,#fda4af_25%,#fb923c_50%,#fcd34d_75%,transparent_100%)] animate-[spin-slow_3s_linear_infinite]" />

                            {/* Inner Content Pill */}
                            <div className={cn(
                                "relative rounded-full bg-white px-3 py-1.5 flex items-center justify-center gap-1.5 font-mono font-bold text-lg transition-colors duration-500",
                                timeLeft < 10 && "animate-[color-pulse_4s_ease-in-out_infinite]",
                                timeLeft >= 10 && "text-orange-600"
                            )}>
                                <Clock className="w-4 h-4" />
                                <span>{formatTime(timeLeft)}</span>
                            </div>
                        </div>
                    </div>

                    <CardTitle className="text-lg text-primary text-center pt-1">{session.performanceTitle}</CardTitle>
                    <CardDescription className="text-center mt-1 text-xs">
                        남은 시간 내에 결제를 완료해주세요.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-4 pb-2 px-6 bg-white">
                    <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50/80 p-3 rounded-xl border border-gray-100 mt-2">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium text-gray-700">날짜</span>
                            <span>{session.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium text-gray-700">시간</span>
                            <span>{session.time}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <MapPin className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium text-gray-700">장소</span>
                            <span>{session.venue}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <Ticket className="w-3.5 h-3.5 text-primary" /> 선택 좌석 ({session.seats.length}매)
                        </h3>
                        {/* V7.13: 리스트 간격 조절 (space-y-1.5 -> space-y-0.5, p-3 -> p-2) */}
                        <div className="bg-gray-50 p-2 rounded-xl space-y-0.5 border border-gray-100 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {session.seats.map(seat => {
                                // V7.13: seatId에서 상세 정보 파싱 (형식: 1층-B-OP-14)
                                const parts = seat.seatId.split('-');
                                let displayText = `${seat.grade}석 ${seat.rowId || '?'}열 ${seat.seatNumber}번`;
                                if (parts.length === 4) {
                                    const [floor, section, row, num] = parts;
                                    displayText = `${floor} ${section}구역 ${row}열 ${num}번 (${seat.grade}석)`;
                                }
                                const gradeColor = (seat as any).color || '#333333';
                                return (
                                    // V7.13: 아이템 간격 조절 (p-2 -> py-0.5 px-2)
                                    <div key={seat.seatId} className="flex justify-between items-center text-sm py-0.5 px-2 hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-gray-100">
                                        <span className="font-bold shrink-0" style={{ color: gradeColor }}>
                                            {displayText}
                                        </span>
                                        <span className="text-gray-900 font-bold tracking-tight ml-2">
                                            {((seat as any).price > 0
                                                ? (seat as any).price.toLocaleString()
                                                : "가격 정보 없음")}원
                                        </span>
                                    </div>
                                );
                            })}
                            <Separator className="my-2 opacity-50" />
                            <div className="flex justify-between items-center text-lg font-bold px-1">
                                <span>총 결제 금액</span>
                                <span className="text-primary">{session.totalPrice.toLocaleString()}원</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 py-4 px-6 bg-gray-50/30">
                    <Button
                        className="w-full h-10 text-base font-bold shadow-md hover:scale-[1.01] transition-transform"
                        onClick={handlePayment}
                        disabled={isProcessing}
                    >
                        {isProcessing ? "처리 중..." : "결제 및 예약 확정"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 text-xs text-muted-foreground hover:bg-transparent hover:text-gray-900">
                        취소하고 돌아가기
                    </Button>
                </CardFooter>
            </Card>
        </div >
    )
}

export default function ReservationConfirmPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center">로딩 중...</div>}>
            <ReservationConfirmContent />
        </Suspense>
    )
}
