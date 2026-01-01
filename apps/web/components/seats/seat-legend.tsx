"use client"

import { Grade } from "@mega-ticket/shared-types"

interface SeatLegendProps {
    grades: Grade[];
    hasOPSeats?: boolean; // V7.10 Added
}

export function SeatLegend({ grades, hasOPSeats = true }: SeatLegendProps) {
    // Filter out OP grade if hasOPSeats is false
    const displayGrades = hasOPSeats
        ? grades
        : grades.filter(g => g.grade !== 'OP');

    // V7.16 Fix: Display OP seat first
    const GRADE_PRIORITY: Record<string, number> = {
        'OP': 0,
        'VIP': 1,
        'R': 2,
        'S': 3,
        'A': 4
    };

    const sortedGrades = [...displayGrades].sort((a, b) => {
        const pA = GRADE_PRIORITY[a.grade] ?? 99;
        const pB = GRADE_PRIORITY[b.grade] ?? 99;
        return pA - pB;
    });

    return (
        <div className="w-full border-t bg-white flex justify-center border-b">
            <div className="w-full max-w-full flex flex-nowrap items-center justify-center gap-6 p-4 px-8 text-sm whitespace-nowrap overflow-x-auto custom-scrollbar">
                {/* Grades */}
                {sortedGrades.map((grade) => (
                    <div key={grade.grade} className="flex items-center gap-2">
                        <div
                            className="w-4 h-4 rounded-sm border-2"
                            style={{ borderColor: grade.color }}
                        />
                        <span>{grade.grade.endsWith('석') ? grade.grade : grade.grade + '석'} {grade.price > 0 && `(${grade.price.toLocaleString()}원)`}</span>
                        <div className="h-4 w-px bg-gray-200 ml-4 hidden sm:block last:hidden" />
                    </div>
                ))}

                {/* Divider */}
                <div className="h-4 w-px bg-gray-300 hidden sm:block" />

                {/* Statuses */}
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm bg-gray-300" />
                    <span className="text-gray-500">예매완료</span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm bg-orange-500 border-orange-500 border-2" />
                    <span>선택좌석</span>
                </div>
            </div>
        </div>
    )
}
