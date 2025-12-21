"use client"

import { VenueData, Seat } from "@/types/venue"
import { SeatButton } from "../seat-button"

interface TheaterTemplateProps {
    venueData: VenueData;
    selectedSeats: string[];
    onSeatClick: (seatId: string) => void;
}

export function TheaterTemplate({ venueData, selectedSeats, onSeatClick }: TheaterTemplateProps) {
    return (
        <div className="flex flex-col gap-8 items-center min-w-max">
            {venueData.sections.map((section) => (
                <div key={section.sectionId} className="flex flex-col gap-2">
                    <h3 className="text-center text-sm text-gray-400 mb-2">{section.sectionName}</h3>

                    <div className="flex flex-col gap-1">
                        {section.rows.map((row) => {
                            // Find grade info for this row
                            const gradeInfo = venueData.grades.find(g => g.grade === row.grade);
                            if (!gradeInfo) return null;

                            return (
                                <div key={row.rowId} className="flex items-center gap-4">
                                    {/* Row Label (Left) */}
                                    <div className="w-8 text-center text-xs font-bold text-gray-500">{row.rowId}</div>

                                    {/* Seats */}
                                    <div className="flex gap-0.5">
                                        {row.seats.map((seat) => (
                                            <SeatButton
                                                key={seat.seatId}
                                                seat={seat}
                                                grade={gradeInfo}
                                                isSelected={selectedSeats.includes(seat.seatId)}
                                                onClick={onSeatClick}
                                            />
                                        ))}
                                    </div>

                                    {/* Row Label (Right) */}
                                    <div className="w-8 text-center text-xs font-bold text-gray-500">{row.rowId}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
