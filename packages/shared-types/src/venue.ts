export type VenueType = 'concert-hall' | 'theater' | 'arena';

export type SeatStatus = 'available' | 'selected' | 'reserved' | 'holding' | 'disabled' | 'empty';

export interface Seat {
    seatId: string;
    seatNumber: number;
    number?: number; // Compatibility for holding-manager
    rowId: string;
    row?: string;    // Compatibility for holding-manager
    grade: string;
    price?: number;  // Added for holding-manager
    status: SeatStatus;
    x?: number;
    y?: number;
}

export interface Row {
    rowId: string;
    rowName: string;
    grade: string;
    seats: Seat[];
}

export interface Section {
    sectionId: string;
    sectionName: string;
    floor: string;
    rows: Row[];
}

export interface Grade {
    grade: string;
    color: string;
    price: number;
}

export interface VenueData {
    venueId: string;
    venueName: string;
    venueType: VenueType;
    totalSeats: number;
    sections: Section[];
    grades: Grade[];
}

export interface Holding {
    holdingId: string;
    performanceId: string;
    date: string;
    time: string;
    seats: Seat[];
    userId: string;
    createdAt: string; // ISO date string
    expiresAt: string; // ISO date string
}

export interface Reservation {
    id: string;
    userId: string;
    performanceId: string;
    performanceTitle: string;
    venue: string;
    posterUrl?: string;
    date: string;
    time: string;
    seats: Seat[];
    totalPrice: number;
    status: 'confirmed' | 'cancelled';
    createdAt: string;
}
