export interface SeatGrade {
    grade: string;
    price: number;
    color: string;
}

export interface PerformanceSchedule {
    date: string;
    dayOfWeek?: string; // Added for booking page
    times: { time: string; seatCount: number; status?: string; availableSeats?: number }[]; // Extended for booking
}

export interface Performance {
    id: string; // compatibility
    performanceId: string;
    title: string;
    venueId: string;
    venue: string; // Added to match backend response
    posterUrl: string;
    dates: string[];
    times: string[];
    grades: SeatGrade[];
    hasOPSeats?: boolean; // V7.10 Added
    description: string;
    duration: string; // clean name
    runtime: string; // compatibility
    ageRating: string; // clean name
    ageLimit: string; // compatibility
    price: string; // compatibility (display string)
    schedules?: PerformanceSchedule[]; // for booking
}
