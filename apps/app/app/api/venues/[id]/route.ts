import { NextRequest, NextResponse } from "next/server";
import { getVenue } from "@/lib/server/services/venue-service";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const id = params.id;
    const venue = await getVenue(id);

    // If DB fallback is null, we might want to return 404
    // However, for SeatMap compatibility, we might want to return default mock data if we had it.
    // Since we don't have venue fallback in service yet (returned null), 
    // we will return 404 here and let the client handle it (or mock it).

    if (!venue) {
        return NextResponse.json(
            { error: "Venue not found" },
            { status: 404 }
        );
    }

    return NextResponse.json(venue);
}
