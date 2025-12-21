"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { reservationStore, ReservationSession } from "@/lib/reservation-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, MapPin, Ticket } from "lucide-react"

export default function ReservationConfirmPage() {
    const router = useRouter()
    const [session, setSession] = useState<ReservationSession | null>(null)

    useEffect(() => {
        const data = reservationStore.getSession()
        if (!data) {
            alert("예약 세션이 만료되었습니다. 다시 시도해주세요.")
            router.push("/")
            return
        }
        setSession(data)
    }, [router])

    if (!session) return <div className="p-20 text-center">로딩 중...</div>

    const handlePayment = () => {
        // Mock Payment Process
        setTimeout(() => {
            router.push("/reservation/complete")
        }, 1000)
    }

    return (
        <div className="container mx-auto max-w-2xl py-6 px-4 h-[calc(100vh-80px)] flex flex-col justify-center items-center">
            <Card className="shadow-lg w-full overflow-hidden border-none ring-1 ring-gray-200 p-0">
                <CardHeader className="bg-primary/10 border-b py-6 m-0">
                    <CardTitle className="text-lg text-primary text-center">{session.performanceTitle}</CardTitle>
                    <CardDescription className="text-center mt-1 text-xs">예약 내용을 꼼꼼히 확인해주세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-2 pb-2 px-6">

                    <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-700">날짜</span>
                            <span>{session.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-700">시간</span>
                            <span>{session.time}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-700">장소</span>
                            <span>Mega Arts Center - Grand Theater</span>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <Ticket className="w-4 h-4 text-primary" /> 선택 좌석 ({session.seats.length}매)
                        </h3>
                        <div className="bg-gray-50 p-3 rounded-xl space-y-1.5 border border-gray-100 max-h-[240px] overflow-y-auto custom-scrollbar">
                            {session.seats.map(seat => (
                                <div key={seat.seatId} className="flex justify-between items-center text-sm p-1 hover:bg-white rounded transition-colors">
                                    <span className="font-medium text-gray-600">{seat.grade}석 {seat.rowId}열 {seat.seatNumber}번</span>
                                    <span className="text-gray-900 font-bold tracking-tight">{seat.grade === "VIP" ? "150,000" : seat.grade === "R" ? "120,000" : seat.grade === "S" ? "90,000" : "60,000"}원</span>
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
                <CardFooter className="flex flex-col gap-2 py-6 px-6 bg-gray-50/30">
                    <Button className="w-full h-12 text-lg font-bold shadow-md hover:scale-[1.01] transition-transform" onClick={handlePayment}>
                        결제 및 예약 확정
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 text-xs text-muted-foreground hover:bg-transparent hover:text-gray-900">
                        뒤로가기
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
