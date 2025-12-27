import * as fs from 'fs';
import * as path from 'path';
import {
    createHolding,
    confirmReservation,
    releaseHolding,
    releaseHoldingsByUser,
    getSeatStatusMap,
    getUserReservations,
    getHolding,
    cancelReservation
} from './server/holding-manager';
import { Seat, Holding, Reservation } from '@mega-ticket/shared-types';
import { getPerformance, getAllPerformances, getSeatInfo, getSchedule, getVenue } from './server/performance-service';
import { getPerformanceSchedules } from './tools/get-performance-schedules';
import { getSeatGrades } from './tools/get-seat-grades';
import { ToolConfiguration } from '@aws-sdk/client-bedrock-runtime';


// --- Tool Definitions (Schema) ---


export const BEDROCK_TOOLS: ToolConfiguration['tools'] = [
    {
        toolSpec: {
            name: "get_my_reservations",
            description: "현재 로그인한 사용자의 예약 내역을 조회합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        userId: {
                            type: "string",
                            description: "사용자 ID"
                        }
                    },
                    required: ["userId"]
                },
                description: "반환되는 예약 상태(status) 중에 'DR_RECOVERED'가 있으면 '⚠️ 복구됨 - 결제 진행 필요' 상태임을 사용자에게 반드시 알려야 합니다."
            }
        }
    },
    {
        toolSpec: {
            name: "get_performances",
            description: "현재 예매 가능한 모든 공연 목록을 조회합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {},
                }
            }
        }
    },
    {
        toolSpec: {
            name: "get_performance_details",
            description: "특정 공연의 상세 정보(날짜, 장소, 가격, 캐스팅 등)를 조회합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        performanceId: {
                            type: "string",
                            description: "공연 ID"
                        }
                    },
                    required: ["performanceId"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "get_performance_schedules",
            description: `특정 공연의 예매 가능한 일정(회차)을 조회합니다.
  
            ⚠️ 중요: 이 도구는 반드시 schedules 테이블을 조회합니다.
            performances.dates나 performances.times를 사용하지 마세요!
            임의로 일정을 생성하거나 추측하지 마세요!
            
            반환 정보:
            - scheduleId: 회차 ID (예: sch-kinky-20260210-1930)
            - date: 날짜 (예: 2026-02-10)
            - time: 시간 (예: 19:30)
            - dayOfWeek: 요일 (예: 화, 토, 일)
            - availableSeats: 잔여 좌석 수 (예: 1240)
            - status: 상태 (AVAILABLE)
            
            사용 시점:
            - 사용자가 공연 일정을 물을 때
            - "주말에 보고 싶어", "2월 10일 있어?" 같은 질문
            - 좌석 예매 전 회차 선택이 필요할 때`,
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        performanceId: {
                            type: "string",
                            description: `공연 ID. 실제 값:
                            - 킹키부츠: "perf-kinky-1"
                            - 오페라의 유령: "perf-phantom-of-the-opera-1"`
                        },
                        fromDate: {
                            type: "string",
                            description: '조회 시작 날짜 (YYYY-MM-DD). 기본값: 오늘'
                        },
                        preferWeekend: {
                            type: "boolean",
                            description: '주말(토/일) 우선 필터링. 기본값: false'
                        },
                        limit: {
                            type: "number",
                            description: '반환할 일정 수. 기본값: 5'
                        }
                    },
                    required: ["performanceId"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "get_seat_grades",
            description: "해당 공연의 좌석 등급 및 가격 정보를 조회합니다. 회차 선택 후 좌석 등급을 안내할 때 사용합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        performanceId: { type: "string" },
                        scheduleId: { type: "string" }
                    },
                    required: ["performanceId"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "get_available_seats",
            description: `[필수 호출] 좌석 정보를 답변하기 전에 반드시 이 도구를 호출해야 합니다.
            
            ⚠️ 주의사항:
            - 이 도구를 호출하지 않고 좌석 정보를 답변하면 안 됩니다.
            - "매진", "예매 가능", "잔여 좌석" 등을 언급하려면 반드시 먼저 호출하세요.
            - 도구 반환 결과의 availableCount가 0이 아니면 예매 가능합니다.
            
            반환 필드 설명:
            - availableCount: 총 예매 가능 좌석 수 (0이면 매진)
            - summary: 등급별 잔여석 요약
            - recommendedOptions: 추천 좌석 (인원수 맞춤)
            - errorCode: 에러 발생 시 코드 (예: MISSING_COUNT)
            `,
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        performanceId: { type: "string", description: "공연 ID" },
                        scheduleId: { type: "string", description: "회차 ID" },
                        grade: { type: "string", description: "원하는 좌석 등급 (필수 아님, 지정 시 해당 등급만 추천)" },
                        count: { type: "number", description: "관람 인원 수 (최대 4매)" }
                    },
                    required: ["performanceId", "scheduleId", "count"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "get_venue_info",
            description: `공연장 상세 정보와 좌석 배치도를 조회합니다.
            
            추천 시나리오:
            - 좌석 배치도를 보여달라고 할 때
            - 공연장 정보를 물어볼 때
            
            ⚠️ 구역(Section) 정보는 performanceId를 입력해야 정확하게 조회됩니다.`,
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        venueId: {
                            type: "string",
                            description: "공연장 ID 또는 이름",
                        },
                        performanceId: {
                            type: "string",
                            description: "공연 ID (좌석 배치도 조회를 위해 권장)",
                        }
                    },
                    required: [], // Make both optional but encourage performanceId
                }
            }
        }
    },
    {
        toolSpec: {
            name: "hold_seats",
            description: "좌석을 선점(임시 예약)합니다. 이 도구를 호출하면 1분간 좌석이 홀딩됩니다. 결제 전 단계입니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        performanceId: { type: "string", description: "공연 ID" },
                        date: { type: "string", description: "공연 날짜" },
                        time: { type: "string", description: "공연 시간" },
                        seatIds: {
                            type: "array",
                            items: { type: "string" },
                            description: "선점할 좌석 ID 목록 (예: ['1층-B-7-14', '1층-B-7-15'])"
                        },
                        userId: { type: "string", description: "사용자 ID" }
                    },
                    required: ["performanceId", "date", "time", "seatIds", "userId"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "cancel_hold",
            description: "선점된 좌석(Holding)을 즉시 취소합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        holdId: {
                            type: "string",
                            description: "해제할 선점 ID (Holding ID)"
                        }
                    },
                    required: ["holdId"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "confirm_reservation",
            description: "선점된 좌석(Holding)을 확정하여 예약을 완료합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        holdId: {
                            type: "string",
                            description: "좌석 선점 ID (Holding ID)"
                        }
                    },
                    required: ["holdId"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "cancel_reservation",
            description: "예약된 내역(CONFIRMED, DR_RECOVERED)을 취소합니다.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        reservationId: {
                            type: "string",
                            description: "취소할 예약 ID"
                        }
                    },
                    required: ["reservationId"]
                }
            }
        }
    }
];

