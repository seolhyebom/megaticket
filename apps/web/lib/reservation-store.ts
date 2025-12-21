import { Seat } from "@/types/venue"

export interface ReservationSession {
    performanceId: string;
    performanceTitle: string; // Add title for display
    date: string;
    time: string;
    seats: Seat[];
    totalPrice: number;
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
