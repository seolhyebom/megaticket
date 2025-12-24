
export interface TimeSlot {
    time: string
    availableSeats: number
    status: "available" | "soldout" | "few"
    cast?: string
}

export interface Schedule {
    date: string
    dayOfWeek: string
    times: TimeSlot[]
}

export interface PerformanceData {
    id: string
    title: string
    titleEn?: string
    genre: string
    image: string
    dateRange: string
    schedule: string
    venue: string
    description: string
    price: string
    runtime: string
    ageLimit: string
    poster: string // Added poster field to match usage in BookingPage
    producer?: string
    contact?: string
    schedules: Schedule[]
}

export const PERFORMANCES: Record<string, PerformanceData> = {
    "perf-kinky-1": {
        id: "perf-kinky-1",
        title: "킹키부츠",
        titleEn: "Kinky Boots",
        genre: "뮤지컬",
        image: "/posters/kinky-boots.png",
        poster: "/posters/kinky-boots.png",
        dateRange: "2026.02.10 ~ 2026.04.30",
        schedule: "화, 목, 금 19:30 / 수 14:30, 19:30 / 토, 일 14:00, 19:00 / * 매주 월요일 공연 없음",
        venue: "샤롯데시어터",
        description: "전 세계가 열광한 브로드웨이 뮤지컬! 편견과 억압에 맞서 진정한 나를 찾아가는 두 남자의 감동적인 이야기. 신나는 음악과 화려한 무대, 그리고 가슴 따뜻한 메시지까지!",
        price: "VIP석 170,000원 / R석 140,000원 / S석 110,000원 / A석 80,000원",
        runtime: "155분 (인터미션 20분)",
        ageLimit: "8세 이상 관람가",

        producer: "CJ ENM",
        contact: "1544-1555",
        schedules: generateKinkySchedule()
    },
    "perf-phantom-of-the-opera-1": {
        id: "perf-phantom-of-the-opera-1",
        title: "오페라의 유령",
        titleEn: "The Phantom of the Opera",
        genre: "뮤지컬",
        image: "/posters/opera-new.png",
        poster: "/posters/opera-new.png",
        dateRange: "2026.02.20 ~ 2026.06.15",
        schedule: "화, 목 19:30 / 수, 금 14:30, 19:30 / 토 14:00, 19:00 / 일 15:00 / * 3/1 공연 없음, 4/12 19:30, 매주 월요일 공연 없음",
        venue: "샤롯데시어터",
        description: "전 세계를 매혹시킨 불멸의 명작! 브로드웨이 최장기 공연 기네스북 등재. 앤드류 로이드 웨버의 역대급 뮤지컬 넘버와 화려한 무대 연출로 관객들의 마음을 사로잡는 감동의 대서사시.",
        price: "VIP석 150,000원 / R석 120,000원 / S석 90,000원 / A석 60,000원",
        runtime: "150분 (인터미션 20분)",
        ageLimit: "초등학생이상 관람가",
        producer: "S&CO",
        contact: "1588-5212",
        schedules: generatePhantomSchedule()
    }
}

function generatePhantomSchedule(): Schedule[] {
    const startDate = new Date("2026-02-20");
    const endDate = new Date("2026-06-15");
    const schedule: Schedule[] = [];

    let current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const dateStr = current.toISOString().split('T')[0];
        const dayStr = ["일", "월", "화", "수", "목", "금", "토"][day];

        // Exception: 3/1 No show
        if (current.getMonth() === 2 && current.getDate() === 1) { // Month is 0-indexed (2=March)
            current.setDate(current.getDate() + 1);
            continue;
        }

        let times: TimeSlot[] = [];

        // Exception: 4/12 (Sun) -> 19:30 only
        if (current.getMonth() === 3 && current.getDate() === 12) {
            times.push({ time: "19:30", availableSeats: 50, status: "available" });
        } else {
            // Standard Rules
            if (day === 1) { // Mon: No show
                // pass
            } else if (day === 2 || day === 4) { // Tue, Thu: 19:30
                times.push({ time: "19:30", availableSeats: 50, status: "available" });
            } else if (day === 3 || day === 5) { // Wed, Fri: 14:30, 19:30
                times.push({ time: "14:30", availableSeats: 30, status: "available" });
                times.push({ time: "19:30", availableSeats: 50, status: "available" });
            } else if (day === 6) { // Sat: 14:00, 19:00
                times.push({ time: "14:00", availableSeats: 20, status: "few" });
                times.push({ time: "19:00", availableSeats: 25, status: "available" });
            } else if (day === 0) { // Sun: 15:00
                times.push({ time: "15:00", availableSeats: 40, status: "available" });
            }
        }

        if (times.length > 0) {
            schedule.push({
                date: dateStr,
                dayOfWeek: dayStr,
                times: times
            });
        }

        current.setDate(current.getDate() + 1);
    }
    return schedule;
}

function generateKinkySchedule(): Schedule[] {
    const startDate = new Date("2026-02-10");
    const endDate = new Date("2026-04-30");
    const schedule: Schedule[] = [];

    // Cast Pools
    const charlie = ["김호영", "이석훈", "김성규", "신재범"];
    const lola = ["최재림", "강홍석", "서경수"];
    const lauren = ["김환희", "나하나"];
    const don = ["고창석", "심재현"];
    const nicola = ["이완", "이주원"]; // Example names

    let dayIndex = 0;

    let current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const dateStr = current.toISOString().split('T')[0];
        const dayStr = ["일", "월", "화", "수", "목", "금", "토"][day];

        let times: TimeSlot[] = [];

        // Casting Logic (Round Robin)
        const getCast = (idx: number) => {
            return `찰리:${charlie[idx % charlie.length]}, 롤라:${lola[idx % lola.length]}, 로렌:${lauren[idx % lauren.length]}`;
        };

        if (day === 1) { // Mon: No show
            // pass
        } else if (day === 2 || day === 4 || day === 5) { // Tue, Thu, Fri: 19:30 (Fri also sometimes 14:30 but simplifying)
            times.push({ time: "19:30", availableSeats: 40, status: "available", cast: getCast(dayIndex) });
        } else if (day === 3) { // Wed: 14:30, 19:30
            times.push({ time: "14:30", availableSeats: 25, status: "few", cast: getCast(dayIndex) });
            times.push({ time: "19:30", availableSeats: 45, status: "available", cast: getCast(dayIndex + 1) });
        } else if (day === 6 || day === 0) { // Sat, Sun: 14:00, 19:00
            times.push({ time: "14:00", availableSeats: 10, status: "few", cast: getCast(dayIndex) });
            times.push({ time: "19:00", availableSeats: 30, status: "available", cast: getCast(dayIndex + 1) });
        }

        if (times.length > 0) {
            schedule.push({
                date: dateStr,
                dayOfWeek: dayStr,
                times: times
            });
            dayIndex++;
        }

        current.setDate(current.getDate() + 1);
    }
    return schedule;
}
