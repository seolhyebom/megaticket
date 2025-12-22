
export interface Performance {
    id: string;
    title: string;
    venue: string;
    description: string;
    dates: string[]; // YYYY-MM-DD
    times: string[]; // HH:mm
    posterUrl?: string;
}

export interface SeatInfo {
    grade: string;
    price: number;
}

const PERFORMANCES: Performance[] = [
    {
        id: "perf-1",
        title: "오페라의 유령 (The Phantom of the Opera)",
        venue: "Mega Arts Center",
        description: "전 세계를 매혹시킨 불멸의 명작! 앤드류 로이드 웨버의 걸작.",
        dates: ["2025-12-25", "2025-12-26", "2025-12-27", "2025-12-28"],
        times: ["14:00", "19:00"],
        posterUrl: "/posters/phantom-poster.png"
    },
    {
        id: "perf-2",
        title: "레미제라블 (Les Misérables)",
        venue: "Mega Arts Center",
        description: "세계 4대 뮤지컬 중 하나, 빅토르 위고의 소설을 원작으로 한 감동의 대서사시.",
        dates: ["2025-12-30", "2025-12-31"],
        times: ["19:30"]
    },
    {
        id: "perf-kinky-1",
        title: "킹키부츠 (Kinky Boots)",
        venue: "샤롯데시어터",
        description: "토니상 6관왕 수상작! 평범한 청년 찰리와 드래그퀸 롤라가 함께 '킹키부츠'를 만들어가는 감동의 브로맨스.",
        dates: ["2026-02-10", "2026-02-11", "2026-02-14", "2026-02-15", "2026-03-01", "2026-03-15", "2026-04-25", "2026-04-30"],
        times: ["14:00", "14:30", "19:00", "19:30"],
        posterUrl: "/posters/kinky-boots-poster.jpg"
    }
];

export function getPerformance(performanceId: string): Performance | null {
    return PERFORMANCES.find(p => p.id === performanceId) || null;
}

export function getAllPerformances(): Performance[] {
    return PERFORMANCES;
}

export function getSeatInfo(seatId: string): SeatInfo {
    // 새 좌석 ID 형식: "1층-A-1-5" (층-구역-열-번호)
    const parts = seatId.split('-');

    // 새 형식인 경우
    if (parts.length >= 4) {
        // 좌석 배치도에서 등급 정보를 가져와야 하지만,
        // 현재는 샤롯데시어터(킹키부츠) 가격 체계 사용
        // grade는 venue.json에서 관리되므로 여기서는 기본값 반환
        return { grade: 'R', price: 140000 };
    }

    // 구 형식 (A-5 등)
    const [row, numberStr] = seatId.split('-');

    // Default fallback
    if (!row) return { grade: 'Unknown', price: 0 };

    // 킹키부츠 가격 체계 (샤롯데시어터)
    // OP/VIP: 170,000원, R: 140,000원, S: 110,000원, A: 80,000원
    if (['A', 'B'].includes(row)) {
        return { grade: 'VIP', price: 170000 };
    } else if (['C', 'D', 'E'].includes(row)) {
        return { grade: 'R', price: 140000 };
    } else if (['F', 'G', 'H'].includes(row)) {
        return { grade: 'S', price: 110000 };
    } else if (['I', 'J'].includes(row)) {
        return { grade: 'A', price: 80000 };
    }

    return { grade: 'Standard', price: 80000 };
}
