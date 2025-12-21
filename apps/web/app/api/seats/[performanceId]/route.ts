
import { NextRequest, NextResponse } from "next/server";
import { getSeatStatusMap } from "@/lib/server/holding-manager";

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{
        performanceId: string;
    }>;
};

export async function GET(
    request: NextRequest,
    props: Props
) {
    const params = await props.params;
    try {
        const { performanceId } = params;

        // In a real app, date/time would also be params to identify specific showtime.
        // For prototype, we assume the performance ID implies the show or we just aggregate.
        // But the holding manager filters by performanceId mostly.

        const statusMap = getSeatStatusMap(performanceId);
        console.log(`[API GET /seats/${performanceId}] Returning status for ${Object.keys(statusMap).length} seats. Keys: ${Object.keys(statusMap).join(', ')}`);

        return NextResponse.json({
            seats: statusMap
        });

    } catch (e) {
        console.error("Error fetching seat status:", e);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
