"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { reservationStore } from "@/lib/reservation-store"

export default function ReservationCompletePage() {

    useEffect(() => {
        // Clear session after successful booking
        return () => {
            reservationStore.clearSession()
        }
    }, [])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
            <div className="p-6 bg-green-100 rounded-full animate-in zoom-in duration-300">
                <CheckCircle2 className="w-20 h-20 text-green-600" />
            </div>

            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">예약이 완료되었습니다!</h1>
                <p className="text-muted-foreground text-lg">
                    공연 당일 예매 내역을 지참하시고 방문해주세요.
                </p>
            </div>

            <div className="flex gap-4 mt-8">
                <Link href="/">
                    <Button variant="outline" size="lg">홈으로 이동</Button>
                </Link>
                <Link href="/my">
                    <Button size="lg">내 예약 보기</Button>
                </Link>
            </div>
        </div>
    )
}
