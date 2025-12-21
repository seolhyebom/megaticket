export type VenueType = 'concert-hall' | 'theater' | 'arena';

export type SeatStatus = 'available' | 'selected' | 'reserved' | 'holding' | 'disabled';

export interface Seat {
    seatId: string;
    seatNumber: number;
    rowId: string;
    grade: string;
    status: SeatStatus;
    x?: number; // For SVG/Canvas positioning
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
