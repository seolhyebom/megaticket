"use client"

import { SeatMap } from "@/components/seats/seat-map"
import { useSearchParams, useRouter } from "next/navigation"
import { reservationStore } from "@/lib/reservation-store"
import { useAuth } from "@/contexts/auth-context"
import { usePerformanceId } from "@/lib/use-url-params"
import { Seat, Performance } from "@mega-ticket/shared-types"
import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"

// V9.3: 통합 로딩 UI 컴포넌트 (Suspense fallback과 동일한 레이아웃)
function LoadingOverlay() {
    return (
        <div className="h-[calc(100vh-64px)] flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-lg font-medium text-gray-600 animate-pulse">좌석 정보를 불러오는 중입니다...</p>
            </div>
        </div>
    )
}

function SeatsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    // V9.2: useAuth를 최상단에서 호출
    const { user, isLoading: authLoading } = useAuth()

    // V9.2: 인증 확인 완료 전까지 early return (API 호출 방지)
    if (authLoading) {
        return <LoadingOverlay />
    }

    return <SeatsContentInner user={user} searchParams={searchParams} router={router} />
}

// V9.3: 인증 확인 완료 후에만 렌더링되는 내부 컴포넌트
function SeatsContentInner({ user, searchParams, router }: {
    user: any,
    searchParams: ReturnType<typeof useSearchParams>,
    router: ReturnType<typeof useRouter>
}) {
    // S3 Static Export 환경: useParams() 대신 URL에서 직접 ID 추출
    const performanceId = usePerformanceId() || ""

    const [performance, setPerformance] = useState<Performance | null>(null);
    const [performanceTitle, setPerformanceTitle] = useState("")
    const [performanceLoading, setPerformanceLoading] = useState(true)
    const [mapLoading, setMapLoading] = useState(true)
    const [isHydrated, setIsHydrated] = useState(false)

    // API 중복 호출 방지
    const hasFetched = useRef(false)

    const date = searchParams.get("date") || "2025-12-25"
    const time = searchParams.get("time") || "19:00"

    // 하이드레이션 완료 감지
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        // 하이드레이션 전이거나 performanceId가 없거나 이미 호출했으면 스킵
        if (!isHydrated || !performanceId || hasFetched.current) return;

        hasFetched.current = true  // 한 번만 실행
        setPerformanceLoading(true)
        apiClient.getPerformance(performanceId)
            .then((data) => {
                setPerformance(data);
                if (data.title) setPerformanceTitle(data.title);
                setPerformanceLoading(false);
            }).catch(err => {
                console.error(err);
                setPerformanceLoading(false);
            });
    }, [performanceId, isHydrated]);

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

    const handleLoadComplete = useCallback(() => {
        setMapLoading(false)
    }, [])

    const handleSelectionComplete = async (selectedSeats: Seat[], totalPrice: number) => {
        if (isSubmitting) return
        setIsSubmitting(true)

        // Ensure user is logged in or use a guest ID fallback (though consistent login is preferred)
        // [Modified] Use email as unique identifier for reservations
        const userId = user?.email || "guest-user-1"

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

    // V9.3: 인증 완료 + 하이드레이션 완료 + performance 로드 완료 후에만 SeatMap 렌더링
    // 이렇게 하면 SeatMap에 performance를 전달하여 중복 API 호출 방지
    const isLoading = !isHydrated || performanceLoading;

    // V9.3: performance가 로드되기 전에는 로딩 화면만 표시
    if (isLoading || !performance) {
        return <LoadingOverlay />
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col relative overflow-hidden animate-in fade-in duration-300">
            {/* V9.3: mapLoading은 SeatMap 내부에서 처리 - 여기서는 별도 오버레이 불필요 */}

            {/* Error Message Overlay */}
            {showError && errorMsg && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] animate-in fade-in zoom-in duration-300 pointer-events-none">
                    <div className="bg-red-400/90 text-white px-8 py-4 rounded-full shadow-2xl backdrop-blur-sm flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="font-bold text-lg">{errorMsg}</span>
                    </div>
                </div>
            )}

            {/* V9.3: performance가 로드된 후에만 SeatMap 렌더링 → SeatMap 내부에서 중복 API 호출 방지 */}
            <SeatMap
                performanceId={performanceId}
                date={date}
                time={time}
                isSubmitting={isSubmitting}
                onSelectionComplete={handleSelectionComplete}
                onLoadComplete={handleLoadComplete}
                performance={performance}
            />
        </div>
    )
}

export default function SeatsClient() {
    return (
        <Suspense fallback={<LoadingOverlay />}>
            <SeatsContent />
        </Suspense>
    )
}
