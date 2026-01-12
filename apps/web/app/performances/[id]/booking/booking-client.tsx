"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Loader2 } from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { usePerformanceId } from "@/lib/use-url-params"
import { Performance, PerformanceSchedule } from "@mega-ticket/shared-types"

export default function BookingClient() {
    const router = useRouter()
    // S3 Static Export 환경: useParams() 대신 URL에서 직접 ID 추출
    const id = usePerformanceId()

    // 상태 관리 - 로딩 상태를 먼저 선언
    const [currentMonth, setCurrentMonth] = useState(() => {
        return { year: 2026, month: 2 }
    })
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedTime, setSelectedTime] = useState<string | null>(null)

    // Fetch performance data
    const [performance, setPerformance] = useState<Performance | null>(null)
    // id가 아직 없으면 로딩 중으로 간주 (SSR → CSR 하이드레이션 시 깜빡임 방지)
    const [loading, setLoading] = useState(true)
    const [isHydrated, setIsHydrated] = useState(false)

    // API 중복 호출 방지
    const hasFetched = useRef(false)

    // 하이드레이션 완료 감지
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        // 하이드레이션 전이거나 id가 없거나 이미 호출했으면 스킵
        if (!isHydrated || !id || hasFetched.current) return;

        hasFetched.current = true  // 한 번만 실행
        setLoading(true)
        apiClient.getPerformance(id)
            .then(data => {
                setPerformance(data)

                // V7.16 Fix: Automatically switch to the month of the first schedule
                if (data.schedules && data.schedules.length > 0) {
                    const sortedSchedules = [...data.schedules].sort((a, b) => a.date.localeCompare(b.date));
                    const firstDate = new Date(sortedSchedules[0].date);
                    setCurrentMonth({
                        year: firstDate.getFullYear(),
                        month: firstDate.getMonth() + 1
                    });
                }

                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [id, isHydrated])

    // 해당 월의 스케줄 날짜들
    const scheduleDates = useMemo(() => {
        return new Set(performance?.schedules?.map((s: PerformanceSchedule) => s.date) || [])
    }, [performance])

    // 선택된 날짜의 회차 정보
    const selectedSchedule = useMemo(() => {
        if (!performance?.schedules) return undefined
        const schedule = performance.schedules.find((s: PerformanceSchedule) => s.date === selectedDate)

        // [V8.2] 시간순 정렬 추가 (14:00 -> 19:00)
        if (schedule && schedule.times) {
            const sortedTimes = [...schedule.times].sort((a: any, b: any) => a.time.localeCompare(b.time));
            return { ...schedule, times: sortedTimes };
        }
        return schedule;
    }, [performance, selectedDate])

    // 달력 생성
    const calendarDays = useMemo(() => {
        const year = currentMonth.year
        const month = currentMonth.month
        const firstDay = new Date(year, month - 1, 1).getDay()
        const daysInMonth = new Date(year, month, 0).getDate()
        const days: (number | null)[] = []

        // 빈 칸 추가
        for (let i = 0; i < firstDay; i++) {
            days.push(null)
        }
        // 날짜 추가
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i)
        }
        return days
    }, [currentMonth])

    // 날짜 포맷
    const formatDate = (date: string) => {
        const d = new Date(date)
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }

    // 다음단계 클릭
    const handleNext = () => {
        if (selectedDate && selectedTime) {
            router.push(`/performances/${id}/seats?date=${selectedDate}&time=${selectedTime}`)
        }
    }

    // 이전단계 클릭
    const handleBack = () => {
        router.push(`/performances/${id}`)
    }

    // 로딩 중 (하이드레이션 전 또는 데이터 로딩 중)
    if (!isHydrated || loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-lg font-medium text-gray-600 animate-pulse">공연 정보를 불러오는 중입니다...</p>
            </div>
        )
    }

    if (!performance) {
        return <div className="container mx-auto p-8">공연 정보를 찾을 수 없습니다.</div>
    }

    return (
        <div className="min-h-screen bg-gray-50 animate-in fade-in duration-300">
            {/* 상단 진행 바 */}
            <div className="bg-white border-b">
                <div className="container mx-auto max-w-6xl px-4">
                    <div className="flex items-center justify-center py-4 gap-8 text-sm">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">1</span>
                            날짜/회차선택
                        </div>
                        <div className="w-12 h-px bg-gray-300" />
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs">2</span>
                            좌석선택
                        </div>
                        <div className="w-12 h-px bg-gray-300" />
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs">3</span>
                            결제
                        </div>
                    </div>
                </div>
            </div>

            {/* 메인 콘텐츠 */}
            <div className="container mx-auto max-w-6xl px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* 좌측: 달력 */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            날짜선택
                        </h3>

                        {/* 월 네비게이션 */}
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={() => setCurrentMonth(prev => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-bold">{currentMonth.year}.{String(currentMonth.month).padStart(2, '0')}</span>
                            <button
                                onClick={() => setCurrentMonth(prev => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 요일 헤더 */}
                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-sm text-gray-500">
                            {["일", "월", "화", "수", "목", "금", "토"].map(day => (
                                <div key={day} className={day === "일" ? "text-red-500" : day === "토" ? "text-blue-500" : ""}>{day}</div>
                            ))}
                        </div>

                        {/* 달력 */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, idx) => {
                                if (day === null) return <div key={idx} />

                                const dateStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                const hasSchedule = scheduleDates.has(dateStr)
                                const isSelected = selectedDate === dateStr
                                const dayOfWeek = new Date(dateStr).getDay()

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (hasSchedule) {
                                                setSelectedDate(dateStr)
                                                setSelectedTime(null)
                                            }
                                        }}
                                        disabled={!hasSchedule}
                                        className={`
                                            aspect-square flex items-center justify-center text-sm rounded-lg transition-all
                                            ${hasSchedule ? 'cursor-pointer hover:bg-primary/10 font-medium' : 'text-gray-300 cursor-not-allowed'}
                                            ${isSelected ? 'bg-primary text-white hover:bg-primary' : ''}
                                            ${dayOfWeek === 0 && !isSelected ? 'text-red-500' : ''}
                                            ${dayOfWeek === 6 && !isSelected ? 'text-blue-500' : ''}
                                        `}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 중앙: 회차 선택 */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            회차선택
                        </h3>

                        {selectedDate ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-500 mb-4">
                                    {formatDate(selectedDate)} ({selectedSchedule?.dayOfWeek})
                                </p>
                                {selectedSchedule?.times.map((slot: { time: string; seatCount: number; status?: string; availableSeats?: number }, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => slot.status !== "soldout" && setSelectedTime(slot.time)}
                                        disabled={slot.status === "soldout"}
                                        className={`
                                            w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between
                                            ${slot.status === "soldout" ? 'bg-gray-100 border-gray-200 cursor-not-allowed' :
                                                selectedTime === slot.time ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50'}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                                                ${selectedTime === slot.time ? 'border-primary' : 'border-gray-300'}
                                            `}>
                                                {selectedTime === slot.time && <div className="w-2 h-2 rounded-full bg-primary" />}
                                            </div>
                                            <span className={`font-medium ${slot.status === "soldout" ? 'text-gray-400' : ''}`}>
                                                {slot.time}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-medium
                                            ${slot.status === "soldout" ? 'text-red-500' :
                                                slot.status === "few" ? 'text-orange-500' : 'text-green-600'}
                                        `}>
                                            {slot.status === "soldout" ? "매진" :
                                                // [V8.2] 실시간 데이터 아님 -> 숫자 숨김
                                                "예매 가능"}
                                            {/* slot.status === "few" ? `잔여 ${slot.availableSeats}석` : `${slot.availableSeats}석` */}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>날짜를 먼저 선택해주세요</p>
                            </div>
                        )}
                    </div>

                    {/* 우측: 예매 정보 요약 */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-20 h-28 relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                <Image src={performance.posterUrl || (performance as any).poster || ""} alt={performance.title} fill className="object-cover" />
                            </div>
                            <div>
                                <span className="text-xs text-primary font-medium">뮤지컬</span>
                                <h4 className="font-bold text-lg">{performance.title}</h4>
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    {performance.venue || performance.venueId}
                                </p>
                            </div>
                        </div>

                        <hr className="my-4" />

                        <h3 className="font-bold mb-4">예매정보</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">일시</span>
                                <span className="font-medium text-right">
                                    {selectedDate && selectedTime
                                        ? `${formatDate(selectedDate)} (${selectedSchedule?.dayOfWeek}) ${selectedTime}`
                                        : "-"
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">장소</span>
                                <span className="font-medium">{performance.venue || performance.venueId}</span>
                            </div>
                        </div>

                        {selectedDate && selectedTime && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                                <p>✓ 날짜와 회차가 선택되었습니다.</p>
                                <p className="mt-1 text-xs text-blue-600">다음단계에서 좌석을 선택해주세요.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div className="flex justify-center gap-4 mt-8">
                    <Button variant="outline" size="lg" onClick={handleBack} className="px-12">
                        이전단계
                    </Button>
                    <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={!selectedDate || !selectedTime}
                        className="px-12 bg-red-500 hover:bg-red-600"
                    >
                        다음단계
                    </Button>
                </div>
            </div>
        </div>
    )
}
