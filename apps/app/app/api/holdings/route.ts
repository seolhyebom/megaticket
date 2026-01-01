import { NextRequest, NextResponse } from "next/server";
import { createHolding } from "@/lib/server/holding-manager";
import { Seat } from "@mega-ticket/shared-types";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // V7.20: venue, performanceTitle, posterUrl 추가
        const { performanceId, seats, userId, date, time, venue, performanceTitle, posterUrl } = body;

        if (!performanceId || !seats || !userId || !date || !time) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        console.log(`[REALTIME] [HOLDING] [API POST /holdings] Request:`, { performanceId, seatCount: seats.length, userId, venue, performanceTitle, posterUrl });

        // V7.20: venue, performanceTitle, posterUrl 전달
        const result = await createHolding(performanceId, seats as Seat[], userId, date, time, venue, performanceTitle, posterUrl);


        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "SEATS_ALREADY_HELD",
                    message: result.error,
                    unavailableSeats: result.unavailableSeats
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            holdingId: result.holdingId,
            expiresAt: result.expiresAt,
            remainingSeconds: result.remainingSeconds
        });

    } catch (e) {
        console.error("Error creating holding:", e);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
