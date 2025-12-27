"use client"

import { VenueData, Section } from "@mega-ticket/shared-types"
import { SeatButton } from "../seat-button"
import { cn } from "@/lib/utils"
import { useRef, useEffect } from "react"

interface TheaterTemplateProps {
    venueData: VenueData;
    selectedSeats: string[];
    selectedFloor: string;
    onSeatClick: (seatId: string) => void;
    hasOPSeats?: boolean;
}

export function TheaterTemplate({ venueData, selectedSeats, selectedFloor, onSeatClick, hasOPSeats = true }: TheaterTemplateProps) {
    const filteredSections = venueData.sections.filter((s: Section) => s.floor === selectedFloor);

    // Sort sections A -> B -> C for display order
    const sortedSections = [...filteredSections].sort((a, b) => a.sectionId.localeCompare(b.sectionId));

    // V7.13: 연속 좌석 번호 계산 함수 (같은 열에서 A -> B -> C 순서로 연속)
    const calculateGlobalSeatNumber = (
        sectionId: string,
        rowId: string,
        localSeatNumber: number
    ): number => {
        // OP열은 독립적으로 1~12번
        if (rowId === 'OP') {
            return localSeatNumber;
        }

        // 나머지 열은 A -> B -> C 순서로 연속
        const sectionOrder = ['A', 'B', 'C', 'D', 'E', 'F'];
        const currentSectionIndex = sectionOrder.indexOf(sectionId);

        let offset = 0;
        for (let i = 0; i < currentSectionIndex; i++) {
            const section = filteredSections.find(s => s.sectionId === sectionOrder[i]);
            if (section) {
                const row = section.rows.find((r: any) => r.rowId === rowId);
                if (row && row.seats) {
                    offset += row.seats.length;
                }
            }
        }
        return offset + localSeatNumber;
    };

    // 스크롤 컨테이너 ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 페이지 로드 시 스크롤을 중앙으로 이동
    useEffect(() => {
        const timer = setTimeout(() => {
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const scrollWidth = container.scrollWidth;
                const clientWidth = container.clientWidth;
                const scrollLeft = (scrollWidth - clientWidth) / 2;
                container.scrollTo({ left: scrollLeft, behavior: 'instant' });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedFloor]);

    return (
        <div className="flex flex-col items-center gap-2 w-full max-w-full overflow-hidden">
            {/* Stage/Section Layout Container */}
            <div ref={scrollContainerRef} className="w-full h-full overflow-x-auto custom-scrollbar pb-10">
                <div
                    className={cn(
                        "relative flex justify-center items-start transition-all duration-300",
                        selectedFloor === '1층' ? "gap-0" : "gap-6", // V7.13: 1층은 완전히 붙임(gap-0), 2층은 gap-6
                        "min-w-[1200px] w-[1800px] px-40 mx-auto"
                    )}
                >
                    {sortedSections.map((section) => {
                        let transformStyle = {};
                        let marginStyle = "";

                        const isLeft = ['A', 'D'].includes(section.sectionId);
                        const isRight = ['C', 'F'].includes(section.sectionId);
                        const isCenter = ['B', 'E'].includes(section.sectionId);

                        if (isLeft) {
                            transformStyle = { transform: 'rotate(10deg)' };
                            // V7.13: 2층은 1층과 동일하게 가깝게 배치 (mt-12 -> mt-4)
                            // 1층은 더 좁히기 위해 -mr-[1px] 적용
                            marginStyle = selectedFloor === '2층' ? "mt-4 mr-2" : "mt-4 -mr-[1px]";
                        } else if (isRight) {
                            transformStyle = { transform: 'rotate(-10deg)' };
                            // 1층은 더 좁히기 위해 -ml-[1px] 적용
                            marginStyle = selectedFloor === '2층' ? "mt-4 ml-2" : "mt-4 -ml-[1px]";
                        } else if (isCenter) {
                            // V7.11: 2층 E구역 위치 버그 수정
                            // 1층 B구역은 OP열이 있어 z-10 필요, 2층 E구역은 D/F와 동일 정렬
                            transformStyle = { transform: 'none' };
                            if (selectedFloor === '1층') {
                                marginStyle = "z-10 mt-[22px]"; // V7.14: 추가 3px 아래로 이동 (19px → 22px)
                            } else {
                                marginStyle = "mt-16"; // V7.13: 2층 E구역 정렬 유지하며 위로 이동 (mt-24 -> mt-16)
                            }
                        }

                        return (
                            <div
                                key={section.sectionId}
                                className={cn("flex flex-col items-center transition-transform duration-500 ease-out", marginStyle)}
                                style={transformStyle}
                            >
                                {/* Section Label */}
                                <div className="mb-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shadow-inner text-sm">
                                    {section.sectionId}
                                </div>

                                <div className="flex flex-col items-center gap-0.5">
                                    {section.rows.map((row: any) => {
                                        let gradeInfo = venueData.grades.find((g: any) => g.grade === row.grade);

                                        // V7.11 Fix: If OP row exists physically but grade is missing
                                        if (!gradeInfo && (row.grade === 'OP' || row.rowId === 'OP')) {
                                            gradeInfo = {
                                                grade: 'OP',
                                                price: 0,
                                                color: '#CCCCCC',
                                                description: 'Unavailable'
                                            };
                                        }

                                        if (!gradeInfo) return null;

                                        // V7.10 OP Seat Logic
                                        const isOPRow = row.grade === 'OP' || row.rowId === 'OP';
                                        const isOPDisabled = isOPRow && !hasOPSeats;

                                        return (
                                            <div key={row.rowId} className="flex items-center gap-1 group">
                                                {/* Row Label (Left) */}
                                                <span className="text-[10px] text-gray-400 w-4 text-right font-medium">
                                                    {row.rowId}
                                                </span>

                                                <div className="flex gap-0.5 justify-center">
                                                    {row.seats.map((seat: any, seatIndex: number) => {
                                                        // V7.13: 연속 좌석 번호 계산
                                                        const displayNum = calculateGlobalSeatNumber(
                                                            section.sectionId,
                                                            row.rowId,
                                                            seatIndex + 1
                                                        );

                                                        return (
                                                            <div key={seat.seatId} className="scale-75 origin-center -m-[3px]">
                                                                <SeatButton
                                                                    seat={seat}
                                                                    grade={gradeInfo}
                                                                    floor={selectedFloor}
                                                                    isSelected={selectedSeats.includes(seat.seatId)}
                                                                    onClick={onSeatClick}
                                                                    isOPDisabled={isOPDisabled}
                                                                    displayNumber={displayNum}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Row Label (Right) */}
                                                <span className="text-[10px] text-gray-400 w-4 text-left font-medium">
                                                    {row.rowId}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Entrances */}
            <div className={cn(
                "w-full flex justify-around items-center min-w-[1000px] h-auto py-0 mt-1 mb-1",
            )}>
                {selectedFloor === '1층' ? (
                    <>
                        <div className="flex flex-col items-center">
                            <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                                <rect x="2" y="1" width="12" height="16" rx="1" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
                                <path d="M14 4 L18 9 L14 14" stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-xs text-gray-400 mt-0.5">출입구</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                                <rect x="2" y="1" width="12" height="16" rx="1" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
                                <path d="M14 4 L18 9 L14 14" stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-xs text-gray-400 mt-0.5">출입구</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col items-center">
                            <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                                <rect x="2" y="1" width="12" height="16" rx="1" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
                                <path d="M14 4 L18 9 L14 14" stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-xs text-gray-400 mt-0.5">출입구</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                                <rect x="2" y="1" width="12" height="16" rx="1" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
                                <path d="M14 4 L18 9 L14 14" stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-xs text-gray-400 mt-0.5">출입구</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
