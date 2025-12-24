
"use client"

import { useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"

export function RegionIndicator({ region }: { region?: string }) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()


    useEffect(() => {
        // Update URL with region if not present (to meet user request "add to address bar")
        // Only do this if we are in a DR region (e.g. ca-central-1) or if specific env var is set
        if (region && !searchParams.has('region')) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('region', region)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }, [region, searchParams, pathname, router])

    if (!region) return null

    // Visual indicator for DR/Failover regions
    const isMainRegion = region === 'ap-northeast-2'

    // Always show region as requested
    // if (isMainRegion) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-2 shadow-lg backdrop-blur-sm border border-white/10 pointer-events-none">
            <div className={`w-2 h-2 rounded-full ${isMainRegion ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
            Region: {region}{isMainRegion ? '(서울)' : ''}
        </div>
    )
}
