"use client"

import { useEffect, useState } from "react"
import { Reservation } from "@/lib/server/holding-manager" // We might need to move types to separate file if 'server' imports cause issues in client components (see below note)
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ticket, Calendar, Clock, MapPin, Loader2 } from "lucide-react"
import Link from "next/link"

// Define client-side type if import from server fails or is bad practice
interface ClientReservation {
    id: string;
    performanceTitle: string;
    venue: string;
    date: string;
    time: string;
    seats: {
        seatId: string;
        row: string;
        number: number;
        grade: string;
        price: number;
    }[];
    totalPrice: number;
    status: 'confirmed' | 'cancelled';
    createdAt: string;
}

export default function MyReservationsPage() {
    const [reservations, setReservations] = useState<ClientReservation[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchReservations = async () => {
            try {
                // Mock User ID
                const res = await fetch("/api/reservations?userId=guest-user-1")
                if (res.ok) {
                    const data = await res.json()
                    setReservations(data.reservations)
                }
            } catch (error) {
                console.error("Failed to fetch reservations", error)
            } finally {
                setLoading(false)
            }
        }

        fetchReservations()
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl min-h-[70vh]">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight">내 예약 내역</h1>
                <Link href="/">
                    <Button variant="outline">홈으로</Button>
                </Link>
            </div>

            {reservations.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900">예약된 공연이 없습니다</h3>
                    <p className="text-gray-500 mt-2 mb-6">원하는 공연을 찾아보세요!</p>
                    <Link href="/">
                        <Button>공연 보러가기</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-6">
                    {reservations.map((res) => (
                        <Card key={res.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardHeader className="bg-gray-50/50 border-b py-4">
                                <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                                    <div>
                                        <CardTitle className="text-lg md:text-xl text-primary">{res.performanceTitle}</CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <span>예약번호: {res.id.split('-')[0]}...</span>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-gray-500">{new Date(res.createdAt).toLocaleDateString()} 예매</span>
                                        </CardDescription>
                                    </div>
                                    <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase">
                                        {res.status.toUpperCase()}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-gray-700">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span className="font-semibold w-12">날짜</span>
                                            <span>{res.date}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-700">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span className="font-semibold w-12">시간</span>
                                            <span>{res.time}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-700">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span className="font-semibold w-12">장소</span>
                                            <span>{res.venue}</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-primary" /> 예매 좌석
                                        </h4>
                                        <div className="space-y-1">
                                            {res.seats.map(seat => (
                                                <div key={seat.seatId} className="flex justify-between text-sm">
                                                    <span className="text-gray-600">{seat.grade}석 {seat.row}열 {seat.number}번</span>
                                                    <span className="font-medium text-gray-900">{seat.price.toLocaleString()}원</span>
                                                </div>
                                            ))}
                                            <div className="border-t border-dashed border-gray-300 my-2 pt-2 flex justify-between font-bold">
                                                <span>총 결제금액</span>
                                                <span className="text-primary">{res.totalPrice.toLocaleString()}원</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
