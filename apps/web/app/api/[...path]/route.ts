import { NextRequest, NextResponse } from 'next/server';

/**
 * Catch-all API Route Handler
 * 런타임에 INTERNAL_API_URL 환경변수를 읽어서 App 서버로 프록시
 * rewrites()는 빌드 시점에 고정되므로, 이 방식을 사용
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, await params);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, await params);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, await params);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, await params);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, await params);
}

async function proxyRequest(
    request: NextRequest,
    params: { path: string[] }
) {
    // 런타임에 환경변수 읽기 - 빌드 시점이 아닌 요청 시점에 평가됨
    const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

    const pathSegments = params.path || [];
    const apiPath = pathSegments.join('/');
    const targetUrl = `${INTERNAL_API_URL}/api/${apiPath}`;

    // 쿼리 파라미터 포함
    const url = new URL(request.url);
    const queryString = url.search;
    const fullTargetUrl = `${targetUrl}${queryString}`;

    console.log(`[API Proxy] ${request.method} ${request.url} -> ${fullTargetUrl}`);

    try {
        // 요청 헤더 복사 (host 제외)
        const headers = new Headers();
        request.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'host') {
                headers.set(key, value);
            }
        });

        // 요청 본문 처리
        let body: BodyInit | undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            try {
                body = await request.text();
            } catch {
                // body가 없는 경우
            }
        }

        const response = await fetch(fullTargetUrl, {
            method: request.method,
            headers,
            body,
        });

        // 응답 헤더 복사
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            // 일부 헤더는 Next.js가 자동 처리하므로 제외
            if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
                responseHeaders.set(key, value);
            }
        });

        // 스트리밍 응답 지원
        const responseBody = response.body;

        return new NextResponse(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error(`[API Proxy] Error proxying to ${fullTargetUrl}:`, error);
        return NextResponse.json(
            { error: 'Failed to proxy request', details: String(error) },
            { status: 502 }
        );
    }
}
