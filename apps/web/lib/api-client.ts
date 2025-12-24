import type { Performance, VenueData, HoldingRequest, HoldingResponse, ReservationRequest, ReservationResponse, SeatStatusResponse } from '@mega-ticket/shared-types';

class ApiClient {
    private baseUrl: string;

    constructor() {
        // 클라이언트 사이드에서는 rewrites를 통해 /api로, 
        // 서버 사이드(SSR)에서는 내부 URL로 호출
        this.baseUrl = typeof window === 'undefined'
            ? (process.env.INTERNAL_API_URL || 'http://localhost:3001')
            : '';
    }

    async getPerformance(id: string): Promise<Performance> {
        const url = `${this.baseUrl}/api/performances/${id}`;
        const res = await fetch(url, {
            next: { revalidate: 3600 }
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch performance: ${res.status}`);
        }
        return res.json();
    }

    async getVenue(id: string): Promise<VenueData> {
        const url = `${this.baseUrl}/api/venues/${id}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch venue: ${res.status}`);
        }
        return res.json();
    }

    async createHolding(data: HoldingRequest): Promise<HoldingResponse> {
        const url = `${this.baseUrl}/api/holdings`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    }

    async deleteHolding(holdingId: string): Promise<void> {
        const url = `${this.baseUrl}/api/holdings/${holdingId}`;
        await fetch(url, { method: 'DELETE' });
    }

    async createReservation(data: ReservationRequest): Promise<ReservationResponse> {
        const url = `${this.baseUrl}/api/reservations`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            if (res.status === 410) throw new Error("Expired");
            const errHelper = async () => { try { return await res.json() } catch { return { message: res.statusText } } };
            const errData = await errHelper();
            throw new Error(errData.message || "Reservation failed");
        }
        return res.json();
    }

    async getSeatStatus(performanceId: string, date: string, time: string): Promise<SeatStatusResponse> {
        const url = `${this.baseUrl}/api/seats/${performanceId}?date=${date}&time=${time}`;
        const res = await fetch(url, { cache: 'no-store' });
        return res.json();
    }

    async chat(messages: unknown[], modelId: string, userId?: string) {
        const url = `${this.baseUrl}/api/chat`;
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                modelId,
                userId
            })
        });
    }
}

export const apiClient = new ApiClient();
