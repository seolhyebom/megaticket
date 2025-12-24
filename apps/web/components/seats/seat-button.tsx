"use client"

import { Seat, Grade, SeatStatus } from "@mega-ticket/shared-types"
import { cn } from "@/lib/utils"

interface SeatButtonProps {
    seat: Seat;
    grade: Grade;
    isSelected: boolean;
    onClick: (seatId: string) => void;
}

const statusStyles: Record<SeatStatus, string> = {
    available: 'bg-white border-2 hover:brightness-95 cursor-pointer',
    selected: 'border-2 text-white shadow-md animate-in zoom-in-95 duration-200',
    reserved: 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed',
    holding: 'bg-yellow-300 border-yellow-400 text-yellow-900 cursor-not-allowed',
    disabled: 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed',
    empty: 'invisible pointer-events-none border-none',
};

export function SeatButton({ seat, grade, isSelected, onClick }: SeatButtonProps) {
    // If selected, use grade color for background. 
    // If available, use grade color for border.
    const style = isSelected
        ? { backgroundColor: grade.color, borderColor: grade.color }
        : (seat.status === 'available' ? { borderColor: grade.color } : {});

    const isDisabled = seat.status !== 'available' && !isSelected;

    return (
        <button
            className={cn(
                "w-8 h-8 m-0.5 rounded-t-md text-[10px] font-medium transition-all duration-200 flex items-center justify-center select-none",
                statusStyles[seat.status],
                isSelected ? statusStyles.selected : ""
            )}
            style={style}
            disabled={isDisabled}
            onClick={() => onClick(seat.seatId)}
            title={`${seat.rowId}열 ${seat.seatNumber}번 (${grade.grade}석)`}
        >
            {seat.status === 'reserved' ? 'X' : seat.seatNumber}
        </button>
    );
}
