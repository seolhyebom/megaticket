export interface VenueSection {
    id: string;           // 예: "A", "B", "VIP"
    name: string;         // 예: "1층 좌측", "VIP석"
    floor: number;        // 층수
    rows: number[];       // 열 범위 [시작, 끝]
    seatsPerRow: number;  // 열당 좌석 수
    grade: 'VIP' | 'R' | 'S' | 'A';
    position: 'left' | 'center' | 'right';
    description: string;
}

export interface VenueInfo {
    id: string;
    name: string;
    totalSeats: number;
    sections: VenueSection[];
    specialSeats?: {
        wheelchair?: string[];    // 휠체어석 위치
        companion?: string[];     // 동반석 위치
    };
}


