"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { VenueData, Seat, SeatStatus, Section, Row, Grade } from "@mega-ticket/shared-types"
import { TheaterTemplate } from "./templates/theater-template"
import { SeatLegend } from "./seat-legend"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

import { apiClient } from "@/lib/api-client"

// Mock import for now - in real app fetch from API
// import sampleTheater from "@/data/venues/charlotte-theater.json"

interface SeatMapProps {
    performanceId: string;
    date: string;
    time: string;
    isSubmitting: boolean;
    onSelectionComplete: (selectedSeats: Seat[], totalPrice: number) => void;
    onLoadComplete?: () => void;
}

export function SeatMap({ performanceId, date, time, isSubmitting, onSelectionComplete, onLoadComplete }: SeatMapProps) {
    const [venueData, setVenueData] = useState<VenueData | null>(null)
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
    const [selectedFloor, setSelectedFloor] = useState<string>("1층")
    const [loading, setLoading] = useState(true)

    const [showMaxAlert, setShowMaxAlert] = useState(false)

    // Request ID for race condition protection
    const lastRequestIdRef = useRef<number>(0);
    const onLoadCompleteRef = useRef(onLoadComplete);

    useEffect(() => {
        onLoadCompleteRef.current = onLoadComplete;
    }, [onLoadComplete]);

    const fetchVenueData = useCallback(async (silent = false) => {
        const requestId = ++lastRequestIdRef.current;
        if (!silent) setLoading(true)
        try {
            // 1. Get Performance to find venueId
            const performance = await apiClient.getPerformance(performanceId);
            const venueId = performance.venueId || 'charlotte-theater';

            // 2. Fetch Base Venue Data from API
            const data = await apiClient.getVenue(venueId);

            interface RowData {
                rowId: string;
                grade: string;
                seats: Seat[];
                length?: number;
            }

            // Generate Seats if empty (in case API doesn't expand them)
            data.sections.forEach((section: Section) => {
                section.rows.forEach((row: unknown) => {
                    const rowData = row as RowData;
                    if ((!rowData.seats || rowData.seats.length === 0) && rowData.length) {
                        const length = rowData.length;
                        rowData.seats = Array.from({ length }, (_, i) => ({
                            seatId: `${section.sectionId}-${rowData.rowId}-${i + 1}`,
                            seatNumber: i + 1,
                            rowId: rowData.rowId,
                            status: 'available' as SeatStatus,
                            grade: rowData.grade
                        }));
                    }
                });
            });

            // 3. Fetch Real-time Seat Status
            const statusResponse = await apiClient.getSeatStatus(performanceId, date, time);
            const statusMap = statusResponse.seats;

            if (requestId !== lastRequestIdRef.current) return;

            // Apply Status Map to Seats
            data.sections.forEach((section: Section) => {
                section.rows.forEach((row: unknown) => {
                    const rowData = row as RowData;
                    if (rowData.seats) {
                        rowData.seats.forEach(seat => {
                            if (statusMap[seat.seatId]) {
                                seat.status = statusMap[seat.seatId];
                            }
                        });
                    }
                });
            });

            setVenueData(data)
        } catch (error) {
            console.error("Failed to fetch venue data:", error)
        } finally {
            if (requestId === lastRequestIdRef.current) {
                setLoading(false)
                if (!silent) {
                    onLoadCompleteRef.current?.()
                }
            }
        }
    }, [performanceId, date, time])

    useEffect(() => {
        fetchVenueData(false);

        // Polling every 3 seconds
        const interval = setInterval(() => {
            fetchVenueData(true);
        }, 3000);

        // Custom Event Listener for instant refresh
        const handleRefresh = () => {
            // Add small delay to ensure server write completes
            setTimeout(() => {
                fetchVenueData(true);
            }, 50);
        };
        window.addEventListener('REFRESH_SEAT_MAP', handleRefresh);

        return () => {
            clearInterval(interval);
            window.removeEventListener('REFRESH_SEAT_MAP', handleRefresh);
        }
    }, [fetchVenueData])

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
        venueData.sections.forEach((section: Section) => {
            section.rows.forEach((row: Row) => {
                row.seats.forEach((seat: Seat) => {
                    if (selectedSeatIds.includes(seat.seatId)) {
                        // Find price from grades
                        const gradeInfo = venueData.grades.find(g => g.grade === seat.grade);
                        const seatWithPrice = {
                            ...seat,
                            price: gradeInfo ? Number(gradeInfo.price) : 0
                        };
                        seats.push(seatWithPrice as any);
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
            const grade = venueData.grades.find((g: Grade) => g.grade === seat.grade);
            return total + (grade ? grade.price : 0);
        }, 0);
    }

    const handleComplete = () => {
        const seats = getSelectedSeatsData();
        const total = calculateTotal();
        onSelectionComplete(seats, total);
    }

    if (!venueData && loading) return null;
    if (!venueData) return <div className="p-10 text-center text-red-500">데이터 로드 실패</div>

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            {/* Max Seat Alert Overlay */}
            {showMaxAlert && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] animate-in fade-in zoom-in duration-300">
                    <div className="bg-black/80 text-white px-8 py-4 rounded-full shadow-2xl backdrop-blur-sm flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold text-lg">최대 4석까지만 예매할 수 있습니다.</span>
                    </div>
                </div>
            )}

            {/* Stage Area */}
            <div className="w-full bg-black text-white h-14 relative flex items-center justify-center shadow-md z-1">
                {/* Floor Tabs (Left) */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex gap-1">
                    {["1층", "2층"].map(floor => (
                        <button
                            key={floor}
                            onClick={() => setSelectedFloor(floor)}
                            className={cn(
                                "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                selectedFloor === floor
                                    ? "bg-white text-black"
                                    : "text-gray-400 hover:text-white"
                            )}
                        >
                            {floor}
                        </button>
                    ))}
                </div>

                <span className="font-bold tracking-widest text-lg">STAGE</span>

                <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-8 text-xs font-medium bg-white/90 hover:bg-white text-gray-800 gap-1.5 transition-all active:scale-95"
                    onClick={() => fetchVenueData(false)}
                    disabled={loading || isSubmitting}
                >
                    <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </Button>
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
            <div className="flex-1 overflow-auto min-h-0 flex flex-col items-center custom-scrollbar pt-0 w-full relative">
                {venueData.venueType === 'theater' && (
                    <TheaterTemplate
                        key={venueData.venueId}
                        venueData={venueData}
                        selectedSeats={selectedSeatIds}
                        selectedFloor={selectedFloor}
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
                                className="px-10 h-14 text-xl font-bold shadow-lg transition-all hover:scale-105 hover:shadow-xl relative"
                                disabled={selectedSeatIds.length === 0 || isSubmitting}
                                onClick={handleComplete}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="opacity-0">예매하기</span>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span className="ml-2 text-base font-medium">처리 중...</span>
                                        </div>
                                    </>
                                ) : (
                                    "예매하기"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
