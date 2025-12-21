"use client"

import { SeatMap } from "@/components/seats/seat-map"
import { useSearchParams, useRouter, useParams } from "next/navigation"
import { reservationStore } from "@/lib/reservation-store"
import { Seat } from "@/types/venue"

export default function SeatsPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()

    const performanceId = params.id as string
    const date = searchParams.get("date") || "2024-12-25" // Default mockup date
    const time = searchParams.get("time") || "19:00"

    const handleSelectionComplete = (selectedSeats: Seat[], totalPrice: number) => {
        // Save to session
        reservationStore.saveSession({
            performanceId,
            performanceTitle: "오페라의 유령 (The Phantom of the Opera)", // Mock for now, ideally fetch
            date,
            time,
            seats: selectedSeats,
            totalPrice
        })

        // Navigate to confirm
        router.push("/reservation/confirm")
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col">
            <SeatMap
                venueId="sample-theater" // hardcoded for now
                performanceId={performanceId}
                date={date}
                onSelectionComplete={handleSelectionComplete}
            />
        </div>
    )
}
