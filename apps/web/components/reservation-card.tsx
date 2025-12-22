"use client"

import Image from "next/image"
import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, MapPin, Ticket, Clock, CreditCard } from "lucide-react"

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
    performanceTitle: string
    posterUrl?: string
    date: string
    time: string
    venue: string
    seats: ReservationSeat[]
    totalPrice: number
    status: "confirmed" | "cancelled"
    createdAt: string
}

interface ReservationCardProps {
    reservation: Reservation
    onCancel?: (reservationId: string) => Promise<void>
}

export function ReservationCard({ reservation, onCancel }: ReservationCardProps) {
    const isCancelled = reservation.status === "cancelled"
    const [isCancelling, setIsCancelling] = React.useState(false)

    const handleCancel = async () => {
        if (!onCancel) return
        if (confirm("정말로 예약을 취소하시겠습니까?")) {
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
                            <Badge
                                variant={isCancelled ? "destructive" : "default"}
                                className={isCancelled ? "bg-red-100 text-red-600 hover:bg-red-100 border-red-200" : "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"}
                            >
                                {isCancelled ? "예약 취소" : "예약 확정"}
                            </Badge>
                        </div>

                        <div className="space-y-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-primary/70" />
                                <span className="font-medium text-gray-900">{reservation.date} ({getDayOfWeek(reservation.date)})</span>
                                <span className="text-gray-300">|</span>
                                <Clock className="w-4 h-4 text-primary/70" />
                                <span>{reservation.time}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary/70" />
                                <span>{reservation.venue}</span>
                            </div>

                            <div className="flex items-start gap-2">
                                <Ticket className="w-4 h-4 text-primary/70 mt-0.5" />
                                <div className="flex flex-wrap gap-2">


                                    {reservation.seats.map((seat, idx) => {
                                        // Fallback logic for seat display
                                        // Priority: seatNumber (explicit) -> seatId -> row-number -> "좌석 정보 없음"
                                        const seatLabel = seat.seatNumber
                                            ? seat.seatNumber
                                            : (seat.seatId ? seat.seatId : (seat.row && seat.number ? `${seat.row}-${seat.number}` : ""));

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
                        </div>

                        {!isCancelled && (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button variant="outline" className="flex-1 sm:flex-none text-gray-500" size="sm">
                                    상세보기
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 sm:flex-none text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                                    size="sm"
                                    onClick={handleCancel}
                                    disabled={isCancelling}
                                >
                                    {isCancelling ? "취소 중..." : "예약 취소"}
                                </Button>
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
