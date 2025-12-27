// @ts-nocheck
import { GetCommand, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, PERFORMANCES_TABLE, VENUES_TABLE, SCHEDULES_TABLE } from "../dynamodb";

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

class SimpleCache {
    private cache = new Map<string, CacheEntry<any>>();
    private defaultTTL = parseInt(process.env.CACHE_TTL_MS || '604800000'); // 7일

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttl?: number): void {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + (ttl || this.defaultTTL)
        });
    }

    clear(): void {
        this.cache.clear();
    }
}

export const performanceCache = new SimpleCache();

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
    performanceId?: string;
    title: string;
    venue?: string;
    venueId?: string;
    description: string;
    dates: string[];
    times: string[];
    posterUrl?: string;
    poster?: string;
    dateRange?: string;
    runtime?: string;
    ageLimit?: string;
    price?: string;
    schedules?: Schedule[];
    seatGrades?: { grade: string; price?: number; color?: string; description?: string }[];
    seatColors?: Record<string, string>;
    sections?: any[];
    gradeMapping?: Record<string, string[]>;
    cast?: string[];  // [V7.11] 캐스팅 정보
}

export interface SeatInfo {
    grade: string;
    price: number;
}

/**
 * 단일 공연 정보 조회
 */
export async function getPerformance(id: string): Promise<Performance | null> {
    const cacheKey = `v84:perf:${id}`;
    const cached = performanceCache.get<Performance>(cacheKey);
    if (cached) return cached;

    try {
        const result = await dynamoDb.send(new GetCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: id }
        }));

        if (!result.Item) return null;

        const perf = result.Item as Performance;
        const venueName = perf.venue || perf.venueId || '알 수 없는 공연장';
        let sections = perf.sections || [];
        let seatGrades = perf.seatGrades || [];

        // [V7.12] Canonical grade helper (e.g., "VIP석" -> "VIP")
        const getBaseGrade = (g: string) => {
            if (!g) return g;
            return String(g).trim().replace(/석+$/, '');
        };

        // [V7.13] Parse price string: "VIP/OP석 170,000원 / R석 140,000원"
        const priceMap: Record<string, number> = {};
        if (perf.price && typeof perf.price === 'string') {
            const parts = perf.price.split(' / ');
            parts.forEach(part => {
                const match = part.match(/^(.+?)\s+([\d,]+)/);
                if (match) {
                    const rawGrade = match[1].trim();
                    const priceVal = parseInt(match[2].replace(/,/g, ''), 10);

                    if (rawGrade.includes('/')) {
                        rawGrade.split('/').forEach(sub => {
                            const base = getBaseGrade(sub);
                            priceMap[base] = priceVal;
                            priceMap[base + '석'] = priceVal;
                        });
                    } else {
                        const base = getBaseGrade(rawGrade);
                        priceMap[base] = priceVal;
                        priceMap[base + '석'] = priceVal;
                    }
                }
            });
        }

        // 1. Normalize seatGrades (Use BASE names like "VIP")
        seatGrades = seatGrades.map((g: any) => {
            const baseName = getBaseGrade(g.grade);
            return {
                ...g,
                grade: baseName,
                price: g.price || priceMap[baseName] || 0
            };
        });

        // 2. Normalize seatColors
        const seatColors: Record<string, string> = {};
        if (perf.seatColors) {
            Object.entries(perf.seatColors).forEach(([k, v]) => {
                seatColors[getBaseGrade(k)] = v as string;
            });
        }

        // [V7.14] V7.8 Dynamic Merge Engine: Venue Structure + Grade Mapping
        let mergedSections = [];

        if (perf.venueId) {
            const venue = await getVenue(perf.venueId);
            if (venue && venue.sections) {
                const mapping = perf.gradeMapping || {};

                // Reverse mapping for O(1) row lookup: RowID -> Grade
                const rowToGrade: Record<string, string> = {};
                Object.entries(mapping).forEach(([grade, rowIds]) => {
                    if (Array.isArray(rowIds)) {
                        rowIds.forEach(rid => {
                            rowToGrade[rid] = grade;
                        });
                    }
                });

                mergedSections = venue.sections.map((section: any) => {
                    const sid = section.sectionId;
                    return {
                        ...section,
                        rows: (section.rows || []).map((row: any) => {
                            const rid = row.rowId;
                            const rowKey = `${sid}-${rid}`;

                            // 1. Determine Row Grade from Mapping
                            let rowGrade = rowToGrade[rowKey] || row.grade || 'Standard';

                            // 2. Special Logic: OP/VIP Split if needed
                            if (rowGrade === 'OP/VIP') {
                                rowGrade = rid === 'OP' ? 'OP' : 'VIP';
                            }

                            // 3. Inject Grade into Row and all its Seats
                            return {
                                ...row,
                                grade: rowGrade,
                                seats: (row.seats || []).map((seat: any) => ({
                                    ...seat,
                                    grade: rowGrade // Standardize seat grade with row grade
                                }))
                            };
                        })
                    };
                });
            }
        }

        // Fallback for legacy data or if venue not found
        if (mergedSections.length === 0 && sections.length > 0) {
            mergedSections = sections.map((section: any) => ({
                ...section,
                rows: (section.rows || []).map((row: any) => {
                    const rawRowGrade = row.grade || (row.seats && row.seats[0]?.grade);
                    const rowBaseGrade = getBaseGrade(rawRowGrade);
                    let finalGrade = rowBaseGrade;
                    if (rowBaseGrade === 'OP/VIP') {
                        finalGrade = row.rowId === 'OP' ? 'OP' : 'VIP';
                    }
                    return {
                        ...row,
                        grade: finalGrade,
                        seats: (row.seats || []).map((seat: any) => ({
                            ...seat,
                            grade: getBaseGrade(seat.grade)
                        }))
                    };
                })
            }));
        }

        const schedules = await getPerformanceSchedules(id);

        const data = {
            ...perf,
            id: perf.performanceId || perf.id,
            venue: venueName,
            posterUrl: perf.posterUrl || perf.poster,
            dates: perf.dates || [],
            schedules: schedules,
            sections: mergedSections,
            seatGrades: seatGrades,
            seatColors: seatColors,
            cast: (perf as any).cast || []  // [V7.11] 캐스팅 정보 포함
        };

        performanceCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`[PerformanceService] Error fetching performance ${id}:`, error);
        throw error;
    }
}

