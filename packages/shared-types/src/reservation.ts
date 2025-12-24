import { Seat } from './venue';

export interface HoldingRequest {
    performanceId: string;
    seats: (Seat & { rowId: string })[];
    userId: string;
    date: string;
    time: string;
}

export interface HoldingResponse {
    holdingId: string;
    success: boolean;
    message: string;
    expiresAt?: string; // ISO string
}

export interface ReservationRequest {
    holdingId: string;
    performanceTitle: string;
    venue: string;
}

export interface ReservationResponse {
    reservationId: string;
    success: boolean;
    message: string;
}

export interface SeatStatusMap {
    [seatId: string]: string;
}

export interface SeatStatusResponse {
    seats: SeatStatusMap;
}
