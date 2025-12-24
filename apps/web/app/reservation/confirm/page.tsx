"use client"

import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { reservationStore, ReservationSession } from "@/lib/reservation-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, MapPin, Ticket } from "lucide-react"
import { apiClient } from "@/lib/api-client"

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
            <Card className="shadow-lg w-full overflow-hidden border-none ring-1 ring-gray-200 p-0 relative">
                <div className={`absolute top-0 left-0 right-0 h-1 z-10 transition-all duration-1000 ${timeLeft < 10 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${(timeLeft / 60) * 100}%` }} />

                <CardHeader className="bg-primary/10 border-b py-4 m-0 relative">
                    <div className="absolute top-3 right-4 font-mono font-bold text-lg bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm border border-white/20 shadow-sm">
                        <span className={timeLeft < 10 ? 'text-red-600 animate-pulse' : 'text-primary'}>
                            {formatTime(timeLeft)}
                        </span>
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
                        <div className="bg-gray-50 p-3 rounded-xl space-y-1.5 border border-gray-100 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {session.seats.map(seat => (
                                <div key={seat.seatId} className="flex justify-between items-center text-sm p-1 hover:bg-white rounded transition-colors">
                                    <span className="font-medium text-gray-600">{seat.grade}석 {seat.rowId}열 {seat.seatNumber}번</span>
                                    <span className="text-gray-900 font-bold tracking-tight">
                                        {((seat as any).price > 0
                                            ? (seat as any).price.toLocaleString()
                                            : "가격 정보 없음")}원
                                    </span>
                                </div>
                            ))}
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
        </div>
    )
}

export default function ReservationConfirmPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center">로딩 중...</div>}>
            <ReservationConfirmContent />
        </Suspense>
    )
}
