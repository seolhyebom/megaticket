"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { Reservation, ReservationCard } from "@/components/reservation-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Ticket, Loader2 } from "lucide-react"

export default function MyPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()  // V7.18: URL 쿼리에서 region 우선 사용
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [fetching, setFetching] = useState(true)

    // V7.18: URL 쿼리 > 환경변수 > 기본값 순으로 리전 결정
    const region = searchParams.get('region') || process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2'

    useEffect(() => {
        // Redirect if not logged in
        if (!isLoading && !user) {
            router.push("/login")
        }
    }, [isLoading, user, router])

    useEffect(() => {
        const fetchReservations = async () => {
            if (!user) return

            try {
                console.log('[MyPage] Fetching reservations with region:', region);
                const res = await fetch(`/api/reservations?userId=${user.id}&region=${region}`)
                if (res.ok) {
                    const data = await res.json()
                    setReservations(data)
                }
            } catch (error) {
                console.error("Failed to fetch reservations", error)
            } finally {
                setFetching(false)
            }
        }

        if (user) {
            fetchReservations()
        }
    }, [user, region])


    const handleCancelReservation = async (reservationId: string) => {
        try {
            const res = await fetch(`/api/reservations?reservationId=${reservationId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                // Refresh list - V7.18: 상위 스코프 region 사용
                const res = await fetch(`/api/reservations?userId=${user!.id}&region=${region}`)
                if (res.ok) {
                    const data = await res.json()
                    setReservations(data)
                }
            } else {
                alert("예약 취소 처리에 실패했습니다.")
            }
        } catch (e) {
            console.error("Cancel error", e)
            alert("오류가 발생했습니다.")
        }
    }

    // V7.14: 취소내역 완전 삭제
    const handleDeleteReservation = async (reservationId: string) => {
        try {
            const res = await fetch(`/api/reservations?reservationId=${reservationId}&method=PURGE`, {
                method: "DELETE"
            })
            if (res.ok) {
                // Refresh list - V7.18: 상위 스코프 region 사용
                const res = await fetch(`/api/reservations?userId=${user!.id}&region=${region}`)
                if (res.ok) {
                    const data = await res.json()
                    setReservations(data)
                }
            } else {
                alert("삭제 처리에 실패했습니다.")
            }
        } catch (e) {
            console.error("Delete error", e)
            alert("오류가 발생했습니다.")
        }
    }

    // V7.19: 만료된 예약을 목록에서 제거 (로컬 상태에서만)
    const handleRemoveFromList = (reservationId: string) => {
        setReservations(prev => prev.filter(r => r.id !== reservationId))
    }

    if (isLoading || (user && fetching)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-gray-500">예약 정보를 불러오는 중입니다...</p>
            </div>
        )
    }

    if (!user) {
        return null // Will redirect
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl min-h-[80vh]">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">내 예약</h1>
                <p className="text-gray-500">
                    <span className="font-semibold text-primary">{user.name}</span>님의 예매 내역입니다.
                </p>
            </div>

            {reservations.length > 0 ? (
                <div className="grid gap-6">
                    {reservations.map((reservation) => (
                        <ReservationCard
                            key={reservation.id || reservation.reservationId}
                            reservation={reservation}
                            onCancel={handleCancelReservation}
                            onDelete={handleDeleteReservation}
                            onRemoveFromList={handleRemoveFromList}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Ticket className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        예약 내역이 없습니다
                    </h3>
                    <p className="text-gray-500 text-center max-w-sm mb-8">
                        아직 예약한 공연이 없어요.<br />
                        지금 바로 인기 있는 공연을 확인해보세요!
                    </p>
                    <Link href="/">
                        <Button size="lg" className="font-semibold">
                            공연 둘러보기
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    )
}
