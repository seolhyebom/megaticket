"use client"

import { SeatMap } from "@/components/seats/seat-map"
import { useSearchParams, useRouter, useParams } from "next/navigation"
import { reservationStore } from "@/lib/reservation-store"
import { useAuth } from "@/contexts/auth-context"
import { Seat, Performance } from "@mega-ticket/shared-types"
import { useState, useEffect, Suspense, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

function SeatsContent() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()

    const performanceId = params.id as string

    const [performance, setPerformance] = useState<Performance | null>(null);
    const [performanceTitle, setPerformanceTitle] = useState("")
    const [performanceLoading, setPerformanceLoading] = useState(true)
    const [mapLoading, setMapLoading] = useState(true)

    const date = searchParams.get("date") || "2025-12-25"
    const time = searchParams.get("time") || "19:00"

    useEffect(() => {
        setPerformanceLoading(true);

        apiClient.getPerformance(performanceId)
            .then((data) => {
                setPerformance(data);
                if (data.title) setPerformanceTitle(data.title);
                setPerformanceLoading(false);
            }).catch(err => {
                console.error(err);
                setPerformanceLoading(false);
            });
    }, [performanceId]);

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [showError, setShowError] = useState(false)

    useEffect(() => {
        if (showError) {
            const timer = setTimeout(() => {
                setShowError(false)
                setErrorMsg(null)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [showError])


    const { user } = useAuth() // Import useAuth hook

    const handleLoadComplete = useCallback(() => {
        setMapLoading(false)
    }, [])

    const handleSelectionComplete = async (selectedSeats: Seat[], totalPrice: number) => {
        if (isSubmitting) return
        setIsSubmitting(true)

        // Ensure user is logged in or use a guest ID fallback (though consistent login is preferred)
        const userId = user?.id || "guest-user-1"

        try {
            // V7.20: venue, performanceTitle, posterUrl 파라미터 추가 (HOLDING에 비정규화 데이터 저장)
            const res = await fetch("/api/holdings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    performanceId,
                    seats: selectedSeats,
                    userId: userId,
                    date,
                    time,
                    venue: performance?.venue || '',
                    performanceTitle: performanceTitle || '',
                    posterUrl: (performance as any)?.posterUrl || (performance as any)?.poster || ''
                })
            })

            const data = await res.json()

            if (!res.ok) {
                setErrorMsg(data.message || "이미 선택된 좌석입니다.")
                setShowError(true)
                setIsSubmitting(false)
                return
            }

            reservationStore.saveSession({
                performanceId,
                performanceTitle: performanceTitle || "공연 제목 없음",
                date,
                time,
                seats: selectedSeats,
                totalPrice,
                venue: performance?.venue || "Charlotte Theater",
                sections: performance?.sections || [] // V7.15 SSOT: 연속 번호 계산용
            })

            const expiresAtParam = data.expiresAt ? `&expiresAt=${encodeURIComponent(data.expiresAt)}` : ''
            const remainingSecondsParam = data.remainingSeconds ? `&remainingSeconds=${data.remainingSeconds}` : ''
            router.push(`/reservation/confirm?holdingId=${data.holdingId}${expiresAtParam}${remainingSecondsParam}`)

        } catch (e) {
            console.error(e)
            setErrorMsg("시스템 오류가 발생했습니다.")
            setShowError(true)
            setIsSubmitting(false)
        }
    }

    const isLoading = performanceLoading || mapLoading;

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col relative overflow-hidden">
            {/* Unified Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-lg font-medium text-gray-600 animate-pulse">좌석 정보를 불러오는 중입니다...</p>
                </div>
            )}

            {/* Error Message Overlay */}
            {showError && errorMsg && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] animate-in fade-in zoom-in duration-300 pointer-events-none">
                    <div className="bg-red-400/90 text-white px-8 py-4 rounded-full shadow-2xl backdrop-blur-sm flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="font-bold text-lg">{errorMsg}</span>
                    </div>
                </div>
            )}

            {/* SeatMap Area */}
            <SeatMap
                performanceId={performanceId}
                date={date}
                time={time}
                isSubmitting={isSubmitting}
                onSelectionComplete={handleSelectionComplete}
                onLoadComplete={handleLoadComplete}
            />
        </div>
    )
}

export default function SeatsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-lg font-medium text-gray-600 animate-pulse">좌석 정보를 불러오는 중입니다...</p>
            </div>
        }>
            <SeatsContent />
        </Suspense>
    )
}
