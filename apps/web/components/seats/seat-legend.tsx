"use client"

import { Grade } from "@/types/venue"

interface SeatLegendProps {
    grades: Grade[];
}

export function SeatLegend({ grades }: SeatLegendProps) {
    return (
        <div className="w-full border-t bg-white flex justify-center border-b">
            <div className="w-full max-w-4xl flex flex-wrap items-center justify-between p-4 px-8 text-sm">
                {/* Grades (Left) */}
                <div className="flex flex-wrap gap-4">
                    {grades.map((grade) => (
                        <div key={grade.grade} className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded-sm border-2"
                                style={{ borderColor: grade.color }}
                            />
                            <span>{grade.grade}석 ({grade.price.toLocaleString()}원)</span>
                        </div>
                    ))}
                </div>

                {/* Statuses (Right) */}
                <div className="flex items-center gap-6">
                    <div className="hidden sm:block w-px h-4 bg-gray-300" />
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm bg-gray-300" />
                        <span className="text-gray-500">예매완료</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm bg-primary border-primary border-2" />
                        <span>선택좌석</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
