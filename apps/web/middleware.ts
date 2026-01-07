import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to ensure region parameter is present on the main page.
 * 
 * Note: Server restart detection logic was removed to support DR (Disaster Recovery).
 * In multi-region DR architecture, server ID mismatch between Seoul and Tokyo
 * caused unwanted 307 redirects during failover.
 */
export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
    const defaultRegion = process.env.AWS_REGION || 'ap-northeast-2';

    // For main page: ensure region parameter exists
    if (pathname === '/') {
        const region = searchParams.get('region');

        if (!region) {
            const url = request.nextUrl.clone();
            url.searchParams.set('region', defaultRegion);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

// Configure which paths this middleware applies to
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
