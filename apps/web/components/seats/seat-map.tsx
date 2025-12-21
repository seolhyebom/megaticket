"use client"

import { useEffect, useState } from "react"
import { VenueData, Seat, Grade } from "@/types/venue"
import { TheaterTemplate } from "./templates/theater-template"
import { SeatLegend } from "./seat-legend"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"

// Mock import for now - in real app fetch from API
import sampleTheater from "@/data/venues/sample-theater.json"

interface SeatMapProps {
    venueId: string; // Not used yet since we import sample directly
    performanceId: string;
    date: string;
    onSelectionComplete: (selectedSeats: Seat[], totalPrice: number) => void;
}

export function SeatMap({ venueId, performanceId, date, onSelectionComplete }: SeatMapProps) {
    const router = useRouter()
    const [venueData, setVenueData] = useState<VenueData | null>(null)
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    const [showMaxAlert, setShowMaxAlert] = useState(false)

    useEffect(() => {
        // Simulate API Fetch
        setTimeout(() => {
            setVenueData(sampleTheater as unknown as VenueData)
            setLoading(false)
        }, 500)
    }, [])

    useEffect(() => {
        if (showMaxAlert) {
            const timer = setTimeout(() => setShowMaxAlert(false), 2000)
            return () => clearTimeout(timer)
        }
    }, [showMaxAlert])

    const handleSeatClick = (seatId: string) => {
        if (selectedSeatIds.includes(seatId)) {
            setSelectedSeatIds((prev) => prev.filter((id) => id !== seatId))
        } else {
            if (selectedSeatIds.length >= 4) {
                setShowMaxAlert(true)
                return
            }
            setSelectedSeatIds((prev) => [...prev, seatId])
        }
    }

    // Helper to find seat object
    const getSelectedSeatsData = () => {
        if (!venueData) return [];
        const seats: Seat[] = [];
        venueData.sections.forEach(section => {
            section.rows.forEach(row => {
                row.seats.forEach(seat => {
                    if (selectedSeatIds.includes(seat.seatId)) {
                        seats.push(seat);
                    }
                })
            })
        })
        return seats;
    }

    // Calculate Total Price
    const calculateTotal = () => {
        if (!venueData) return 0;
        const seats = getSelectedSeatsData();
        return seats.reduce((total, seat) => {
            const grade = venueData.grades.find(g => g.grade === seat.grade);
            return total + (grade ? grade.price : 0);
        }, 0);
    }

    const handleComplete = () => {
        const seats = getSelectedSeatsData();
        const total = calculateTotal();
        onSelectionComplete(seats, total);
    }

    if (loading) return <div className="p-10 text-center">좌석 정보를 불러오는 중입니다...</div>
    if (!venueData) return <div className="p-10 text-center text-red-500">데이터 로드 실패</div>

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            {/* Max Seat Alert Overlay */}
            {showMaxAlert && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-black/80 text-white px-8 py-4 rounded-full shadow-2xl backdrop-blur-sm flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold text-lg">최대 4석까지만 예매할 수 있습니다.</span>
                    </div>
                </div>
            )}

            {/* Stage Area */}
            <div className="w-full bg-black text-white py-4 text-center font-bold tracking-widest shadow-md z-1">
                STAGE
            </div>

            {/* Map Area */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: hsl(var(--primary));
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: hsl(var(--primary) / 0.8);
                }
            `}</style>
            <div className="flex-1 overflow-auto p-10 flex justify-center items-start custom-scrollbar">
                {venueData.venueType === 'theater' && (
                    <TheaterTemplate
                        venueData={venueData}
                        selectedSeats={selectedSeatIds}
                        onSeatClick={handleSeatClick}
                    />
                )}
            </div>

            {/* Legend & Summary */}
            <div className="mt-auto bg-white border-t rounded-t-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 relative">
                <SeatLegend grades={venueData.grades} />

                <div className="flex justify-center p-6 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                    <div className="flex items-center justify-between w-full max-w-4xl px-8">
                        <div className="flex flex-col items-start min-w-[200px]">
                            <p className="text-sm text-muted-foreground mb-1.5 ml-1">선택한 좌석</p>
                            <div className="flex gap-2 min-h-[32px] p-1">
                                {selectedSeatIds.length > 0 ? (
                                    selectedSeatIds.map(id => (
                                        <span key={id} className="bg-primary/10 text-primary text-sm font-bold px-2.5 py-1 rounded-md animate-in fade-in zoom-in duration-200">
                                            {id}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-sm font-medium text-gray-400 mt-1 ml-1">좌석을 선택해주세요</span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-1">총 결제 금액</p>
                                <p className="font-bold text-2xl tracking-tight text-gray-900">
                                    {calculateTotal().toLocaleString()}
                                    <span className="text-sm font-normal text-gray-500 ml-1">원</span>
                                </p>
                            </div>

                            <Button
                                size="lg"
                                className="px-10 h-14 text-xl font-bold shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                                disabled={selectedSeatIds.length === 0}
                                onClick={handleComplete}
                            >
                                예매하기
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
