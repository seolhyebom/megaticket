import { NextRequest, NextResponse } from "next/server"
import { getUserReservations, cancelReservation, confirmReservation } from "@/lib/server/holding-manager"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { holdingId, performanceTitle, venue } = body;

        if (!holdingId) {
            return NextResponse.json(
                { message: "holdingId is required" },
                { status: 400 }
            );
        }

        const result = await confirmReservation(holdingId, performanceTitle, venue);

        if (!result.success) {
            return NextResponse.json(
                { message: result.error || "Reservation failed" },
                { status: 400 }
            );
        }

        return NextResponse.json(result.reservation);
    } catch (error) {
        console.error("Failed to confirm reservation:", error);
        return NextResponse.json(
            { message: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get("userId")

        if (!userId) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 }
            )
        }

        const userReservations = await getUserReservations(userId);

        return NextResponse.json(userReservations)
    } catch (error) {
        console.error("Failed to fetch reservations:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const reservationId = searchParams.get("reservationId")

        if (!reservationId) {
            return NextResponse.json(
                { error: "Reservation ID is required" },
                { status: 400 }
            )
        }

        const success = await cancelReservation(reservationId);

        if (!success) {
            return NextResponse.json(
                { error: "Reservation not found or already cancelled" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to cancel reservation:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
