"use client"

import { Seat, Grade, SeatStatus } from "@mega-ticket/shared-types"
import { cn } from "@/lib/utils"

interface SeatButtonProps {
    seat: Seat;
    grade: Grade;
    floor: string;
    isSelected: boolean;
    onClick: (seatId: string) => void;
    isOPDisabled?: boolean;
    displayNumber?: number; // V7.13: 연속 좌석 번호
}

const statusStyles: Record<SeatStatus, string> = {
    available: 'bg-white border-2 hover:brightness-95 cursor-pointer',
    selected: 'border-2 text-white shadow-md animate-in zoom-in-95 duration-200',
    reserved: 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed',
    holding: 'bg-yellow-300 border-yellow-400 text-yellow-900 cursor-not-allowed',
    disabled: 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed',
    empty: 'invisible pointer-events-none border-none',
};

export function SeatButton({ seat, grade, floor, isSelected, onClick, isOPDisabled = false, displayNumber }: SeatButtonProps) {
    // V7.13: 표시할 번호 (displayNumber가 있으면 사용, 없으면 seat.seatNumber)
    const showNumber = displayNumber ?? seat.seatNumber;

    // V7.10 OP Disabled Logic
    const isOpStyle = isOPDisabled;

    // If selected, use grade color for background. 
    // If available, use grade color for border.
    const style = isOpStyle
        ? {}
        : (isSelected
            ? { backgroundColor: grade.color, borderColor: grade.color }
            : (seat.status === 'available' ? { borderColor: grade.color } : {}));

    const isDisabled = (seat.status !== 'available' && !isSelected) || isOPDisabled;

    const opDisabledClasses = "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed pointer-events-none";

    // V7.13: hover 툴팁 형식 개선 - "N층 N열 N번 (좌석등급)" + undefined 방어
    const rowLabel = seat.rowId || (seat as any).row || '?';
    const tooltipText = isOPDisabled
        ? "해당 공연은 OP석 판매를 하지 않습니다"
        : `${floor} ${rowLabel}열 ${showNumber}번 (${grade.grade}석)`;


    return (
        <button
            className={cn(
                "w-8 h-8 m-0.5 rounded-t-md text-[10px] font-medium transition-all duration-200 flex items-center justify-center select-none",
                isOpStyle ? opDisabledClasses : statusStyles[seat.status],
                (isSelected && !isOpStyle) ? statusStyles.selected : ""
            )}
            style={style}
            disabled={isDisabled}
            onClick={() => onClick(seat.seatId)}
            title={tooltipText}
        >
            {(seat.status === 'reserved' || isOPDisabled) ? 'X' : showNumber}
        </button>
    );
}
