import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server instance ID - generated at server startup.
 * Used to detect server restarts and redirect users to main page.
 */
const SERVER_INSTANCE_ID = Date.now().toString();
const COOKIE_NAME = 'mega-ticket-server-id';

/**
 * Middleware to:
 * 1. Detect server restarts and redirect to main page
 * 2. Ensure region parameter is present on the main page
 */
export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
    const defaultRegion = process.env.AWS_REGION || 'ap-northeast-2';

    // Get the stored server ID from cookie
    const storedServerId = request.cookies.get(COOKIE_NAME)?.value;

    // Check if server was restarted (different server ID)
    const serverRestarted = storedServerId && storedServerId !== SERVER_INSTANCE_ID;

    // If server restarted and not already on main page, redirect to main page
    if (serverRestarted && pathname !== '/') {
        const mainPageUrl = new URL('/', request.url);
        mainPageUrl.searchParams.set('region', defaultRegion);

        const response = NextResponse.redirect(mainPageUrl);
        // Update cookie with new server ID
        response.cookies.set(COOKIE_NAME, SERVER_INSTANCE_ID, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
        });
        return response;
    }

    // For main page: ensure region parameter exists
    if (pathname === '/') {
        const region = searchParams.get('region');

        if (!region) {
            const url = request.nextUrl.clone();
            url.searchParams.set('region', defaultRegion);

            const response = NextResponse.redirect(url);
            // Set/update server ID cookie
            response.cookies.set(COOKIE_NAME, SERVER_INSTANCE_ID, {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
            });
            return response;
        }
    }

    // For all other requests, just update the server ID cookie
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, SERVER_INSTANCE_ID, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
    });
    return response;
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
