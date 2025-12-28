
"use client"

import { useEffect, useState } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"

export function RegionIndicator() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const [region, setRegion] = useState<string | null>(null)

    // API에서 런타임 리전 가져오기 (DR 시나리오 지원)
    useEffect(() => {
        const fetchRegion = async () => {
            try {
                const res = await fetch('/api/health')
                if (res.ok) {
                    const data = await res.json()
                    if (data.region) {
                        setRegion(data.region)
                    }
                }
            } catch {
                // 실패 시 URL 파라미터에서 가져오기
                const urlRegion = searchParams.get('region')
                if (urlRegion) setRegion(urlRegion)
            }
        }
        fetchRegion()
    }, [searchParams])

    useEffect(() => {
        // Update URL with region if not present (to meet user request "add to address bar")
        if (region && !searchParams.has('region')) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('region', region)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }, [region, searchParams, pathname, router])

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
