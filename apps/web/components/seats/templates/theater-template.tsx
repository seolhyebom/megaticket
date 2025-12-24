"use client"

import { VenueData } from "@mega-ticket/shared-types"
import { SeatButton } from "../seat-button"
import { cn } from "@/lib/utils"
import { useRef, useEffect } from "react"

interface TheaterTemplateProps {
    venueData: VenueData;
    selectedSeats: string[];
    selectedFloor: string;
    onSeatClick: (seatId: string) => void;
}

export function TheaterTemplate({ venueData, selectedSeats, selectedFloor, onSeatClick }: TheaterTemplateProps) {
    const filteredSections = venueData.sections.filter(s => s.floor === selectedFloor);

    // Sort sections A -> B -> C for display order
    const sortedSections = [...filteredSections].sort((a, b) => a.sectionId.localeCompare(b.sectionId));

    // 스크롤 컨테이너 ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 페이지 로드 시 스크롤을 중앙으로 이동
    useEffect(() => {
        // 렌더링 완료 후 스크롤 중앙 이동
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
            {/* Stage/Section Layout Container - 좌우 스크롤 가능하도록 충분한 여백 */}
            <div ref={scrollContainerRef} className="w-full h-full overflow-x-auto custom-scrollbar pb-10">
                <div
                    className={cn(
                        "relative flex justify-center items-start gap-2 transition-all duration-300",
                        "w-[1800px] px-40 mx-auto",
                        selectedFloor === "1층" ? "pt-2" : "pt-0"
                    )}
                >
                    {sortedSections.map((section) => {
                        // Determine rotation based on section ID
                        let transformStyle = {};
                        let marginStyle = "";

                        const isLeft = ['A', 'D'].includes(section.sectionId);
                        const isRight = ['C', 'F'].includes(section.sectionId);

                        if (isLeft) {
                            transformStyle = { transform: 'rotate(10deg)' };
                            marginStyle = "mt-4 mr-1";
                        } else if (isRight) {
                            transformStyle = { transform: 'rotate(-10deg)' };
                            marginStyle = "mt-4 ml-1";
                        } else {
                            // Section B & E
                            transformStyle = { transform: 'none' };
                            marginStyle = "z-10 mt-12";
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
                                    {section.rows.map((row) => {
                                        const gradeInfo = venueData.grades.find(g => g.grade === row.grade);
                                        if (!gradeInfo) return null;

                                        return (
                                            <div key={row.rowId} className="flex items-center gap-1 group">
                                                {/* Row Label (Left) */}
                                                <span className="text-[10px] text-gray-400 w-4 text-right font-medium">
                                                    {row.rowId}
                                                </span>

                                                <div className="flex gap-0.5 justify-center">
                                                    {row.seats.map((seat) => (
                                                        <div key={seat.seatId} className="scale-75 origin-center -m-[3px]">
                                                            <SeatButton
                                                                seat={seat}
                                                                grade={gradeInfo}
                                                                isSelected={selectedSeats.includes(seat.seatId)}
                                                                onClick={onSeatClick}
                                                            />
                                                        </div>
                                                    ))}
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

            {/* Entrances - M자 형태 출입구 */}
            <div className={cn(
                "w-full flex justify-around items-center min-w-[1000px] h-auto py-0 mt-1 mb-1",
            )}>
                {selectedFloor === '1층' ? (
                    <>
                        <div className="flex flex-col items-center">
                            {/* 열린 문 아이콘 */}
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
