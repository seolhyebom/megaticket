import { NextResponse } from 'next/server';

export async function GET() {
    const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2';

    return NextResponse.json({
        status: 'ok',
        region: region,
        timestamp: new Date().toISOString()
    });
}
