// @ts-nocheck
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, PERFORMANCES_TABLE, VENUES_TABLE } from "../dynamodb";

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

export interface Performance {
    id: string;
    performanceId?: string; // DynamoDB use this as PK
    title: string;
    venue?: string; // Legacy
    venueId?: string; // New UI uses this
    description: string;
    dates: string[]; // YYYY-MM-DD
    times: string[]; // HH:mm
    posterUrl?: string; // Legacy
    poster?: string; // New UI uses this
    dateRange?: string; // New UI uses this
    runtime?: string;
    ageLimit?: string;
    price?: string;
    schedules?: Schedule[];
}

export interface SeatInfo {
    grade: string;
    price: number;
}

/**
 * 단일 공연 정보 조회 (DynamoDB Only)
 */
export async function getPerformance(id: string): Promise<Performance | null> {
    try {
        const result = await dynamoDb.send(new GetCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: id }
        }));

        if (!result.Item) {
            console.error(`[PerformanceService] Performance not found: ${id}`);
            return null;
        }

        const perf = result.Item as Performance;
        let venueName = perf.venue || perf.venueId;

        // Fetch venue name from VENUES_TABLE
        try {
            const venueResult = await dynamoDb.send(new GetCommand({
                TableName: VENUES_TABLE,
                Key: { venueId: perf.venueId || 'charlotte-theater' }
            }));
            if (venueResult.Item) {
                venueName = venueResult.Item.name;
            }
        } catch (vError) {
            console.warn(`[PerformanceService] Failed to fetch venue name for ${perf.venueId}`);
        }

        // Temporary Override for Phantom dates as requested
        if (id.includes('phantom')) {
            perf.dates = ["2026-02-20", "2026-05-15"];
            perf.dateRange = "2026.02.20 ~ 2026.05-15";

            // Generate schedules for the new date range (Feb 2026 - May 2026)
            // This is needed for the booking calendar to interactable
            const startDate = new Date("2026-02-20");
            const endDate = new Date("2026-05-15");
            const schedules: Schedule[] = [];

            // Loop day by day
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                // Formatting YYYY-MM-DD
                const dateStr = d.toISOString().split('T')[0];
                const dayNum = d.getDay(); // 0=Sun, 1=Mon...
                const dayMap = ['일', '월', '화', '수', '목', '금', '토'];

                // Skip Mondays (usually theater off-day, assumption)
                if (dayNum === 1) continue;

                // Basic schedule pattern
                // Weekdays (Tue-Fri): 19:30
                // Weekends (Sat-Sun): 14:00, 19:00
                // This is a mock pattern for the Phantom performance
                const times: TimeSlot[] = [];

                if (dayNum === 0 || dayNum === 6) { // Sat, Sun
                    times.push({ time: "14:00", availableSeats: 120, status: "available" });
                    times.push({ time: "19:00", availableSeats: 120, status: "available" });
                } else { // Tue-Fri
                    times.push({ time: "19:30", availableSeats: 120, status: "available" });
                }

                schedules.push({
                    date: dateStr,
                    dayOfWeek: dayMap[dayNum],
                    times: times
                });
            }
            perf.schedules = schedules;
        }

        // DynamoDB uses performanceId as PK, but frontend might expect id
        return {
            ...perf,
            id: perf.performanceId || perf.id,
            venue: venueName, // Ensure human readable name
            posterUrl: perf.posterUrl || perf.poster, // Support both fields
            dates: perf.dates || [], // Ensure dates is an array
            schedules: perf.schedules || []
        };
    } catch (error) {
        console.error(`[PerformanceService] Error fetching performance:`, error);
        throw error; // V6.7 목표: 명확한 에러 throw
    }
}

/**
 * 전체 공연 목록 조회 (DynamoDB Only)
 */
export async function getAllPerformances(): Promise<Performance[]> {
    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: PERFORMANCES_TABLE
        }));

        const items = (result.Items || []) as Performance[];
        return items.map(item => ({
            ...item,
            id: item.performanceId || item.id
        }));
    } catch (error) {
        console.error(`[PerformanceService] Error fetching all performances:`, error);
        return [];
    }
}

export function getSeatInfo(seatId: string): SeatInfo {
    // 새 좌석 ID 형식: "A-1-5" (구역-열-번호)
    const parts = seatId.split('-');

    // 3 parts: "A-1-5" (Section-Row-Number)
    if (parts.length === 3) {
        const [sectionId, rowId, numberStr] = parts;
        const row = parseInt(rowId, 10);

        // 1층 (OP열 - OP석)
        if (sectionId === 'OP') {
            return { grade: 'OP', price: 170000 };
        }

        // 1층 (A, B, C 구역)
        if (['A', 'B', 'C'].includes(sectionId)) {
            if (row <= 10) return { grade: 'VIP', price: 170000 };
            if (row <= 14) return { grade: 'R', price: 140000 };
            if (row <= 17) return { grade: 'S', price: 110000 };
            return { grade: 'A', price: 80000 };
        }

        // 2층 (D, E, F 구역)
        if (['D', 'E', 'F'].includes(sectionId)) {
            if (row <= 5) return { grade: 'R', price: 140000 };
            if (row <= 8) return { grade: 'S', price: 110000 };
            return { grade: 'A', price: 80000 };
        }
    }

    // 4 parts: "1F-A-1-5" (Legacy or explicit format)
    if (parts.length === 4) {
        return { grade: 'R', price: 140000 };
    }

    // Default fallback
    return { grade: 'Standard', price: 80000 };
}
