import { Seat, SectionData } from "@mega-ticket/shared-types"

export interface ReservationSession {
    performanceId: string;
    performanceTitle: string; // Add title for display
    date: string;
    time: string;
    seats: Seat[];
    totalPrice: number;
    venue?: string; // Add venue for display
    sections?: SectionData[]; // V7.15 SSOT: 연속 번호 계산용
    seatColors?: Record<string, string>; // [V8.22] DB seatColors (TTL 7일 적용)
}

const STORAGE_KEY = "megaticket-reservation-session"

export const reservationStore = {
    saveSession: (session: ReservationSession) => {
        if (typeof window === "undefined") return
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    },

    getSession: (): ReservationSession | null => {
        if (typeof window === "undefined") return null
        const data = sessionStorage.getItem(STORAGE_KEY)
        return data ? JSON.parse(data) : null
    },

    clearSession: () => {
        if (typeof window === "undefined") return
        sessionStorage.removeItem(STORAGE_KEY)
    }
}
