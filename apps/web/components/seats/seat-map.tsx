"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { VenueData, Seat, SeatStatus, Section, Row, Grade, calculateGlobalSeatNumber, parseSeatId } from "@mega-ticket/shared-types"
import { TheaterTemplate } from "./templates/theater-template"
import { SeatLegend } from "./seat-legend"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

import { apiClient } from "@/lib/api-client"
import { parsePriceString } from "@/lib/utils"

// Mock import for now - in real app fetch from API
// import sampleTheater from "@/data/venues/charlotte-theater.json"

import { Performance } from "@mega-ticket/shared-types"

interface SeatMapProps {
    performanceId: string;
    date: string;
    time: string;
    isSubmitting: boolean;
    onSelectionComplete: (selectedSeats: Seat[], totalPrice: number) => void;
    onLoadComplete?: () => void;
    performance?: Performance | null;  // 부모에서 전달받은 공연 정보 (중복 API 호출 방지)
}

export function SeatMap({ performanceId, date, time, isSubmitting, onSelectionComplete, onLoadComplete, performance: propPerformance }: SeatMapProps) {
    const [venueData, setVenueData] = useState<VenueData | null>(null)
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
    const [selectedFloor, setSelectedFloor] = useState<string>("1층")
    const [loading, setLoading] = useState(true)

    const [showMaxAlert, setShowMaxAlert] = useState(false)

    // Request ID for race condition protection
    const lastRequestIdRef = useRef<number>(0);
    const onLoadCompleteRef = useRef(onLoadComplete);
    // API 중복 호출 방지
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        onLoadCompleteRef.current = onLoadComplete;
    }, [onLoadComplete]);

    const fetchVenueData = useCallback(async (silent = false, force = false) => {
        // 강제 호출이 아니고 이미 호출된 경우 스킵
        if (!force && hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        const requestId = ++lastRequestIdRef.current;
        if (!silent) setLoading(true)
        try {
            // 1. Get Performance - 부모에서 전달받은 경우 재사용, 없으면 API 호출
            const performance = propPerformance || await apiClient.getPerformance(performanceId);
            const venueId = performance.venueId || 'charlotte-theater';

            // 2. Fetch Base Venue Data from API
            const baseVenue = await apiClient.getVenue(venueId);

            // 3. Combine Data (V7.7 Guide: Prioritize Performance Sections/Grades)
            // Fix: Only overwrite sections if performance.sections has valid data (length > 0)
            // Denormalization might result in empty array if not fully synced, so we fallback to baseVenue.
            const perfSections = performance.sections && performance.sections.length > 0 ? performance.sections : undefined;
            const priceMap = parsePriceString(performance.price || "");
            const data: any = {
                ...baseVenue,
                sections: perfSections || baseVenue.sections || [],
                hasOPSeats: performance.hasOPSeats ?? true, // Default to true if undefined
                grades: (performance.seatGrades || []).map((sg: any) => ({
                    ...sg,
                    price: sg.price || priceMap[sg.grade] || 0,
                    color: (performance.seatColors && performance.seatColors[sg.grade]) || sg.color
                }))
            };

            interface RowData {
                rowId: string;
                grade: string;
                seats: Seat[];
                length?: number;
            }

            // Generate Seats if empty (in case API doesn't expand them)
            if (data.sections) {
                data.sections.forEach((section: Section) => {
                    if (section.rows) {
                        section.rows.forEach((row: unknown) => {
                            const rowData = row as RowData;
                            if ((!rowData.seats || rowData.seats.length === 0) && rowData.length) {
                                const length = rowData.length;
                                const floor = (section as any).floor || '1층';
                                rowData.seats = Array.from({ length }, (_, i) => ({
                                    seatId: `${floor}-${section.sectionId}-${rowData.rowId}-${i + 1}`,
                                    seatNumber: i + 1,
                                    rowId: rowData.rowId,
                                    status: 'available' as SeatStatus,
                                    grade: rowData.grade
                                }));
                            }
                        });
                    }
                });
            }

            // 4. Fetch Real-time Seat Status
            const statusResponse = await apiClient.getSeatStatus(performanceId, date, time);
            const statusMap = statusResponse.seats || {};

            // [V8.10 DEBUG] HOLDING 상태 좌석 확인
            const holdingSeats = Object.entries(statusMap)
                .filter(([_, status]) => (status as string).toUpperCase() === 'HOLDING');
            if (holdingSeats.length > 0) {
                console.log('[SeatMap] HOLDING seats from API:', holdingSeats.map(([id, status]) => ({ seatId: id, status })));
            }

            if (requestId !== lastRequestIdRef.current) return;

            // Apply Status Map to Seats
            let appliedHoldingCount = 0;

            // [V8.17 DEBUG] seatId 매칭 디버그
            const sampleStatusKeys = Object.keys(statusMap).filter(k => statusMap[k] === 'holding').slice(0, 3);
            console.log('[SeatMap] Sample HOLDING keys from API:', sampleStatusKeys);

            if (data.sections) {
                let sampleSeatIds: string[] = [];
                data.sections.forEach((section: Section) => {
                    if (section.rows) {
                        section.rows.forEach((row: unknown) => {
                            const rowData = row as RowData;
                            if (rowData.seats) {
                                rowData.seats.forEach(seat => {
                                    // 샘플 수집 (첫 3개만)
                                    if (sampleSeatIds.length < 3) {
                                        sampleSeatIds.push(seat.seatId);
                                    }

                                    if (statusMap[seat.seatId]) {
                                        const newStatus = statusMap[seat.seatId] as SeatStatus;
                                        seat.status = newStatus;

                                        // [V8.10 DEBUG] HOLDING 적용 로그
                                        if (newStatus.toUpperCase() === 'HOLDING') {
                                            appliedHoldingCount++;
                                            console.log('[SeatMap] Applied HOLDING to seat:', seat.seatId);
                                        }
                                    }
                                });
                            }
                        });
                    }
                });

                // [V8.17 DEBUG] seatId 형식 비교
                if (holdingSeats.length > 0 && appliedHoldingCount === 0) {
                    console.warn('[SeatMap] ⚠️ HOLDING seats NOT applied! Possible seatId mismatch:');
                    console.warn('[SeatMap] API statusMap keys (sample):', sampleStatusKeys);
                    console.warn('[SeatMap] Frontend seat.seatId (sample):', sampleSeatIds);
                }
            }

            if (appliedHoldingCount > 0) {
                console.log('[SeatMap] Total HOLDING seats applied:', appliedHoldingCount);
            }

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
    }, [performanceId, date, time, propPerformance])

    useEffect(() => {
        // performanceId가 없으면 스킵
        if (!performanceId) return;

        fetchVenueData(false);

        // V7.15: 3초 자동 Polling 비활성화 (DB 비용 절감)
        // 테스트 시 아래 주석 해제하여 사용 가능
        /*
        const interval = setInterval(() => {
            fetchVenueData(true, true);  // force=true for polling
        }, 3000);
        */

        // Custom Event Listener for instant refresh (선점/예약 후 즉시 갱신)
        const handleRefresh = () => {
            // Add small delay to ensure server write completes
            setTimeout(() => {
                fetchVenueData(true, true);  // force=true for manual refresh
            }, 50);
        };
        window.addEventListener('REFRESH_SEAT_MAP', handleRefresh);

        return () => {
            // clearInterval(interval);  // V7.15: Polling 비활성화로 주석 처리
            window.removeEventListener('REFRESH_SEAT_MAP', handleRefresh);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [performanceId, date, time])  // 함수 참조 대신 primitive 값만 의존성에 포함

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
                        // Find price from parsed grades in venueData
                        const gradeInfo = venueData.grades.find((g: any) => g.grade === seat.grade);
                        const seatWithPrice = {
                            ...seat,
                            price: gradeInfo ? Number(gradeInfo.price) : 0,
                            color: gradeInfo ? gradeInfo.color : '#CCCCCC'
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
                    onClick={() => fetchVenueData(false, true)}  // force=true for manual refresh
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
                        hasOPSeats={venueData.hasOPSeats}
                    />
                )}
            </div>

            {/* Legend & Summary */}
            <div className="mt-auto bg-white border-t rounded-t-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 relative">
                <SeatLegend grades={venueData.grades} hasOPSeats={venueData.hasOPSeats} />

                <div className="flex justify-center p-6 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                    <div className="flex items-center justify-between w-full max-w-4xl px-8 gap-4">
                        {/* V7.13: 선택 좌석 영역 - flex-1로 반응형, max-h와 overflow 추가 */}
                        <div className="flex flex-col items-start flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground mb-1.5 ml-1">선택한 좌석</p>
                            {/* V7.11: 4매 선택 시 한 줄에 표시되도록 가로 스크롤 */}
                            <div className="flex gap-2 min-h-[32px] p-1 overflow-x-auto max-w-full" style={{ scrollbarWidth: 'thin' }}>
                                {selectedSeatIds.length > 0 ? (
                                    selectedSeatIds.map(id => {
                                        // V7.15 SSOT: 공통 유틸리티로 seatId 파싱 및 연속 번호 계산
                                        const { floor, sectionId, rowId, localNumber } = parseSeatId(id);
                                        const floorSections = venueData?.sections.filter((s: any) => s.floor === floor) || [];
                                        const displayNum = calculateGlobalSeatNumber(
                                            sectionId,
                                            rowId,
                                            localNumber,
                                            floorSections as any,
                                            floor
                                        );

                                        // 좌석 정보 및 등급 색상 찾기
                                        const seatData = getSelectedSeatsData().find(s => s.seatId === id);
                                        const gradeInfo = venueData?.grades.find((g: any) => g.grade === seatData?.grade);
                                        const gradeColor = gradeInfo?.color || '#FF6B35';
                                        const gradeLabel = seatData?.grade || '';

                                        // V7.15 SSOT: 통일된 좌석 라벨 형식
                                        const displayLabel = `${floor} ${sectionId}구역 ${rowId}열 ${displayNum}번 (${gradeLabel}석)`;

                                        return (
                                            <span
                                                key={id}
                                                className="text-sm font-bold px-2.5 py-1 rounded-md animate-in fade-in zoom-in duration-200 whitespace-nowrap"
                                                style={{
                                                    borderWidth: '2px',
                                                    borderStyle: 'solid',
                                                    borderColor: gradeColor,
                                                    backgroundColor: `${gradeColor}15`,
                                                    color: gradeColor
                                                }}
                                            >
                                                {displayLabel}
                                            </span>
                                        );
                                    })
                                ) : (
                                    <span className="text-sm font-medium text-gray-400 mt-1 ml-1">좌석을 선택해주세요</span>
                                )}
                            </div>
                        </div>

                        {/* V7.13: 결제금액/버튼 영역 - flex-shrink-0으로 고정 */}
                        <div className="flex items-center gap-8 flex-shrink-0">

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
