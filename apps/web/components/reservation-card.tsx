"use client"

import Image from "next/image"
import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { CalendarDays, MapPin, Ticket, Clock, CreditCard, AlertTriangle } from "lucide-react"
import { parseSeatId, calculateGlobalSeatNumber, SectionData } from "@mega-ticket/shared-types"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface ReservationSeat {
    grade: string
    seatNumber?: string      // Make optional
    seatId?: string          // Add support for these fields
    row?: string
    number?: number
}

export interface Reservation {
    id: string // Server uses 'id'
    reservationId?: string // Keeping for compat, but should prefer id
    userId: string
    performanceId: string  // Added for navigation
    performanceTitle: string
    posterUrl?: string
    date: string
    time: string
    venue: string
    seats: ReservationSeat[]
    totalPrice: number
    status: "confirmed" | "cancelled" | "dr_recovered" | "dr_reserved"  // V7.16: DR 상태 추가
    createdAt: string
    expiresAt?: string  // V7.16: DR_RECOVERED 만료 시간 (ISO 8601)
    sections?: SectionData[]  // V7.15 SSOT: 연속 번호 계산용
}

interface ReservationCardProps {
    reservation: Reservation
    onCancel?: (reservationId: string) => Promise<void>
    onDelete?: (reservationId: string) => Promise<void>  // V7.14: 취소내역 삭제
    onRemoveFromList?: (reservationId: string) => void   // V7.19: 목록에서 제거 (만료 시)
}