/**
 * 전체 공연 목록 조회
 */
export async function getAllPerformances(): Promise<Performance[]> {
    const cacheKey = `v84:perfs:all`;
    const cached = performanceCache.get<Performance[]>(cacheKey);
    if (cached) return cached;

    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: PERFORMANCES_TABLE
        }));

        const items = (result.Items || []) as Performance[];
        const data = items.map(item => ({
            ...item,
            id: item.performanceId || item.id
        }));

        performanceCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`[PerformanceService] Error fetching all performances:`, error);
        return [];
    }
}

/**
 * 공연 스케줄 목록 조회
 */
export async function getPerformanceSchedules(performanceId: string): Promise<Schedule[]> {
    const cacheKey = `v81:schedules:${performanceId}`;
    const cached = performanceCache.get<Schedule[]>(cacheKey);
    if (cached) return cached;

    try {
        const result = await dynamoDb.send(new QueryCommand({
            TableName: SCHEDULES_TABLE,
            IndexName: "performanceId-datetime-index",
            KeyConditionExpression: "performanceId = :pid",
            ExpressionAttributeValues: { ":pid": performanceId }
        }));

        if (!result.Items || result.Items.length === 0) return [];

        const grouped: Record<string, Schedule> = {};
        result.Items.forEach((item: any) => {
            const date = item.date;
            if (!grouped[date]) {
                grouped[date] = {
                    date: date,
                    dayOfWeek: item.dayOfWeek,
                    times: []
                };
            }
            grouped[date].times.push({
                time: item.time,
                availableSeats: item.availableSeats,
                status: item.availableSeats > 0 ? 'available' : 'soldout',
                cast: item.casting
            });
        });

        const data = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
        performanceCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`[PerformanceService] Error fetching schedules for ${performanceId}:`, error);
        return [];
    }
}

