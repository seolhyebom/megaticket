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
import { parseSeatId, calculateGlobalSeatNumber } from "@mega-ticket/shared-types"

// [V8.22] 등급별 색상 기본값 - DB seatColors가 없을 때 fallback으로 사용
const GRADE_COLORS: Record<string, string> = {
    'OP': '#9E37D1',   // 보라색 (오케스트라 피트)
    'VIP': '#FF0000',  // 빨간색
    'R': '#8B5CF6',    // 보라색
    'S': '#1E90FF',    // 파란색
    'A': '#32CD32',    // 초록색
};

// [V8.17] 등급 정렬 순서
const GRADE_ORDER = ['OP', 'VIP', 'R', 'S', 'A'];

function ReservationConfirmContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const holdingId = searchParams.get('holdingId')
    const expiresAt = searchParams.get('expiresAt')
    const remainingSecondsParam = searchParams.get('remainingSeconds')

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
        const loadSession = async () => {
            let data: ReservationSession | null = null;

            // [V8.10 FIX] holdingId가 있으면 무조건 서버에서 먼저 조회!
            // sessionStorage 데이터는 SeatMap에서 저장된 것이므로 챗봇 선점과 충돌할 수 있음
            if (holdingId) {
                try {
                    console.log('[ReservationConfirm] Fetching holding from server:', holdingId);
                    const res = await fetch(`/api/holdings/${holdingId}`);
                    if (res.ok) {
                        const holdingData = await res.json();

                        // [V8.22] Sections 및 seatColors 정보 가져오기 (TTL 7일 적용된 performance API 사용)
                        let sections = [];
                        let seatColors: Record<string, string> = {};
                        try {
                            const perfRes = await fetch(`/api/performances/${holdingData.performanceId}`);
                            if (perfRes.ok) {
                                const perfData = await perfRes.json();
                                sections = perfData.sections || [];
                                seatColors = perfData.seatColors || {};
                            }
                        } catch (e) { console.error("Failed to fetch performance data", e); }

                        // [V8.13 FIX] totalPrice 계산 (서버에서 안 주면 클라이언트에서 계산)
                        const calculatedTotalPrice = holdingData.totalPrice ??
                            (holdingData.seats?.reduce((sum: number, s: any) => sum + (s.price || 0), 0) || 0);

                        data = {
                            performanceId: holdingData.performanceId,
                            performanceTitle: holdingData.performanceTitle || '공연 정보 로딩 중...',
                            venue: holdingData.venue || '',
                            date: holdingData.date,
                            time: holdingData.time,
                            seats: holdingData.seats,
                            totalPrice: calculatedTotalPrice,
                            sections: sections,
                            seatColors: seatColors  // [V8.22] DB seatColors 저장
                        };

                        console.log('[ReservationConfirm] Loaded from server:', {
                            holdingId,
                            performanceTitle: data.performanceTitle,
                            venue: data.venue,
                            totalPrice: data.totalPrice,
                            seatCount: data.seats.length,
                            seatIds: data.seats.map((s: any) => s.seatId)
                        });
                    }
                } catch (e) {
                    console.error("Failed to fetch holding from server", e);
                }
            }

            // [V8.10] 서버 조회 실패 시에만 sessionStorage fallback
            if (!data) {
                data = reservationStore.getSession();
                if (data) {
                    console.log('[ReservationConfirm] Fallback to sessionStorage:', {
                        seatCount: data.seats.length,
                        seatIds: data.seats.map((s: any) => s.seatId)
                    });
                }
            }

            // If data is still missing OR holdingId is missing, invalid access
            if (!data || !holdingId) {
                alert("잘못된 접근입니다. 다시 시도해주세요.")
                router.push("/")
                return
            }
            setSession(data)
        };

        loadSession();

        // V8.9: expiresAt 기반으로만 타이머 계산 (동일 - 변경 없음)
        if (expiresAt) {
            const expireDate = new Date(expiresAt)
            const now = new Date()
            const diffSeconds = Math.floor((expireDate.getTime() - now.getTime()) / 1000)

            if (!isNaN(diffSeconds)) {
                setTimeLeft(Math.max(diffSeconds, 0))
            }
        } else if (remainingSecondsParam) {
            const serverRemainingSeconds = parseInt(remainingSecondsParam, 10)
            if (!isNaN(serverRemainingSeconds) && serverRemainingSeconds > 0) {
                setTimeLeft(serverRemainingSeconds)
            }
        }
    }, [router, holdingId, expiresAt, remainingSecondsParam])


    // 2. Timer Logic - Countdown 방식 (서버 시간 차이 문제 해결)
    useEffect(() => {
        if (!session || !holdingId) return

        // 매초 1씩 감소하는 countdown 방식
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    if (!isTimeoutHandled.current) {
                        handleTimeout()
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [session, holdingId, handleTimeout])

    const handlePayment = async () => {
        if (isProcessing) return
        setIsProcessing(true)

        try {
            if (!session) throw new Error("Session not found");

            await apiClient.createReservation({
                holdingId: holdingId!,
                performanceTitle: session.performanceTitle,
                venue: session.venue || "샤롯데씨어터"
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

                    <CardTitle className="text-lg text-primary text-center pt-1">{session.performanceTitle || '공연 정보 로딩 중...'}</CardTitle>
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
                            <span>{session.venue || '샤롯데씨어터'}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <Ticket className="w-3.5 h-3.5 text-primary" /> 선택 좌석 ({session.seats.length}매)
                        </h3>
                        {/* V7.13: 리스트 간격 조절 (space-y-1.5 -> space-y-0.5, p-3 -> p-2) */}
                        <div className="bg-gray-50 p-2 rounded-xl space-y-0.5 border border-gray-100 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {/* [V8.17 FIX] 좌석 정렬: OP → VIP → R → S → A 순서 */}
                            {[...session.seats].sort((a, b) => {
                                const orderA = GRADE_ORDER.indexOf(a.grade);
                                const orderB = GRADE_ORDER.indexOf(b.grade);
                                // 같은 등급이면 좌석 번호순
                                if (orderA === orderB) {
                                    return (a.seatId || '').localeCompare(b.seatId || '');
                                }
                                return orderA - orderB;
                            }).map(seat => {
                                // [V8.17 FIX] seatId에서 직접 정보 추출
                                // seatId 형식: "1층-B-1-6" (마지막 숫자는 로컬 번호)
                                const { floor, sectionId, rowId, localNumber } = parseSeatId(seat.seatId);

                                // [V8.18 FIX] 로컬 번호를 글로벌 번호로 변환 (sections 필요)
                                // sections가 있으면 변환, 없으면 로컬 번호 그대로 사용
                                let displayNumber = localNumber;
                                if (session.sections && session.sections.length > 0) {
                                    const floorSections = session.sections.filter((s: any) => s.floor === floor);
                                    displayNumber = calculateGlobalSeatNumber(sectionId, rowId, localNumber, floorSections, floor);
                                }

                                const displayText = `${floor} ${sectionId}구역 ${rowId}열 ${displayNumber}번 (${seat.grade}석)`;
                                // [V8.22 FIX] DB seatColors(TTL 7일) 우선, 없으면 seat.color, 최종 GRADE_COLORS fallback
                                const gradeColor = session.seatColors?.[seat.grade] || (seat as any).color || GRADE_COLORS[seat.grade] || '#333333';

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
                                <span className="text-primary">{(session.totalPrice ?? 0).toLocaleString()}원</span>
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
