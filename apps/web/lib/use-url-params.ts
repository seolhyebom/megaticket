'use client';

import { useState } from 'react';

/**
 * S3 Static Export 환경에서 동적 라우트 ID 추출을 위한 커스텀 훅
 * 
 * CloudFront Function이 /performances/_placeholder/index.html로 rewrite하지만,
 * 브라우저 URL은 /performances/perf-kinky-1 그대로 유지되므로
 * window.location.pathname에서 실제 ID를 추출합니다.
 */

/**
 * /performances/{id} 경로에서 공연 ID를 추출하는 훅
 * @returns 공연 ID 또는 null (SSR/추출 실패 시)
 */
export function usePerformanceId(): string | null {
    // useState 초기값 함수에서 바로 ID 추출 → 깜빡임 방지
    const [id] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;

        const pathname = window.location.pathname;
        // /performances/{id} 또는 /performances/{id}/booking 또는 /performances/{id}/seats 패턴 매칭
        const match = pathname.match(/^\/performances\/([^\/]+)/);

        if (match && match[1] && match[1] !== '_placeholder') {
            return match[1];
        }
        return null;
    });

    return id;
}

/**
 * 동기적으로 URL에서 공연 ID를 추출하는 유틸리티 함수
 * (useEffect 외부에서 초기값 설정 시 사용)
 * @returns 공연 ID 또는 null
 */
export function getPerformanceIdFromUrl(): string | null {
    if (typeof window === 'undefined') return null;

    const pathname = window.location.pathname;
    const match = pathname.match(/^\/performances\/([^\/]+)/);

    return (match && match[1] && match[1] !== '_placeholder') ? match[1] : null;
}