/**
 * 단일 스케줄 조회
 */
export async function getSchedule(scheduleId: string): Promise<Schedule | null> {
    const cacheKey = `v81:schedule:${scheduleId}`;
    const cached = performanceCache.get<Schedule>(cacheKey);
    if (cached) return cached;

    try {
        const result = await dynamoDb.send(new GetCommand({
            TableName: SCHEDULES_TABLE,
            Key: { scheduleId: scheduleId }
        }));

        if (!result.Item) return null;

        const item = result.Item;
        const data = {
            date: item.date,
            dayOfWeek: item.dayOfWeek,
            times: [{
                time: item.time,
                availableSeats: item.availableSeats,
                status: item.availableSeats > 0 ? 'available' : 'soldout',
                cast: item.casting
            }]
        };

        performanceCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`[PerformanceService] Error fetching schedule ${scheduleId}:`, error);
        return null;
    }
}

export function getSeatInfo(seatId: string, sections: any[] = []): SeatInfo {
    const parts = seatId.split('-');
    let sectionId = '', rowId = '';

    if (parts.length === 3) [sectionId, rowId] = parts;
    else if (parts.length === 4) [, sectionId, rowId] = parts;
    else return { grade: 'Standard', price: 0 };

    if (sections && sections.length > 0) {
        const matchedSection = sections.find(s => (s.sectionId || s.id) === sectionId);
        if (matchedSection) {
            if (Array.isArray(matchedSection.rows) && matchedSection.rows.length > 0 && typeof matchedSection.rows[0] === 'object') {
                const matchedRow = matchedSection.rows.find((r: any) => String(r.rowId) === String(rowId));
                if (matchedRow) return { grade: matchedRow.grade || 'Standard', price: 0 };
            }
            if (Array.isArray(matchedSection.rows) && matchedSection.rows.length === 2 && typeof matchedSection.rows[0] === 'number') {
                const rowNum = parseInt(rowId, 10);
                if (!isNaN(rowNum)) {
                    const [start, end] = matchedSection.rows;
                    if (rowNum >= start && rowNum <= end) return { grade: matchedSection.grade, price: 0 };
                }
            }
            if ((!matchedSection.rows || matchedSection.rows.length === 0) && matchedSection.grade) {
                return { grade: matchedSection.grade, price: 0 };
            }
        }
    }
    return { grade: 'Standard', price: 0 };
}

export async function getSeatGrades(performanceId: string): Promise<{ grade: string; price: number; color: string; description: string }[]> {
    const performance = await getPerformance(performanceId);
    if (performance?.seatGrades && performance.seatGrades.length > 0) {
        return performance.seatGrades.map(g => ({
            grade: g.grade,
            price: g.price || 0,
            color: g.color || '#808080',
            description: g.description || ''
        }));
    }
    return [];
}

export async function isValidGrade(performanceId: string, grade: string): Promise<boolean> {
    const seatGrades = await getSeatGrades(performanceId);
    return seatGrades.some(g => g.grade === grade);
}

export async function getGradePrice(performanceId: string, grade: string): Promise<number | null> {
    const seatGrades = await getSeatGrades(performanceId);
    const found = seatGrades.find(g => g.grade === grade);
    return found?.price || null;
}

export async function getVenue(venueId: string) {
    const cacheKey = `v81:venue:${venueId}`;
    const cached = performanceCache.get<any>(cacheKey);
    if (cached) return cached;

    try {
        const result = await dynamoDb.send(new GetCommand({
            TableName: VENUES_TABLE,
            Key: { venueId }
        }));
        const data = result.Item || null;
        if (data) performanceCache.set(cacheKey, data);
        return data;
    } catch (e) {
        console.error(`[PerformanceService] Error fetching venue ${venueId}:`, e);
        return null;
    }
}