export function ReservationCard({ reservation, onCancel, onDelete, onRemoveFromList }: ReservationCardProps) {
    const isCancelled = reservation.status === "cancelled"
    const isDrRecovered = reservation.status === "dr_recovered"  // V7.16
    const isDrReserved = reservation.status === "dr_reserved"    // V7.16
    const [isCancelling, setIsCancelling] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)  // V7.14
    const [showExpiredDialog, setShowExpiredDialog] = React.useState(false)  // V7.19: 만료 AlertDialog

    // [Navigation] Get current region to preserve it
    const searchParams = useSearchParams()
    const router = useRouter()  // V7.19: 결제 페이지 이동용
    const region = searchParams.get("region") || process.env.NEXT_PUBLIC_AWS_REGION || "ap-northeast-2"
    const detailsUrl = `/performances/${reservation.performanceId}?region=${region}`

    const executeCancel = async () => {
        if (!onCancel) return
        setIsCancelling(true)
        try {
            // Use id (from server) or fallback to reservationId (mock)
            const targetId = reservation.id || reservation.reservationId || ""
            await onCancel(targetId)
        } catch (error) {
            console.error("Cancel failed", error)
            alert("예약 취소에 실패했습니다.")
        } finally {
            setIsCancelling(false)
        }
    }

    // V7.14: 취소내역 완전 삭제
    const executeDelete = async () => {
        if (!onDelete) return
        setIsDeleting(true)
        try {
            const targetId = reservation.id || reservation.reservationId || ""
            await onDelete(targetId)
        } catch (error) {
            console.error("Delete failed", error)
            alert("삭제에 실패했습니다.")
        } finally {
            setIsDeleting(false)
        }
    }

    // V7.19: DR_RECOVERED "계속 예약" → 결제 페이지로 이동 (API 직접 호출 X)
    const handleContinueReservation = () => {
        // 클라이언트 만료 체크
        if (reservation.expiresAt) {
            const expiresAt = new Date(reservation.expiresAt)
            if (expiresAt < new Date()) {
                setShowExpiredDialog(true)
                return
            }
        }

        // 결제 페이지로 이동
        const holdingId = (reservation as any).holdingId || reservation.id || reservation.reservationId || ""
        const expiresAt = reservation.expiresAt || ""
        const remainingSeconds = expiresAt
            ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
            : 60

        const params = new URLSearchParams({
            holdingId,
            expiresAt,
            remainingSeconds: remainingSeconds.toString(),
            region
        })
        router.push(`/reservation/confirm?${params.toString()}`)
    }


    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-col md:flex-row">
                {/* Poster Section (Left) */}
                <div className="relative w-full md:w-48 h-64 md:h-auto flex-shrink-0 bg-gray-100">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        {/* Fallback if no image */}
                        <Ticket className="w-12 h-12 opacity-20" />
                    </div>
                    {/* Use a placeholder valid image or the real one if available. 
                         For this mock, we might not have real images, so I'll use a colored div overlay if needed 
                         or just rely on alt text if image fails. 
                         Actually, let's use a nice gradient placeholder if URL is just a string */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
                    {reservation.posterUrl && (
                        <Image
                            src={reservation.posterUrl}
                            alt={reservation.performanceTitle}
                            fill
                            className="object-cover"
                        />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 md:hidden">
                        <h3 className="text-white font-bold text-lg">{reservation.performanceTitle}</h3>
                    </div>
                </div>

                {/* Details Section (Right) */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="hidden md:block text-2xl font-bold text-gray-900 mb-2">
                                {reservation.performanceTitle}
                            </h3>
                            {/* V7.16: DR 상태별 Badge */}
                            {isDrRecovered ? (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 animate-pulse">
                                    ⚠️ 복구됨 - 결제 필요
                                </Badge>
                            ) : isDrReserved ? (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                                    ✅ 예약 확정 (DR)
                                </Badge>
                            ) : (
                                <Badge
                                    variant={isCancelled ? "destructive" : "default"}
                                    className={isCancelled ? "bg-red-100 text-red-600 hover:bg-red-100 border-red-200" : "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"}
                                >
                                    {isCancelled ? "예약 취소" : "예약 확정"}
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-primary/70" />
                                <span className="font-medium text-gray-900">{reservation.date} ({getDayOfWeek(reservation.date)})</span>
                                <span className="text-gray-300">|</span>
                                <Clock className="w-4 h-4 text-primary/70" />
                                <span className="text-gray-900">{reservation.time}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary/70" />
                                <span>{reservation.venue}</span>
                            </div>

                            <div className="flex items-start gap-2">
                                <Ticket className="w-4 h-4 text-primary/70 mt-0.5" />
                                <div className="flex flex-wrap gap-2">


                                    {reservation.seats.map((seat, idx) => {
                                        // V7.15 SSOT: 공통 유틸리티로 좌석 라벨 생성
                                        let seatLabel = "";

                                        if (seat.seatId) {
                                            const { floor, sectionId, rowId, localNumber } = parseSeatId(seat.seatId);

                                            // sections 데이터가 있으면 연속 번호 계산
                                            let displayNumber = localNumber;
                                            if (reservation.sections && reservation.sections.length > 0) {
                                                const floorSections = reservation.sections.filter(s => s.floor === floor);
                                                displayNumber = calculateGlobalSeatNumber(
                                                    sectionId,
                                                    rowId,
                                                    localNumber,
                                                    floorSections,
                                                    floor
                                                );
                                            }

                                            seatLabel = `${floor} ${sectionId}구역 ${rowId}열 ${displayNumber}번`;
                                        }

                                        // Fallback if parsing failed
                                        if (!seatLabel) {
                                            seatLabel = seat.seatNumber
                                                ? `${seat.seatNumber}번`
                                                : (seat.seatId || "좌석 정보 없음");
                                        }

                                        return (
                                            <Badge key={idx} variant="outline" className="bg-gray-50 font-normal">
                                                {seat.grade}석 {seatLabel}
                                            </Badge>
                                        );
                                    })}
                                    <span className="text-gray-500 text-xs self-center ml-1">
                                        (총 {reservation.seats.length}매)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                        <div>
                            <span className="text-sm text-gray-500 block mb-1">총 결제 금액</span>
                            <div className="flex items-center gap-2 text-primary font-bold text-xl">
                                <CreditCard className="w-5 h-5" />
                                {reservation.totalPrice.toLocaleString()}원
                            </div>
                            {/* V7.16: DR_RECOVERED 만료 시간 표시 */}
                            {isDrRecovered && reservation.expiresAt && (
                                <div className="mt-2 text-sm text-amber-600 font-medium">
                                    ⏰ {formatExpiresAt(reservation.expiresAt)}까지 결제 가능
                                </div>
                            )}
                        </div>

                        {/* V7.19: DR_RECOVERED 상태 - 계속 예약/예약 취소 버튼 */}
                        {/* "계속 예약" 클릭 → 결제 페이지로 이동 */}
                        {isDrRecovered && (
                            <>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white px-4"
                                        size="sm"
                                        onClick={handleContinueReservation}
                                    >
                                        계속 예약
                                    </Button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="flex-1 sm:flex-none text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50 px-4"
                                                size="sm"
                                                disabled={isCancelling}
                                            >
                                                {isCancelling ? "취소 중..." : "예약 취소"}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>예약을 취소하시겠습니까?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    정말로 예약을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>돌아가기</AlertDialogCancel>
                                                <AlertDialogAction onClick={executeCancel} className="bg-red-500 hover:bg-red-600">
                                                    취소확정
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>

                                {/* V7.19: 만료 시 AlertDialog */}
                                <AlertDialog open={showExpiredDialog} onOpenChange={setShowExpiredDialog}>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>예매 시간 초과</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                예매 가능한 시간이 초과되었습니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogAction onClick={() => {
                                                setShowExpiredDialog(false)
                                                onRemoveFromList?.(reservation.id)
                                            }}>
                                                확인
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}

                        {/* 정상 예약 (CONFIRMED, DR_RESERVED) */}
                        {!isCancelled && !isDrRecovered && (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Link href={detailsUrl} className="flex-1 sm:flex-none">
                                    <Button variant="outline" className="w-full text-gray-500" size="sm">
                                        상세보기
                                    </Button>
                                </Link>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="flex-1 sm:flex-none text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                                            size="sm"
                                            disabled={isCancelling}
                                        >
                                            {isCancelling ? "취소 중..." : "예약 취소"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>예약을 취소하시겠습니까?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                정말로 예약을 취소하시겠습니까?
                                                <br />
                                                환불 규정에 따라 수수료가 부과될 수 있습니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>돌아가기</AlertDialogCancel>
                                            <AlertDialogAction onClick={executeCancel} className="bg-red-500 hover:bg-red-600">
                                                취소확정
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}

                        {/* V7.14: 취소된 예약에 대한 삭제 버튼 */}
                        {isCancelled && onDelete && (
                            <div className="flex flex-col gap-2 w-full sm:w-auto items-end">
                                <div className="flex gap-2">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="flex-1 sm:flex-none text-gray-500 hover:text-gray-700 border-gray-300 hover:bg-gray-50"
                                                size="sm"
                                                disabled={isDeleting}
                                            >
                                                {isDeleting ? "삭제 중..." : "취소내역 삭제"}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>내역을 삭제하시겠습니까?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    취소 내역을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>돌아가기</AlertDialogCancel>
                                                <AlertDialogAction onClick={executeDelete} className="bg-red-500 hover:bg-red-600">
                                                    삭제확정
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                <p className="text-xs text-gray-400">※ 취소 내역은 7일 후 자동 삭제됩니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function getDayOfWeek(dateString: string) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateString);
    return days[date.getDay()];
}

// V7.16: DR_RECOVERED 만료 시간 포맷팅
function formatExpiresAt(expiresAtISO: string): string {
    try {
        const date = new Date(expiresAtISO);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch {
        return "알 수 없음";
    }
}
