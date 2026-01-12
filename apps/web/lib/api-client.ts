import type { Performance, VenueData, HoldingRequest, HoldingResponse, ReservationRequest, ReservationResponse, SeatStatusResponse } from '@mega-ticket/shared-types';
import { getApiUrl } from './runtime-config';

// =============================================================================
// 전역 Region 상태 관리 (DR 전환 시 실시간 감지)
// =============================================================================
let currentApiRegion: string | null = null;
const regionListeners: Set<(region: string) => void> = new Set();

/**
 * API 응답에서 X-Api-Region 헤더를 읽어 전역 상태 업데이트
 */
function updateRegionFromResponse(response: Response) {
    const region = response.headers.get('X-Api-Region');
    if (region && region !== currentApiRegion) {
        console.log(`[ApiClient] Region changed: ${currentApiRegion} → ${region}`);
        currentApiRegion = region;
        // 모든 리스너에게 알림 (sessionStorage 사용 안함 - 오직 메모리 상태만)
        regionListeners.forEach(listener => listener(region));
    }
}

/**
 * 현재 API 리전 가져오기
 */
export function getApiRegion(): string | null {
    return currentApiRegion;
}

/**
 * 리전 변경 이벤트 구독
 */
export function subscribeToRegion(listener: (region: string) => void): () => void {
    regionListeners.add(listener);
    // 이미 리전이 있으면 즉시 호출
    if (currentApiRegion) {
        listener(currentApiRegion);
    }
    // unsubscribe 함수 반환
    return () => regionListeners.delete(listener);
}

// =============================================================================
// API Client
// =============================================================================
class ApiClient {
    private getBaseUrl(): string {
        // S3 정적 호스팅: 런타임 Config에서 API URL 가져옴
        // SSR이 없으므로 항상 클라이언트 사이드에서 실행
        if (typeof window !== 'undefined') {
            return getApiUrl();
        }
        // 빌드 타임에는 빈 문자열 반환 (실제로 호출되지 않음)
        return '';
    }

    async getPerformance(id: string): Promise<Performance> {
        const url = `${this.getBaseUrl()}/api/performances/${id}`;
        const res = await fetch(url);
        updateRegionFromResponse(res);
        if (!res.ok) {
            throw new Error(`Failed to fetch performance: ${res.status}`);
        }
        return res.json();
    }

    async getVenue(id: string): Promise<VenueData> {
        const url = `${this.getBaseUrl()}/api/venues/${id}`;
        const res = await fetch(url);
        updateRegionFromResponse(res);
        if (!res.ok) {
            throw new Error(`Failed to fetch venue: ${res.status}`);
        }
        return res.json();
    }

    async createHolding(data: HoldingRequest): Promise<HoldingResponse> {
        const url = `${this.getBaseUrl()}/api/holdings`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        updateRegionFromResponse(res);
        return res.json();
    }

    async deleteHolding(holdingId: string): Promise<void> {
        const url = `${this.getBaseUrl()}/api/holdings/${holdingId}`;
        const res = await fetch(url, { method: 'DELETE' });
        updateRegionFromResponse(res);
    }

    async createReservation(data: ReservationRequest): Promise<ReservationResponse> {
        const url = `${this.getBaseUrl()}/api/reservations`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        updateRegionFromResponse(res);

        if (!res.ok) {
            if (res.status === 410) throw new Error("Expired");
            const errHelper = async () => { try { return await res.json() } catch { return { message: res.statusText } } };
            const errData = await errHelper();
            throw new Error(errData.message || "Reservation failed");
        }
        return res.json();
    }

    async getSeatStatus(performanceId: string, date: string, time: string): Promise<SeatStatusResponse> {
        const url = `${this.getBaseUrl()}/api/seats/${performanceId}?date=${date}&time=${time}`;
        const res = await fetch(url, { cache: 'no-store' });
        updateRegionFromResponse(res);
        return res.json();
    }

    async chat(messages: unknown[], modelId: string, userId?: string, sessionId?: string) {
        const url = `${this.getBaseUrl()}/api/chat`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                modelId,
                userId,
                sessionId  // [V8.0] 세션 상태 관리용
            })
        });
        updateRegionFromResponse(res);
        return res;
    }
}

export const apiClient = new ApiClient();
