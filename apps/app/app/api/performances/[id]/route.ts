import { NextRequest, NextResponse } from "next/server";
import { getPerformance } from "@/lib/server/performance-service";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const id = params.id;
    const performance = await getPerformance(id);

    if (!performance) {
        return NextResponse.json(
            { error: "Performance not found" },
            { status: 404 }
        );
    }

    return NextResponse.json(performance);
}
