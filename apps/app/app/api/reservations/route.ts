import { NextRequest, NextResponse } from "next/server"
import { getUserReservations, cancelReservation, confirmReservation, deleteReservation } from "@/lib/server/holding-manager"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('[DEBUG] 예약 확정 요청:', JSON.stringify(body, null, 2));

        const { holdingId, performanceTitle, venue } = body;

        if (!holdingId) {
            console.log('[DEBUG] holdingId 누락');
            return NextResponse.json(
                { message: "holdingId is required" },
                { status: 400 }
            );
        }

        console.log('[DEBUG] confirmReservation 호출:', { holdingId, performanceTitle, venue });
        const result = await confirmReservation(holdingId, performanceTitle, venue);
        console.log('[DEBUG] confirmReservation 결과:', JSON.stringify(result, null, 2));

        if (!result.success) {
            console.log('[DEBUG] 예약 실패:', result.error);
            return NextResponse.json(
                { message: result.error || "Reservation failed" },
                { status: 400 }
            );
        }

        return NextResponse.json(result.reservation);
    } catch (error) {
        console.error("[DEBUG] 예약 확정 예외 발생:", error);
        return NextResponse.json(
            { message: "Internal Server Error", details: String(error) },
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
        const method = searchParams.get("method") // V7.14: PURGE면 완전삭제, 없으면 취소

        if (!reservationId) {
            return NextResponse.json(
                { error: "Reservation ID is required" },
                { status: 400 }
            )
        }

        let success: boolean;

        if (method === "PURGE") {
            // V7.14: 취소된 예약 완전 삭제
            success = await deleteReservation(reservationId);
        } else {
            // 기존: 예약 취소 (상태 변경)
            success = await cancelReservation(reservationId);
        }

        if (!success) {
            return NextResponse.json(
                { error: method === "PURGE" ? "Cancelled reservation not found" : "Reservation not found or already cancelled" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to process reservation:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
