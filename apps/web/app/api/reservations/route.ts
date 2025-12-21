import { NextRequest, NextResponse } from "next/server";
import { confirmResercation, getUserReservations } from "@/lib/server/holding-manager";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { holdingId, performanceTitle, venue } = body;

        if (!holdingId || !performanceTitle || !venue) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        const result = confirmResercation(holdingId, performanceTitle, venue);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "RESERVATION_FAILED",
                    message: result.error
                },
                { status: 410 } // Gone (Expired)
            );
        }

        return NextResponse.json({
            success: true,
            reservation: result.reservation,
            redirectUrl: `/reservation/complete`
        });

    } catch (e) {
        console.error("Error confirming reservation:", e);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "Missing userId" },
                { status: 400 }
            );
        }

        const reservations = getUserReservations(userId);

        return NextResponse.json({
            reservations
        });

    } catch (e) {
        console.error("Error fetching reservations:", e);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
