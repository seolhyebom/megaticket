
import { NextResponse } from "next/server";
import { getAllPerformances } from "@/lib/server/performance-service";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const performances = await getAllPerformances();
        return NextResponse.json(performances);
    } catch (error) {
        console.error("[API GET /performances] Error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
