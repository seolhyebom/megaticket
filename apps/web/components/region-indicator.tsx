"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"
import { subscribeToRegion, getApiRegion } from "@/lib/api-client"
import { getAwsRegion, getApiUrl } from "@/lib/runtime-config"

export function RegionIndicator() {
    const [region, setRegion] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const pathname = usePathname()
    const hasAddedRegion = useRef(false)  // 한 번만 추가
    const initialFetchDone = useRef(false)

    // 전역 상태 구독 - API 호출 시 자동으로 리전 업데이트
    useEffect(() => {
        const unsubscribe = subscribeToRegion((newRegion) => {
            console.log('[RegionIndicator] Region updated from API:', newRegion);
            setRegion(newRegion);
            setIsLoading(false);
        });

        // 초기 로딩: 전역 상태 확인 또는 /api/health 호출 (sessionStorage 미사용)
        if (!initialFetchDone.current) {
            initialFetchDone.current = true;

            // 이미 api-client에서 리전을 가져왔다면 사용 (메모리 상태)
            const currentRegion = getApiRegion();
            if (currentRegion) {
                setRegion(currentRegion);
                setIsLoading(false);
            } else {
                // 첫 로딩 시 /api/health 호출하여 X-Api-Region 헤더에서 리전 확인
                fetchInitialRegion();
            }
        }

        return unsubscribe;
    }, []);

    // 초기 리전 조회 - X-Api-Region 헤더에서만 읽음 (sessionStorage 미사용)
    const fetchInitialRegion = async () => {
        try {
            const response = await fetch(`${getApiUrl()}/api/health`);
            // 오직 X-Api-Region 헤더만 사용
            const apiRegion = response.headers.get('X-Api-Region');
            if (apiRegion) {
                setRegion(apiRegion);
            } else if (response.ok) {
                // 헤더 없으면 response body에서 확인 (폴백)
                const data = await response.json();
                setRegion(data.region || getAwsRegion());
            } else {
                setRegion(getAwsRegion());
            }
        } catch {
            setRegion(getAwsRegion());
        } finally {
            setIsLoading(false);
        }
    };

    // V9.1: URL에 region 파라미터 추가 (useSearchParams 제거 - Suspense 트리거 방지)
    useEffect(() => {
        if (!region || hasAddedRegion.current) return

        // window.location.search를 직접 사용 (useSearchParams는 Suspense 트리거)
        const currentParams = new URLSearchParams(window.location.search)

        // 이미 URL에 region이 있으면 스킵
        if (currentParams.get('region') === region) {
            hasAddedRegion.current = true
            return
        }

        // 현재 URL 파라미터 복사 후 region 추가
        currentParams.set('region', region)

        // window.history.replaceState로 URL만 변경 (페이지 재렌더링 없음)
        const newUrl = `${pathname}?${currentParams.toString()}`
        window.history.replaceState(null, '', newUrl)
        hasAddedRegion.current = true
    }, [region, pathname])

    // 로딩 중 표시
    if (isLoading) {
        return (
            <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-2 shadow-lg backdrop-blur-sm border border-white/10 pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                Loading...
            </div>
        )
    }

    if (!region) return null

    // Visual indicator for DR/Failover regions
    const isMainRegion = region === 'ap-northeast-2'

    const getRegionName = (r: string) => {
        if (r === 'ap-northeast-2') return '(서울)';
        if (r === 'ap-northeast-1') return '(도쿄)';
        return '';
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-2 shadow-lg backdrop-blur-sm border border-white/10 pointer-events-none">
            <div className={`w-2 h-2 rounded-full ${isMainRegion ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
            Region: {region}{getRegionName(region)}
        </div>
    )
}
