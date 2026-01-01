
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, SCHEDULES_TABLE } from "../dynamodb";

interface GetSchedulesParams {
    performanceId: string;
    fromDate?: string;      // 기본값: 오늘
    preferWeekend?: boolean; // 주말 우선
    limit?: number;         // 기본값: 5
}

export async function getPerformanceSchedules(params: GetSchedulesParams) {
    // Use locally imported table name or fallback to environment (handled in dynamodb.ts)
    const TABLE_NAME = SCHEDULES_TABLE;
    const INDEX_NAME = 'performanceId-index';

    const fromDate = params.fromDate || new Date().toISOString().split('T')[0];
    const limit = Math.min(params.limit || 5, 5); // [V7.9.3.2] Strictly cap at 5
    const fromDatetime = `${fromDate}T00:00:00`;

    let schedules: any[] = [];

    try {
        // ✅ 새로운 schedules 테이블 조회
        const result = await dynamoDb.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: 'performanceId = :pid AND #dt >= :fromDatetime',
            FilterExpression: '#status = :available',
            ExpressionAttributeNames: {
                '#dt': 'datetime',
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':pid': params.performanceId,
                ':fromDatetime': fromDatetime,
                ':available': 'AVAILABLE',
            },
            Limit: limit * 2,  // 필터링 여유분
            ScanIndexForward: true,  // 오름차순 (가까운 날짜부터)
        }));

        schedules = result.Items || [];
    } catch (e: any) {
        console.warn(`[getPerformanceSchedules] Query failed, trying scan fallback: ${e.message}`);

        // GSI가 없으면 Scan + FilterExpression 사용
        try {
            const result = await dynamoDb.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: 'performanceId = :pid AND #dt >= :fromDatetime AND #status = :available',
                ExpressionAttributeNames: {
                    '#dt': 'datetime',
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':pid': params.performanceId,
                    ':fromDatetime': fromDatetime,
                    ':available': 'AVAILABLE',
                },
            }));

            // Scan 결과는 정렬되지 않으므로 수동 정렬 필요
            schedules = (result.Items || []).sort((a: any, b: any) => a.datetime.localeCompare(b.datetime));
        } catch (scanError) {
            console.error(`[getPerformanceSchedules] Scan also failed:`, scanError);
            throw scanError;
        }
    }

    // 주말 우선 필터링 (토/일)
    if (params.preferWeekend) {
        const weekendSchedules = schedules.filter(s =>
            ['토', '일'].includes(s.dayOfWeek)
        );
        // 주말이 있으면 주말만, 없으면 전체
        if (weekendSchedules.length > 0) {
            schedules = weekendSchedules;
        }
    }

    // 반환 형식
    return {
        schedules: schedules.slice(0, limit).map(s => {
            const hour = parseInt(s.time.split(':')[0]);
            let timeLabel = '🎭';
            if (hour >= 10 && hour < 15) timeLabel = '☀️ 마티네';
            else if (hour >= 17 && hour <= 21) timeLabel = '🌙 소야';

            const [year, month, day] = s.date.split('-');
            const formattedDate = `${year}년 ${parseInt(month)}월 ${parseInt(day)}일 (${s.dayOfWeek})`;

            return {
                scheduleId: s.scheduleId,        // perf-kinky-1-2026-02-10-19:30
                performanceId: s.performanceId,  // perf-kinky-1
                date: s.date,                    // 2026-02-10
                formattedDate,                   // [V7.10] 2026년 2월 10일 (화)
                time: s.time,                    // 19:30
                timeLabel,                       // [V7.10] 🌙 소야
                datetime: s.datetime,            // 2026-02-10T19:30:00
                dayOfWeek: s.dayOfWeek,          // 화
                status: s.status,                // AVAILABLE
                availableSeats: s.availableSeats, // 1240
                totalSeats: s.totalSeats,        // 1240
            };
        }),
        count: schedules.length,
        hasMore: schedules.length > limit,
    };
}