// --- Tool Execution Logic ---

type ToolInput = any;

export async function executeTool(toolName: string, input: ToolInput): Promise<any> {
    console.log(`[ToolExec] ${toolName} called with:`, JSON.stringify(input));

    try {
        switch (toolName) {
            case "get_my_reservations": // Tool name in spec
            case "get_user_reservations": { // Allow alias
                const { userId } = input;
                const reservations = await getUserReservations(userId);

                if (reservations.length === 0) {
                    return { message: "예약 내역이 없습니다." };
                }

                // [Issue 4] Format reservations for better readability
                // and [V7.9] Handle DR_RECOVERED status
                const formatted = reservations.map(r => {
                    let statusText = r.status;
                    let actions: any[] = [];

                    if (r.status === 'CONFIRMED') statusText = "예약 완료";
                    if (r.status === 'DR_RECOVERED') {
                        statusText = "복구됨 - 결제 진행 필요";
                        actions = [
                            {
                                id: `pay-${r.reservationId}`,
                                label: '결제하기',
                                action: 'confirm_reservation', // Resolves to confirm tool
                                style: 'primary',
                                data: { holdId: r.reservationId } // assuming reservationId can be used as holdId for confirmation or we need a new tool. 
                                // Actually confirm_reservation takes holdId. For DR_RECOVERED, reservationId is likely the recoverd holdId.
                            },
                            {
                                id: `cancel-${r.reservationId}`,
                                label: '취소하기',
                                action: 'cancel_reservation', // Need to ensure this tool exists or use cancel_hold
                                style: 'danger',
                                data: { reservationId: r.reservationId }
                            }
                        ];
                    }
                    if (r.status === 'HOLDING') statusText = "선점 중 (결제 대기)";

                    return {
                        ...r,
                        status: statusText,
                        _actions: actions.length > 0 ? actions : undefined
                    };
                });

                return {
                    success: true,
                    reservations: formatted,
                    message: `총 ${reservations.length}건의 예약 내역이 있습니다.`
                };
            }

            case "get_performances": {
                try {
                    const performances = await getAllPerformances();
                    return {
                        count: performances.length,
                        performances: performances.map(p => ({
                            id: p.id,
                            title: p.title,
                            venue: p.venue,
                            dates: p.dateRange || (Array.isArray(p.dates) ? p.dates.join(', ') : String(p.dates || '날짜 미정')),
                            posterUrl: p.posterUrl
                        })),
                        message: `현재 예매 가능한 공연은 총 ${performances.length}개입니다.`
                    };
                } catch (e: any) {
                    console.error("Error fetching performances:", e);
                    return { error: "공연 목록을 불러오는 중 오류가 발생했습니다." };
                }
            }

            case "get_performance_details": {
                const { performanceId } = input;
                try {
                    const perf = await getPerformance(performanceId);
                    if (!perf) {
                        return { error: "해당 공연을 찾을 수 없습니다." };
                    }
                    // V7.10.2: cast 정보는 DB 스키마에 있을 수 있음 (dynamic field)
                    const perfAny = perf as any;
                    return {
                        id: perf.id,
                        title: perf.title,
                        venue: perf.venue,
                        description: perf.description,
                        dateRange: perf.dateRange || (Array.isArray(perf.dates) ? perf.dates.join(' ~ ') : String(perf.dates || '기간 정보 없음')),
                        schedules: perf.schedules?.slice(0, 5), // Basic fallback
                        price: perf.price,
                        runtime: perf.runtime,
                        ageLimit: perf.ageLimit,
                        // [V7.10.2] 캐스팅 정보 추가 (DB에서 가져온 cast 필드 사용)
                        cast: perfAny.cast || perfAny.casting || [],
                        message: `[${perf.title}] 상세 정보입니다.\n장소: ${perf.venue}\n기간: ${perf.dateRange || '정보 없음'}\n가격: ${perf.price}\n캐스팅: ${Array.isArray(perfAny.cast || perfAny.casting) ? (perfAny.cast || perfAny.casting).join(', ') : '정보 없음'}`
                    };
                } catch (e: any) {
                    return { error: "공연 정보를 불러오는 중 오류가 발생했습니다." };
                }
            }

            case "get_performance_schedules": {
                const { performanceId, fromDate, preferWeekend, limit } = input;
                try {
                    const result = await getPerformanceSchedules({
                        performanceId,
                        fromDate,
                        preferWeekend,
                        limit
                    });

                    if (!result || result.count === 0) {
                        return { message: "조회된 공연 회차 정보가 없습니다." };
                    }
                    return {
                        success: true,
                        count: result.count,
                        hasMore: result.hasMore,
                        schedules: result.schedules,
                        message: `총 ${result.count}개의 공연 일정이 조회되었습니다.`
                    };
                } catch (e: any) {
                    console.error("Error in get_performance_schedules:", e);
                    return { error: "회차 정보를 불러오는 중 오류가 발생했습니다." };
                }
            }

            case "get_seat_grades": {
                return await getSeatGrades(input);
            }

            case "get_venue_info": {
                const { venueId, performanceId } = input;

                // 1. Try to get info from Performance (preferred source for sections/seat map)
                if (performanceId) {
                    try {
                        const perf = await getPerformance(performanceId);
                        if (perf) {
                            // [V7.12] Fetch actual venue data for totalSeats
                            let actualVenue = null;
                            if (perf.venueId) {
                                actualVenue = await getVenue(perf.venueId);
                            }

                            // [V7.12] sections에서 층별 좌석 수 동적 계산 (SSOT)
                            const sections = perf.sections || actualVenue?.sections || [];
                            let floor1Seats = 0;
                            let floor2Seats = 0;
                            sections.forEach((sec: any) => {
                                const floorSeats = (sec.rows || []).reduce((acc: number, row: any) =>
                                    acc + (row.seats?.length || 0), 0);
                                if (sec.floor === '1층') floor1Seats += floorSeats;
                                else floor2Seats += floorSeats;
                            });
                            const calculatedTotal = floor1Seats + floor2Seats;
                            const totalSeats = actualVenue?.totalSeats || calculatedTotal;

                            return {
                                success: true,
                                venue: {
                                    id: perf.venueId || 'unknown',
                                    name: perf.venue || 'Unknown Venue',
                                    totalSeats: totalSeats,
                                    floor1Seats: floor1Seats,
                                    floor2Seats: floor2Seats,
                                    sections: sections
                                },
                                message: `🏛️ **${perf.venue}** 정보입니다.\n• 총 좌석: **${totalSeats.toLocaleString()}석**\n• 1층: ${floor1Seats.toLocaleString()}석\n• 2층: ${floor2Seats.toLocaleString()}석`
                            };
                        }
                    } catch (e) {
                        console.error("Error fetching performance for venue info:", e);
                    }
                }


                // 2. Fallback to Venue DB (Might lack sections now)
                if (venueId) {
                    try {
                        const venue = await getVenue(venueId);
                        if (venue) {
                            return {
                                success: true,
                                venue: venue,
                                message: `${venue.name} 정보입니다. (구역 정보가 없을 수 있습니다)`
                            };
                        }
                    } catch (e) {
                        console.error("Error fetching venue:", e);
                    }
                }

                return {
                    success: false,
                    error: "공연장 정보를 찾을 수 없습니다. performanceId 또는 유효한 venueId를 입력해주세요."
                };
            }

            case "get_available_seats": {
                let { performanceId, date, time, scheduleId, grade: requestedGrade, count } = input;
                const groupSize = count; // map count to existing groupSize logic

                console.log('[SEATS] get_available_seats called:', { performanceId, scheduleId, requestedGrade, count });

                if (!performanceId || !scheduleId) return { error: "공연 ID와 회차 ID가 필요합니다." };

                // [V7.9.3.1] 인원수 방어 로직 (STEP 3 복귀 유도)
                if (!groupSize || groupSize < 1) {
                    return {
                        success: false,
                        errorCode: "MISSING_COUNT",
                        message: "몇 명이서 관람하실 예정인가요? 인원 수를 알려주시면 정확한 좌석을 추천해 드릴 수 있습니다.",
                        nextStep: "STEP_3"
                    };
                }

                // [V7.13] scheduleId에서 date/time 추출
                if (scheduleId && (!date || !time)) {
                    const schedule = await getSchedule(scheduleId);
                    if (schedule) {
                        date = schedule.date;
                        time = schedule.times?.[0]?.time || time;
                    }
                    // scheduleId 파싱 fallback (형식: sch-kinky-20260210-1930)
                    if (!date || !time) {
                        const parts = scheduleId.split('-');
                        if (parts.length >= 4) {
                            const dateStr = parts[2]; // 20260210
                            const timeStr = parts[3]; // 1930
                            if (dateStr && dateStr.length === 8) {
                                date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
                            }
                            if (timeStr && timeStr.length === 4) {
                                time = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
                            }
                        }
                    }
                }

                console.log('[SEATS] Resolved date/time:', { date, time });

                const statusMap = await getSeatStatusMap(performanceId, date, time);


                // [Issue 4] DB Single Source of Truth: Remove hardcoded gradeInfo
                // Initialize gradeInfo structure dynamically
                const gradeInfo: Record<string, { price: number; seats: string[] }> = {};

                // V7.7: Fetch Performance to get sections and seatGrades
                const perf = await getPerformance(performanceId);
                const seatGrades = perf?.seatGrades || [];

                // [V7.13] sections fallback: getPerformance()가 이미 venues.sections를 병합하지만
                // 추가 방어를 위해 빈 경우 venue에서 직접 조회
                let sections = perf?.sections || [];
                if (sections.length === 0 && perf?.venueId) {
                    console.log('[SEATS] sections empty in perf, fetching from venue:', perf.venueId);
                    const venue = await getVenue(perf.venueId);
                    sections = venue?.sections || [];
                }

                console.log('[SEATS] Performance loaded:', {
                    title: perf?.title,
                    sectionsCount: sections.length,
                    gradesCount: seatGrades.length
                });

                const priceMap = new Map<string, number>();
                if (Array.isArray(seatGrades)) {
                    seatGrades.forEach(g => priceMap.set(g.grade, g.price || 0));
                }


                // [V7.13] OP석 활성화 여부 확인
                const hasOPSeats = (perf as any)?.hasOPSeats ?? true;
                console.log('[SEATS] hasOPSeats:', hasOPSeats);

                // seatId -> grade 매핑 및 데이터 분류
                Object.entries(statusMap)
                    .filter(([_, status]) => status === 'available')
                    .forEach(([seatId]) => {
                        // [V7.13] OP열 좌석 필터링 (hasOPSeats=false면 제외)
                        const parts = seatId.split('-');
                        const rowId = parts.length >= 3 ? parts[2] : '';
                        if (rowId === 'OP' && !hasOPSeats) {
                            return; // OP열 제외
                        }

                        const { grade } = getSeatInfo(seatId, sections); // Dynamic Grade
                        const price = priceMap.get(grade) || 0;

                        if (!gradeInfo[grade]) {
                            gradeInfo[grade] = { price, seats: [] };
                        }
                        gradeInfo[grade].seats.push(seatId);
                    });


                // Summary string for Bot
                // Sort roughly by price (desc) if possible, or just standard order
                const standardOrder = ['OP', 'VIP', 'R', 'S', 'A'];
                const sortedGrades = Object.keys(gradeInfo).sort((a, b) => {
                    const idxA = standardOrder.indexOf(a);
                    const idxB = standardOrder.indexOf(b);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    return 0;
                });

                const summary = sortedGrades
                    .map(grade => `${grade}석 ${gradeInfo[grade].price.toLocaleString()}원 (${gradeInfo[grade].seats.length}석)`)
                    .join(', ');

                const totalAvailable = Object.values(gradeInfo).reduce((acc, info) => acc + info.seats.length, 0);

                // [Issue 8] 좌석 표기 방식 개선
                const formatSeatId = (seatId: string): string => {
                    const { grade } = getSeatInfo(seatId, sections);
                    const parts = seatId.split('-');
                    if (parts.length === 4) {
                        // "1층 B구역 VIP석 7열 14번" (대괄호 제거)
                        return `${parts[0]} ${parts[1]}구역 ${grade}석 ${parts[2]}열 ${parts[3]}번`;
                    }
                    return seatId;
                };

                // [Issue 5] N명 연석 추천 로직 개선
                const findConsecutiveSeats = (seats: string[], count: number): string[] => {
                    const seatsByRow: Record<string, string[]> = {};
                    seats.forEach(seatId => {
                        const parts = seatId.split('-');
                        if (parts.length === 4) {
                            const key = `${parts[0]}-${parts[1]}-${parts[2]}`; // 층-구역-열
                            if (!seatsByRow[key]) seatsByRow[key] = [];
                            seatsByRow[key].push(seatId);
                        }
                    });

                    // Sort rows (OP first, then front to back)
                    // Row sorting: OP, 1, 2, 3...
                    const sortedRowKeys = Object.keys(seatsByRow).sort((a, b) => {
                        const rowA = a.split('-')[2];
                        const rowB = b.split('-')[2];
                        // OP row comes first
                        if (rowA === 'OP') return -1;
                        if (rowB === 'OP') return 1;
                        // Then numeric order
                        return parseInt(rowA) - parseInt(rowB);
                    });

                    for (const key of sortedRowKeys) {
                        const rowSeats = seatsByRow[key];
                        // Sort seats in row: 1, 2, 3...
                        const sorted = rowSeats.sort((a, b) => {
                            const numA = parseInt(a.split('-')[3]);
                            const numB = parseInt(b.split('-')[3]);
                            return numA - numB;
                        });

                        for (let i = 0; i <= sorted.length - count; i++) {
                            const segment = sorted.slice(i, i + count);
                            const nums = segment.map(s => parseInt(s.split('-')[3]));

                            // Check consecutiveness
                            let isConsecutive = true;
                            for (let j = 1; j < nums.length; j++) {
                                if (nums[j] !== nums[j - 1] + 1) {
                                    isConsecutive = false;
                                    break;
                                }
                            }
                            if (isConsecutive) {
                                return segment;
                            }
                        }
                    }
                    return [];
                };

                // 등급별 추천 좌석 (요청된 인원 수만큼 연속된 좌석)
                const recommendations: Record<string, Array<{ seats: string[], formatted: string, label: string }>> = {};
                const targetCount = groupSize && groupSize > 0 ? groupSize : 1; // Default to 1

                // [V7.9.3.1] 등급 지정 필터링 적용
                const gradesToRecommend = requestedGrade
                    ? sortedGrades.filter(g => g.toLowerCase() === requestedGrade.toLowerCase())
                    : sortedGrades;

                gradesToRecommend.forEach(grade => {
                    if (gradeInfo[grade].seats.length >= targetCount) {
                        // Try to find continuous seats regarding groupSize
                        // We want multiple options (e.g. Option 1, Option 2, Option 3)
                        // Simple approach: find one best chunk per generic strategy (Center, Front, etc) 
                        // or just find first 3 chunks using slice logic if we slightly modified findConsecutiveSeats to return multiple.

                        // For simplicity, let's just find the *first* valid chunk using strict consecutive logic
                        // If we want multiple, we can search deeper.
                        // Let's reuse findConsecutiveSeats but make it generic or finding multiple?
                        // Writing inline logic for multiple matches:

                        const seats = gradeInfo[grade].seats;
                        const validChunks: string[][] = [];

                        // Copy of logic to find top 3 chunks
                        const seatsByRow: Record<string, string[]> = {};
                        seats.forEach(seatId => {
                            const parts = seatId.split('-');
                            // Only support V7 format here
                            if (parts.length === 4) {
                                const key = `${parts[0]}-${parts[1]}-${parts[2]}`;
                                if (!seatsByRow[key]) seatsByRow[key] = [];
                                seatsByRow[key].push(seatId);
                            }
                        });

                        // Sort rows by preference (VIP/R: Front->Back, Center->Side is hard without section preference knowledge, 
                        // but generally Front row is better)
                        const sortedRowKeys = Object.keys(seatsByRow).sort((a, b) => {
                            // Simple row number sort
                            const rowA = parseInt(a.split('-')[2]);
                            const rowB = parseInt(b.split('-')[2]);
                            return rowA - rowB;
                        });

                        let foundCount = 0;
                        for (const key of sortedRowKeys) {
                            if (foundCount >= 3) break;

                            const rowSeats = seatsByRow[key];
                            const sorted = rowSeats.sort((a, b) => parseInt(a.split('-')[3]) - parseInt(b.split('-')[3]));

                            for (let i = 0; i <= sorted.length - targetCount; i++) {
                                const chunk = sorted.slice(i, i + targetCount);
                                const nums = chunk.map(s => parseInt(s.split('-')[3]));
                                let isConsecutive = true;
                                for (let j = 1; j < nums.length; j++) {
                                    if (nums[j] !== nums[j - 1] + 1) { isConsecutive = false; break; }
                                }
                                if (isConsecutive) {
                                    validChunks.push(chunk);
                                    foundCount++;
                                    // Skip overlapping chunks (e.g. 1-2, 2-3) -> logic: jump i by count? 
                                    // Better to suggest distinct options.
                                    i += targetCount - 1;
                                }
                                if (foundCount >= 3) break;
                            }
                        }

                        if (validChunks.length > 0) {
                            recommendations[grade] = validChunks.map((chunk, idx) => {
                                const first = chunk[0];
                                const parts = first.split('-'); // 1층-B-7-14
                                const rowId = parseInt(parts[2]);
                                const seatNums = chunk.map(s => s.split('-')[3]).join('~');

                                // 상세 위치 정보 생성 (V7.9.3.2 고도화)
                                let positionNote = "";
                                if (rowId <= 5) positionNote = "무대와 매우 가까운 앞쪽";
                                else if (rowId <= 10) positionNote = "시야가 좋은 중간 쪽";
                                else positionNote = "전체적인 무대 감상이 좋은 뒤쪽";

                                let blockNote = "";
                                if (parts[1] === 'B') {
                                    blockNote = "정중앙 블록(B)으로 무대 정면 시야가 매우 우수하며 내부석이라 집중도가 높습니다";
                                } else if (parts[1] === 'A') {
                                    blockNote = "좌측 블록(A)이며 사이드 통로와 가까워 이동이 편리하고 무대 측면 시야를 제공합니다";
                                } else {
                                    blockNote = "우측 블록(C)이며 사이드 통로와 가까워 이동이 편리하고 무대 측면 시야를 제공합니다";
                                }

                                const label = `${parts[0]} ${parts[1]}구역 ${grade}석 ${parts[2]}열 ${seatNums}번`;
                                const description = `📍 ${positionNote}, ${blockNote}`;

                                // [V7.9.3.1] formatted 에 "연석" 정보 명시 및 가독성 강화
                                const formatted = `🎫 ${label} (인원: ${targetCount}명 연석)\n   └ ${description}`;

                                return {
                                    seats: chunk,
                                    label,
                                    description,
                                    formatted: formatted
                                };
                            });
                        }
                    }
                });

                // Prepare Response
                const responseMessage = requestedGrade
                    ? `요청하신 ${requestedGrade}석 잔여 현황입니다:\n${summary}`
                    : `현재 잔여석 현황입니다:\n${summary}`;

                return {
                    totalAvailable,
                    summary,
                    details: Object.fromEntries(
                        Object.entries(gradeInfo).map(([grade, info]) => [grade, {
                            count: info.seats.length,
                            price: info.price,
                            formattedPrice: `${info.price.toLocaleString()}원`
                        }])
                    ),
                    recommendedOptions: recommendations,
                    message: `${responseMessage}\n\n[추천 좌석 (인원: ${targetCount}명)]\n${Object.values(recommendations).flat().map(r => r.formatted).join('\n')}\n\n총 ${totalAvailable}석 예약 가능합니다.`,
                    // [V7.12] STEP 6 버튼 - '다른 좌석 보기' 추가
                    _actions: [
                        {
                            id: 'hold_yes',
                            label: '좌석 선점',
                            type: 'message',
                            text: '네, 선점해주세요',
                            style: 'primary'
                        },
                        {
                            id: 'other_seats',
                            label: '다른 좌석 보기',
                            type: 'message',
                            text: '다른 좌석 보여줘',
                            style: 'secondary'
                        },
                        {
                            id: 'cancel_flow',
                            label: '취소',
                            type: 'message',
                            text: '취소할래',
                            style: 'danger'
                        }
                    ]
                };
            }

            case "hold_seats": // V7.2 이름 변경
            case "create_holding": { // 호환성 유지
                const { performanceId, date, time, seatIds, seats, userId } = input;
                const targetSeats = seatIds || seats; // seatIds(V7.2) or seats(Old)

                if (!targetSeats || !Array.isArray(targetSeats)) {
                    return { error: "Invalid seat selection. Please provide a list of seat IDs." };
                }

                // V7.7: Fetch Performance first to get sections and grades
                let perf = null;
                try {
                    perf = await getPerformance(performanceId);
                } catch (e) {
                    console.error("Failed to fetch performance:", e);
                }
                const sections = perf?.sections || [];
                const seatGrades = perf?.seatGrades || [];

                // V7.4 Optimization: Pre-calculate grades to fetch prices in batch
                const mappedInputs = targetSeats.map((id: string) => {
                    const parts = id.split('-');
                    const { grade } = getSeatInfo(id, sections); // Use dynamic sections
                    return { id, parts, grade };
                });

                // Fetch grades once
                let priceMap = new Map();
                if (seatGrades && Array.isArray(seatGrades)) {
                    priceMap = new Map(seatGrades.map((g: any) => [g.grade, g.price]));
                }

                const seatObjects: Seat[] = mappedInputs.map((item: any) => {
                    const { id, parts, grade } = item;
                    const { price: defaultPrice } = getSeatInfo(id, sections); // fallback 0
                    const price = priceMap.get(grade) || defaultPrice || 0;

                    if (parts.length === 4) {
                        // 새 형식: 1층-B-OP-14 또는 1층-B-2-11
                        const [floor, section, row, seatNum] = parts;
                        return {
                            seatId: id,
                            seatNumber: parseInt(seatNum),
                            number: parseInt(seatNum),
                            rowId: row,
                            row: row,
                            grade: grade,
                            price: price,
                            status: 'holding'
                        };
                    } else {
                        // 구 형식: A-5
                        const [row, numStr] = parts;
                        return {
                            seatId: id,
                            seatNumber: parseInt(numStr),
                            number: parseInt(numStr),
                            rowId: row,
                            row: row,
                            grade: grade,
                            price: price, // Use fetched price
                            status: 'holding'
                        };
                    }
                });

                // Use the input userId directly if provided. This is critical for connecting Chatbot reservations to My Page (mock-user-01).
                // Only fallback if no user ID is provided.
                const targetUserId = userId || 'mock-user-01';

                // [Fix] Auto-release any existing holdings for this user before creating a new one.
                const releasedIds = await releaseHoldingsByUser(targetUserId);

                // [Robustness] Wait briefly to ensure file system sync and state propagation
                await new Promise(resolve => setTimeout(resolve, 500));

                const result = await createHolding(performanceId, seatObjects, targetUserId, date, time);

                if (!result.success) {
                    console.log('[HOLDING] Failed:', { error: result.error, unavailable: result.unavailableSeats });
                    return {
                        success: false,
                        error: result.error || "좌석 선점에 실패했습니다.",
                        message: `죄송합니다. ${result.unavailableSeats?.join(', ') || '선택하신 좌석'}이(가) 이미 선점 또는 예약 중입니다. 다른 좌석을 선택해주세요.`,
                        unavailableSeats: result.unavailableSeats,
                        releasedHoldings: releasedIds,
                        _actions: [
                            {
                                id: 'retry_seats',
                                label: '다른 좌석 선택',
                                type: 'message',
                                text: '다른 좌석 보여줘',
                                style: 'primary'
                            }
                        ]
                    };
                }

                // 만료 시간: 1분 후
                const expiresAt = result.expiresAt || new Date(Date.now() + 60 * 1000).toISOString();

                // [Issue 7] Verify _actions presence (Button logic)
                return {
                    success: true,
                    holdingId: result.holdingId,
                    expiresAt: expiresAt,
                    releasedHoldings: releasedIds,
                    seatMapUrl: `/performances/${performanceId}/seats?date=${date}&time=${time}`,
                    message: `좌석이 선점되었습니다. 1분 내에 확정해주세요.`,

                    // V7.2 Interactive Metadata
                    _timer: {
                        duration: 60,
                        expiresAt: expiresAt
                    },
                    _actions: [
                        {
                            id: 'confirm',
                            label: '예약 확정',
                            type: 'message',
                            text: '예약 확정해줘',
                            style: 'primary',
                            data: { holdId: result.holdingId, seatIds: targetSeats }
                        },
                        {
                            id: 'cancel',
                            label: '선점 취소',
                            type: 'message',
                            text: '선점 취소할래',
                            style: 'danger',
                            data: { holdId: result.holdingId }
                        },
                        {
                            id: 'view',
                            label: '좌석 배치도',
                            action: 'view_held_seats',
                            style: 'secondary',
                            data: { performanceId, date, time }
                        }
                    ],
                };
            }

            case "cancel_hold": // V7.2
            case "release_holding": {
                const { holdingId, holdId } = input;
                const targetId = holdId || holdingId;

                if (!targetId || typeof targetId !== 'string') {
                    return { success: false, error: "Invalid holding ID" };
                }

                const result = await releaseHolding(targetId);

                if (result) {
                    return {
                        success: true,
                        holdingId: targetId,
                        message: "좌석 선점이 정상적으로 해제되었습니다."
                    };
                } else {
                    return {
                        success: false,
                        holdingId: targetId,
                        message: "선점 ID를 찾을 수 없거나 이미 해제되었습니다."
                    };
                }
            }

            case "confirm_reservation": {
                const { holdingId, holdId } = input;
                const targetId = holdId || holdingId;
                if (!targetId || typeof targetId !== 'string') {
                    return { success: false, error: "선점 ID가 유효하지 않습니다." };
                }

                // getHolding is async
                const holding = await getHolding(targetId);
                if (!holding) {
                    return { success: false, error: "선점 정보를 찾을 수 없습니다." };
                }

                const perf = await getPerformance(holding.performanceId);
                const title = perf ? perf.title : "알 수 없는 공연";
                const venue = perf ? perf.venue : "알 수 없는 공연장";
                const posterUrl = perf ? (perf.posterUrl || perf.poster || "") : "";

                // confirmReservation is async
                const result = await confirmReservation(
                    targetId,
                    title || "공연 예약",
                    venue || "메가티켓 공연장",
                    posterUrl || ""
                );

                if (!result.success) {
                    return { success: false, error: result.error };
                }

                // [V7.12] N명 좌석 정보 상세 포맷팅
                const seats = holding.seats || [];
                const seatDetails = seats.map((seat: any) => {
                    const seatId = seat.seatId || '';
                    const parts = seatId.split('-');
                    if (parts.length === 4) {
                        const [floor, section, row, num] = parts;
                        const grade = seat.grade || '';
                        return `${floor} ${section}구역 ${grade}석 ${row}열 ${num}번`;
                    }
                    return seatId;
                }).join('\n');

                const totalPrice = seats.reduce((sum: number, s: any) => sum + (s.price || 0), 0);
                const formattedPrice = totalPrice.toLocaleString();

                // 날짜 포맷팅
                const date = holding.date || '';
                const time = holding.time || '';
                let formattedDate = date;
                if (date) {
                    try {
                        const d = new Date(date);
                        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                        formattedDate = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
                    } catch (e) { }
                }

                const message = `✅ 예약이 완료되었습니다!

🎭 ${title}
📅 ${formattedDate} ${time.includes(':') ? (parseInt(time.split(':')[0]) < 12 ? '오전' : '오후') : ''} ${time}
📍 ${venue}

🎟️ 좌석정보:
${seatDetails}

💰 결제 금액: ${formattedPrice}원

감사합니다! 즐거운 관람 되세요 🎭`;

                return {
                    success: true,
                    reservationId: result.reservation?.id || "",
                    message: message,

                    // [V7.11] 예약 확정 후 버튼 - 예약 내역보기, 선점 취소, 새 예약하기
                    _actions: [
                        {
                            id: 'view_res',
                            label: '예약 내역보기',
                            action: 'navigate',
                            url: `/my?region=${process.env.AWS_REGION || 'ap-northeast-2'}`,
                            style: 'primary'
                        },
                        {
                            id: 'cancel_res',
                            label: '예약 취소',
                            type: 'message',
                            text: '예약 취소해줘',
                            style: 'danger'
                        },
                        {
                            id: 'new_res',
                            label: '새 예약하기',
                            type: 'message',
                            text: '다른 공연 예매하고 싶어',
                            style: 'secondary'
                        }
                    ]
                };
            }

            case "cancel_reservation": {
                const { reservationId } = input;
                if (!reservationId) return { error: "예약 ID가 필요합니다." };

                const success = await cancelReservation(reservationId);
                if (success) {
                    return {
                        success: true,
                        message: "예약이 정상적으로 취소되었습니다."
                    };
                } else {
                    return {
                        success: false,
                        error: "예약 취소 실패: ID를 찾을 수 없거나 이미 취소되었습니다."
                    };
                }
            }

            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    } catch (e: any) {
        return { error: e.message || "Internal Tool Error" };
    }
}

// --- Helper Functions ---

function getGradeDistribution(venueData: any): string {
    const distribution: Record<string, Record<string, number[]>> = {};

    venueData.sections?.forEach((section: any) => {
        const floor = section.floor || "";
        const sectionName = section.sectionName || "";
        const locationKey = `${floor} ${sectionName}`.trim();

        section.rows?.forEach((row: any) => {
            const grade = row.grade || "Unknown";
            let rowNum = -1;
            try {
                rowNum = parseInt(row.rowId);
            } catch (e) {
                if (row.rowId === 'OP') rowNum = 0;
            }

            if (!distribution[grade]) distribution[grade] = {};
            if (!distribution[grade][locationKey]) distribution[grade][locationKey] = [];

            if (rowNum !== -1) {
                if (!distribution[grade][locationKey].includes(rowNum)) {
                    distribution[grade][locationKey].push(rowNum);
                }
            }
        });
    });

    let output = "[좌석 등급 분포]\n";
    const gradeOrder = ['VIP', 'R', 'S', 'A', 'OP'];

    for (const grade of gradeOrder) {
        if (!distribution[grade]) continue;

        const parts: string[] = [];
        const sortedLocations = Object.keys(distribution[grade]).sort();

        for (const location of sortedLocations) {
            const rows = distribution[grade][location].sort((a, b) => a - b);
            if (rows.length === 0) continue;

            const ranges: string[] = [];
            let start = rows[0];
            let prev = rows[0];

            for (let i = 1; i < rows.length; i++) {
                if (rows[i] === prev + 1) {
                    prev = rows[i];
                } else {
                    ranges.push(start === prev ? (start === 0 ? 'OP열' : `${start}열`) : (start === 0 ? 'OP열' : `${start}~${prev}열`));
                    start = rows[i];
                    prev = rows[i];
                }
            }
            ranges.push(start === prev ? (start === 0 ? 'OP열' : `${start}열`) : (start === 0 ? 'OP열' : `${start}~${prev}열`));

            parts.push(`${location} ${ranges.join(', ')}`);
        }
        if (parts.length > 0) {
            output += `- ${grade}석: ${parts.join(', ')}\n`;
        }
    }
    return output;
}
