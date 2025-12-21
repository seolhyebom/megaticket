import { NextRequest, NextResponse } from "next/server";
import { releaseHolding } from "@/lib/server/holding-manager";

type Props = {
    params: Promise<{
        holdingId: string;
    }>;
};

export async function DELETE(
    request: NextRequest,
    props: Props
) {
    const params = await props.params;
    try {
        const { holdingId } = params;

        if (!holdingId) {
            return NextResponse.json(
                { success: false, error: "Missing holdingId" },
                { status: 400 }
            );
        }

        const success = releaseHolding(holdingId);

        if (!success) {
            // Holding might have expired already or invalid ID
            return NextResponse.json(
                { success: false, message: "Holding not found or already released" },
                { status: 404 } // Or 200 depending on idempotency preference, but 404 is fine as per spec suggestion
            );
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error("Error releasing holding:", e);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
