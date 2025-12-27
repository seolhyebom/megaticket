
import React from 'react';
import { SeatGradeDisplay } from '../types/chat';

interface SeatGradeListProps {
    grades: SeatGradeDisplay[];
}

export function SeatGradeList({ grades }: SeatGradeListProps) {
    if (!grades || grades.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
            {grades.map((g, idx) => (
                <div key={idx} className="flex items-center text-sm bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-1.5 border border-gray-200 dark:border-gray-700">
                    <span
                        className="w-3 h-3 rounded-full mr-2 shadow-sm"
                        style={{ backgroundColor: g.color }}
                    />
                    <span className="font-semibold mr-1">{g.grade}</span>
                    <span className="text-gray-600 dark:text-gray-400">
                        {g.price.toLocaleString()}원
                    </span>
                    {g.count !== undefined && (
                        <span className="ml-2 text-xs text-gray-500">
                            ({g.count}석)
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
