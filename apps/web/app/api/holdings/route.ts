import { NextRequest, NextResponse } from "next/server";
import { createHolding, Seat } from "@/lib/server/holding-manager";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { performanceId, seats, userId, date, time } = body;

        if (!performanceId || !seats || !userId || !date || !time) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        console.log(`[API POST /holdings] Request:`, { performanceId, seatCount: seats.length, userId });

        const result = createHolding(performanceId, seats as Seat[], userId, date, time);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "SEATS_ALREADY_HELD",
                    message: result.error
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            holdingId: result.holdingId,
            expiresAt: result.expiresAt
        });

    } catch (e) {
        console.error("Error creating holding:", e);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
