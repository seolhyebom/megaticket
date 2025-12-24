
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
        const { searchParams } = new URL(request.url);
        const { performanceId } = params;
        const date = searchParams.get('date');
        const time = searchParams.get('time');

        if (!date || !time) {
            // If missing, return empty or default?
            // For now, let's error or default to empty to force frontend to send them.
            // Or better, handle gracefully.
            console.warn(`[API GET /seats/${performanceId}] Missing date/time params`);
            // Default to not returning specific statuses if date/time missing, 
            // but getSeatStatusMap might execute cleanup.
            // Let's pass empty strings if undefined, getSeatStatusMap will likely match nothing, return all available.
            // This is safer than crashing.
        }

        const statusMap = await getSeatStatusMap(performanceId, date || '', time || '');
        console.log(`[API GET /seats/${performanceId}] Date: ${date}, Time: ${time}. Returning status for ${Object.keys(statusMap).length} seats.`);

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
