// @ts-nocheck
import { randomUUID } from 'crypto';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Seat, Holding, Reservation } from '@mega-ticket/shared-types';
import { dynamoDb, RESERVATIONS_TABLE, VENUES_TABLE, createPK, createSK } from "../dynamodb";
import { getPerformance } from './performance-service';

// V7.19: DR 복구 시작 시간 (서버 프로세스 시작 시 한 번만 설정)
// 이 값은 서버가 재시작될 때만 갱신되며, 새로고침으로는 변경되지 않음
const DR_RECOVERY_START_TIMESTAMP: Date | null = process.env.DR_RECOVERY_MODE === 'true' && process.env.DR_RECOVERY_START_TIME
    ? new Date(process.env.DR_RECOVERY_START_TIME)
    : (process.env.DR_RECOVERY_MODE === 'true' ? new Date() : null);

if (DR_RECOVERY_START_TIMESTAMP) {
    console.log(`[DR] Recovery start time set to: ${DR_RECOVERY_START_TIMESTAMP.toISOString()}`);
}

/**
 * 2. Check if seats are available (DynamoDB Only)
 */
export async function areSeatsAvailable(performanceId: string, seatIds: string[], date: string, time: string): Promise<{ available: boolean; conflicts: string[] }> {
    const pk = createPK(performanceId, date, time);
    const conflicts: string[] = [];
    const now = new Date().toISOString(); // [V7.10.3] 현재 시간 for 만료 체크

    try {
        // Query all seats for this slot
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": pk
            }
        }));

        const existingItems = result.Items || [];

        // [V7.10.3] 만료된 HOLDING 제외, CONFIRMED만 실제 충돌로 처리
        const occupiedSeatIds = new Set(
            existingItems
                .filter(item => {
                    // CONFIRMED는 항상 충돌
                    if (item.status === 'CONFIRMED') return true;
                    // HOLDING/DR_RECOVERED는 만료 체크
                    if (item.status === 'HOLDING' || item.status === 'DR_RECOVERED') {
                        const expiresAt = item.expiresAt;
                        if (expiresAt && expiresAt < now) {
                            return false; // 만료됨 - 사용 가능
                        }
                        return true; // 아직 유효함 - 충돌
                    }
                    return false;
                })
                .map(item => item.SK.replace('SEAT#', ''))
        );

        seatIds.forEach(id => {
            if (occupiedSeatIds.has(id)) {
                conflicts.push(id);
            }
        });

        return {
            available: conflicts.length === 0,
            conflicts
        };
    } catch (error) {
        console.error(`[HoldingManager] Error checking seat availability:`, error);
        throw error;
    }
}

/**
 * 3. Create a new holding (DynamoDB Only)
 * V7.20: venue, performanceTitle, posterUrl 파라미터 추가 (비정규화)
 */
export async function createHolding(
    performanceId: string,
    seats: Seat[],
    userId: string,
    date: string,
    time: string,
    venue?: string,           // V7.18: 비정규화 필드
    performanceTitle?: string, // V7.18: 비정규화 필드
    posterUrl?: string        // V7.20: 비정규화 필드
): Promise<{ success: boolean; holdingId?: string; error?: string; expiresAt?: string; expiresAtText?: string; remainingSeconds?: number; unavailableSeats?: string[] }> {

    const pk = createPK(performanceId, date, time);
    const holdingId = randomUUID();
    const now = new Date();
    // V7.22: 10분 TTL (600초)
    const HOLDING_TTL_SECONDS = 600;
    const expiresAt = new Date(now.getTime() + HOLDING_TTL_SECONDS * 1000).toISOString();
    const ttl = Math.floor(now.getTime() / 1000) + HOLDING_TTL_SECONDS;

    // V7.18: sourceRegion 결정 및 디버그 로그
    const sourceRegion = process.env.AWS_REGION || 'ap-northeast-2';
    console.log('[HOLDING] Environment Debug:', {
        AWS_REGION: process.env.AWS_REGION,
        DR_RECOVERY_MODE: process.env.DR_RECOVERY_MODE,
        sourceRegion: sourceRegion
    });

    try {
        // [DEBUG] 호출 파라미터 로깅
        console.log('[HOLDING] createHolding called:', {
            performanceId,
            date,
            time,
            pk,
            seatIds: seats.map(s => s.seatId),
            userId,
            venue,
            performanceTitle,
            sourceRegion
        });

        // Check availability first
        const { available, conflicts } = await areSeatsAvailable(performanceId, seats.map(s => s.seatId), date, time);
        console.log('[HOLDING] areSeatsAvailable result:', { available, conflicts });
        if (!available) {
            return {
                success: false,
                error: `이미 예약된 좌석입니다: ${conflicts.join(', ')}`,
                unavailableSeats: conflicts
            };
        }

        // Create transactions to hold all seats
        const puts = seats.map(seat => ({
            Put: {
                TableName: RESERVATIONS_TABLE,
                Item: {
                    PK: pk,
                    SK: createSK(seat.seatId),
                    status: 'HOLDING',
                    holdingId,
                    userId,
                    seatId: seat.seatId,
                    seatNumber: seat.seatNumber || seat.number,
                    rowId: seat.rowId || seat.row,
                    grade: seat.grade,
                    price: seat.price,
                    performanceId,
                    performanceTitle: performanceTitle || '',  // V7.18: 비정규화
                    venue: venue || '',                        // V7.18: 비정규화
                    posterUrl: posterUrl || '',                // V7.20: 비정규화
                    date,
                    time,
                    createdAt: now.toISOString(),
                    expiresAt: expiresAt,
                    holdExpiresAt: ttl, // Business logic field
                    ttl: ttl, // DynamoDB TTL field (Universal)
                    sourceRegion: sourceRegion // V7.18: 환경변수에서 읽은 값 사용
                },
                ConditionExpression: "attribute_not_exists(SK) OR (expiresAt < :now AND #s = :h_status)",
                ExpressionAttributeNames: {
                    "#s": "status"
                },
                ExpressionAttributeValues: {
                    ":now": now.toISOString(),
                    ":h_status": "HOLDING"
                }
            }
        }));

        await dynamoDb.send(new TransactWriteCommand({
            TransactItems: puts
        }));

        // [V8.3] KST 시간 포맷 (AI가 변환하지 않도록 서버에서 제공)
        const expiresAtText = new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Seoul'
        }).format(new Date(expiresAt));

        return { success: true, holdingId, expiresAt, expiresAtText, remainingSeconds: HOLDING_TTL_SECONDS };
    } catch (error: any) {
        if (error.name === 'TransactionCanceledException') {
            return { success: false, error: "이미 예약된 좌석이 포함되어 있습니다." };
        }
        console.error(`[HoldingManager] Error creating holding:`, error);
        return { success: false, error: "선점 처리 중 오류가 발생했습니다." };
    }
}



/**
 * 4. Get holding by ID (DynamoDB Only)
 * [V8.13 FIX] totalPrice, performanceTitle, venue, 등급별 색상 추가
 * Note: Since we don't have a GSI for holdingId yet, this is a Scan (not ideal).
 * But for a small POC / MVP, we can keep it or use Query if we change index.
 */
export async function getHolding(holdingId: string): Promise<Holding | null> {
    try {
        // V7.15: GSI holdingId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'holdingId-index',
            KeyConditionExpression: "holdingId = :hid",
            FilterExpression: "#s = :status",
            ExpressionAttributeNames: {
                "#s": "status"
            },
            ExpressionAttributeValues: {
                ":hid": holdingId,
                ":status": "HOLDING"
            }
        }));

        const items = result.Items || [];
        if (items.length === 0) return null;

        const first = items[0] as any;
        const now = new Date();
        const expiresAtISO = new Date(now.getTime() + 600 * 1000).toISOString();  // V7.22: 10분 TTL


        // [V8.17 FIX] 등급별 색상 매핑 - DB seatColors와 일치
        const gradeColors: Record<string, string> = {
            'OP': '#9E37D1',   // 보라색 (오케스트라 피트)
            'VIP': '#FF0000',  // 빨간색
            'R': '#FFA500',    // 주황색
            'S': '#1E90FF',    // 파란색
            'A': '#32CD32',    // 초록색
        };


        // [V8.13 FIX] seats 매핑 시 price와 color 포함
        const seats = items.map((i: any) => ({
            seatId: (i.seatId as string) || "",
            seatNumber: (i.seatNumber as number) || 0,
            rowId: (i.rowId as string) || 'unknown',
            grade: (i.grade as string) || 'S',
            price: (i.price as number) || 0,
            color: gradeColors[(i.grade as string)] || '#333333',  // [V8.13] 등급별 색상
            status: 'holding' as any
        }));

        // [V8.13 FIX] totalPrice 계산
        const totalPrice = seats.reduce((sum, seat) => sum + (seat.price || 0), 0);

        // [V8.13 FIX] performanceTitle, venue 가져오기 (DB 저장값 우선, 없으면 조회)
        let performanceTitle = (first.performanceTitle as string) || '';
        let venue = (first.venue as string) || '';

        // DB에 저장된 값이 없으면 공연 정보에서 조회
        if (!performanceTitle || !venue) {
            try {
                const perf = await getPerformance(first.performanceId);
                if (perf) {
                    performanceTitle = performanceTitle || perf.title || "알 수 없는 공연";
                    venue = venue || (perf.venue as any)?.name || perf.venue || "샤롯데씨어터";
                }
            } catch (e) {
                console.warn('[getHolding] Failed to fetch performance info:', e);
            }
        }

        const holding: Holding = {
            holdingId: (first.holdingId as string) || holdingId,
            performanceId: (first.performanceId as string) || "",
            performanceTitle: performanceTitle,  // [V8.13 FIX] 추가
            venue: venue,                        // [V8.13 FIX] 추가
            date: (first.date as string) || "",
            time: (first.time as string) || "",
            userId: (first.userId as string) || "",
            seats: seats,
            totalPrice: totalPrice,              // [V8.13 FIX] 추가
            createdAt: (first.createdAt as string) || now.toISOString(),
            expiresAt: (first.expiresAt as string) || expiresAtISO
        };

        console.log('[getHolding] Returning holding:', {
            holdingId,
            performanceTitle,
            venue,
            totalPrice,
            seatCount: seats.length,
            seatIds: seats.map(s => s.seatId)
        });

        return holding;
    } catch (error) {
        console.error(`[HoldingManager] Error getting holding:`, error);
        return null;
    }
}


/**
 * 5. Release specific holding
 */
export async function releaseHolding(holdingId: string): Promise<boolean> {
    try {
        // V7.15: GSI holdingId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'holdingId-index',
            KeyConditionExpression: "holdingId = :hid",
            ExpressionAttributeValues: {
                ":hid": holdingId
            }
        }));

        const items = result.Items || [];
        if (items.length === 0) return false;

        const deletes = items.map((item: any) => ({
            Delete: {
                TableName: RESERVATIONS_TABLE,
                Key: { PK: item.PK, SK: item.SK }
            }
        }));

        await dynamoDb.send(new TransactWriteCommand({
            TransactItems: deletes
        }));

        return true;
    } catch (error) {
        console.error(`[HoldingManager] Error releasing holding:`, error);
        return false;
    }
}

/**
 * 6.5 Confirm Reservation (Move from Holding to Reservation)
 */
// 6.5 Confirm Reservation (Move from Holding to Reservation)
export async function confirmReservation(
    holdingId: string,
    performanceTitle: string,
    venue: string,
    posterUrl?: string
): Promise<{ success: boolean; reservation?: Reservation; error?: string }> {
    // [V7.13] Input Validation
    if (!performanceTitle) performanceTitle = "알 수 없는 공연";
    if (!venue) venue = "Charlotte Theater";

    try {
        // V7.15: GSI holdingId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        // [V7.9] Allow confirming both HOLDING and DR_RECOVERED statuses
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'holdingId-index',
            KeyConditionExpression: "holdingId = :hid",
            FilterExpression: "#s = :s1 OR #s = :s2",
            ExpressionAttributeNames: {
                "#s": "status"
            },
            ExpressionAttributeValues: {
                ":hid": holdingId,
                ":s1": "HOLDING",
                ":s2": "DR_RECOVERED"
            }
        }));

        const items = result.Items || [];
        if (items.length === 0) return { success: false, error: '선점된 정보를 찾을 수 없거나 만료되었습니다.' };

        const reservationId = randomUUID();
        const now = new Date();
        const nowISO = now.toISOString();
        const first = items[0];

        // [V8.4] 만료된 선점 확인 (TTL 지연 대비)
        // DR_RECOVERED의 경우 15분 유예가 있으므로 HOLDING 상태일 때만 체크
        if (first.status === 'HOLDING' && first.expiresAt && new Date(first.expiresAt) < now) {
            return { success: false, error: '선점 시간이 만료되었습니다. 다시 좌석을 선택해주세요.' };
        }

        // --- Denormalization Check (V7.8) ---
        let finalPosterUrl = posterUrl;
        if (!finalPosterUrl) {
            try {
                const perf = await getPerformance(first.performanceId);
                finalPosterUrl = perf ? (perf.posterUrl || perf.poster || "") : "";
            } catch (vError) {
                console.warn(`[HoldingManager] Failed to fetch posterUrl for denormalization:`, vError);
            }
        }

        // --- DR Status Logic (V7.16) ---
        // DR_RESERVED: DR 리전에서 새로 예약한 건
        // DR_RECOVERED: Main에서 HOLDING 중 장애 → DR에서 복구 (15분 유예)
        let finalStatus = "CONFIRMED";
        const isDRMode = process.env.DR_RECOVERY_MODE === 'true';

        // [V7.16] DR 모드에서의 상태 결정
        if (isDRMode) {
            const recoveryStartTimeStr = process.env.DR_RECOVERY_START_TIME || nowISO;
            const recoveryStartTime = new Date(recoveryStartTimeStr);
            const gracePeriodMinutes = parseInt(process.env.DR_GRACE_PERIOD_MINUTES || '30');
            const gracePeriodLimit = new Date(recoveryStartTime.getTime() + gracePeriodMinutes * 60 * 1000);

            const holdingCreatedAt = new Date(first.createdAt);

            // 이미 DR_RECOVERED 상태면 → DR_RESERVED로 최종 확정 (DR 리전 예약 구분)
            if (first.status === 'DR_RECOVERED') {
                finalStatus = "DR_RESERVED";  // V7.22: CONFIRMED → DR_RESERVED (Main/DR 리전 구분)
                console.log(JSON.stringify({
                    event: '[REALTIME] [RESERVATION] DR_RECOVERED_TO_DR_RESERVED',
                    reservationId: reservationId,
                    visitorId: first.userId,
                    timestamp: nowISO
                }));
            }
            // V7.21: Main에서 장애 전에 생성된 HOLDING → DR_RESERVED (유예 기간 내)
            // (기존: CONFIRMED로 저장 → Main/DR 구분 불가)
            else if (holdingCreatedAt < recoveryStartTime && now < gracePeriodLimit) {
                finalStatus = "DR_RESERVED";  // V7.22: CONFIRMED → DR_RESERVED (Main/DR 리전 구분)
                console.log(JSON.stringify({
                    event: '[REALTIME] [RESERVATION] DR_HOLDING_TO_DR_RESERVED',
                    reservationId: reservationId,
                    visitorId: first.userId,
                    holdingCreatedAt: first.createdAt,
                    drRecoveryStartTime: recoveryStartTimeStr,
                    gracePeriodMinutes: gracePeriodMinutes,
                    note: 'V7.22: DR_RESERVED (Main/DR 리전 구분)',
                    timestamp: nowISO
                }));
            }
            // Main에서 장애 전에 생성됐지만 유예 기간 초과
            else if (holdingCreatedAt < recoveryStartTime && now >= gracePeriodLimit) {
                finalStatus = "DR_RESERVED";  // V7.22: 유예 기간 초과해도 DR에서 처리 → DR_RESERVED
                console.log(JSON.stringify({
                    event: '[REALTIME] [RESERVATION] DR_GRACE_PERIOD_EXPIRED',
                    reservationId: reservationId,
                    visitorId: first.userId,
                    holdingCreatedAt: first.createdAt,
                    expiredAt: nowISO,
                    reason: 'Grace period exceeded, but processed in DR → DR_RESERVED'
                }));
            }
            // DR 리전에서 새로 생성된 HOLDING → DR_RESERVED (DR에서 새로 예약한 건)
            else if (holdingCreatedAt >= recoveryStartTime) {
                finalStatus = "DR_RESERVED";  // V7.21a: DR 리전에서 새로 예약한 건은 DR_RESERVED로 구분
                console.log(JSON.stringify({
                    event: '[REALTIME] [RESERVATION] DR_NEW_BOOKING_RESERVED',
                    reservationId: reservationId,
                    visitorId: first.userId,
                    holdingCreatedAt: first.createdAt,
                    drRecoveryStartTime: recoveryStartTimeStr,
                    timestamp: nowISO
                }));
            }
        }
        // ------------------------------------

        const ttlValue = (finalStatus === "DR_RECOVERED")
            ? Math.floor(now.getTime() / 1000) + (15 * 60)
            : null;

        const updates = items.map((item: any) => ({
            Update: {
                TableName: RESERVATIONS_TABLE,
                Key: { PK: item.PK, SK: item.SK },
                UpdateExpression: ttlValue
                    ? "SET #s = :status, reservationId = :rid, performanceTitle = :title, venue = :venue, posterUrl = :poster, confirmedAt = :now, sourceRegion = :region, #ttl = :ttl REMOVE holdExpiresAt"
                    : "SET #s = :status, reservationId = :rid, performanceTitle = :title, venue = :venue, posterUrl = :poster, confirmedAt = :now, sourceRegion = :region REMOVE holdExpiresAt, #ttl",
                ExpressionAttributeNames: {
                    "#s": "status",
                    "#ttl": "ttl"
                },
                ExpressionAttributeValues: {
                    ":status": finalStatus,
                    ":rid": reservationId,
                    ":title": performanceTitle,
                    ":venue": venue,
                    ":poster": finalPosterUrl || "",
                    ":now": nowISO,
                    ":region": process.env.AWS_REGION || "ap-northeast-2",  // V7.19: 예약 확정 시 현재 리전으로 업데이트
                    ...(ttlValue ? { ":ttl": ttlValue } : {})
                }
            }
        }));

        await dynamoDb.send(new TransactWriteCommand({
            TransactItems: updates
        }));

        const firstItem = items[0] as any;
        const reservation: Reservation = {
            id: reservationId,
            userId: (firstItem.userId as string) || "",
            performanceId: (firstItem.performanceId as string) || "",
            performanceTitle,
            venue,
            posterUrl: finalPosterUrl || "",
            status: finalStatus as any,
            date: (first.date as string) || "",
            time: (first.time as string) || "",
            seats: items.map((i: any) => ({
                seatId: (i.seatId as string) || "",
                seatNumber: (i.seatNumber as number) || 0,
                rowId: i.rowId || 'unknown',
                grade: i.grade || 'S',
                price: i.price || 0,
                status: 'reserved' as any
            })),
            totalPrice: items.reduce((sum: number, i: any) => sum + (i.price || 0), 0),
            createdAt: nowISO
        };

        return { success: true, reservation };
    } catch (error) {
        console.error(`[REALTIME] [RESERVATION] Error confirming reservation:`, error);
        return { success: false, error: "예약 확정 중 오류가 발생했습니다." };
    }
}

/**
 * 7. Get Seat Status Map for UI (DynamoDB Only)
 */
export async function getSeatStatusMap(performanceId: string, date: string, time: string): Promise<Record<string, 'reserved' | 'holding' | 'available'>> {
    const statusMap: Record<string, 'reserved' | 'holding' | 'available'> = {};
    const now = new Date().toISOString(); // [V7.10.3] 현재 시간 for 만료 체크

    try {
        // 1. Fetch Performance to get venueId
        const perf = await getPerformance(performanceId);
        if (!perf) return statusMap;

        // 2. Use sections from performance (V7.7 Guide)
        const sections = perf.sections || [];
        sections.forEach((section: any) => {
            const rows = section.rows || [];
            rows.forEach((row: any) => {
                const rowSeats = row.seats || [];
                if (rowSeats.length > 0) {
                    rowSeats.forEach((seat: any) => {
                        statusMap[seat.seatId] = 'available';
                    });
                } else if (row.length) {
                    // V7.14: seatId 형식 수정 - floor 정보 포함 (예: 1층-B-5-2)
                    const floor = section.floor || '1층';
                    for (let i = 1; i <= row.length; i++) {
                        const seatId = `${floor}-${section.sectionId}-${row.rowId}-${i}`;
                        statusMap[seatId] = 'available';
                    }
                }
            });
        });

        // 3. Fetch Reservations/Holdings from DynamoDB
        const pk = createPK(performanceId, date, time);
        console.log(`[getSeatStatusMap] Querying PK: ${pk}`);

        const resResult = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": pk }
        }));

        console.log(`[getSeatStatusMap] Found ${resResult.Items?.length || 0} items in DynamoDB`);

        (resResult.Items || []).forEach(item => {
            const seatId = item.SK.replace('SEAT#', '');
            console.log(`[getSeatStatusMap] Item: seatId=${seatId}, status=${item.status}`);
            // V7.22: CONFIRMED, DR_RESERVED는 예약 완료 → reserved (회색 X)
            if (item.status === 'CONFIRMED' || item.status === 'DR_RESERVED') {
                statusMap[seatId] = 'reserved';
            }
            // V7.22: DR_RECOVERED는 결제 대기 상태 → holding (노란색)
            else if (item.status === 'DR_RECOVERED') {
                statusMap[seatId] = 'holding';
            }
            // [V8.23 FIX] CANCELLED는 명시적으로 available로 처리 (TTL 지연 대응)
            else if (item.status === 'CANCELLED') {
                statusMap[seatId] = 'available';
            }
            else if (item.status === 'HOLDING') {
                // [V7.10.3] 만료된 HOLDING은 available로 처리
                const expiresAt = item.expiresAt;
                if (expiresAt && expiresAt < now) {
                    // 만료됨 - available로 유지 (DynamoDB TTL 삭제 지연 대응)
                    statusMap[seatId] = 'available';
                } else {
                    statusMap[seatId] = 'holding';
                }
            }
        });

    } catch (e) {
        console.error('[getSeatStatusMap] Error:', e);
    }

    return statusMap;
}


/**
 * [V8.9.2] Get Single Holding by ID (for Payment Page Restore)
 */
export async function getHoldingForPayment(holdingId: string): Promise<{
    holdingId: string;
    performanceId: string;
    performanceTitle: string;
    venue: string;
    date: string;
    time: string;
    totalPrice: number;
    seats: { seatId: string; price: number; grade: string; color?: string }[];
    expiresAt: string;
    sections?: any[]; // for seat number calculation
} | null> {
    try {
        console.log(`[getHolding] Querying holdingId: ${holdingId}`);

        // GSI holdingId-index 조회
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'holdingId-index',
            KeyConditionExpression: "holdingId = :hid",
            ExpressionAttributeValues: { ":hid": holdingId }
        }));

        const items = result.Items || [];
        if (items.length === 0) {
            console.log(`[getHolding] Not found for ${holdingId}`);
            return null;
        }

        const firstItem = items[0];

        // Performance 정보 fetch (sections 등을 위해)
        let sections = [];
        try {
            // 순환 참조 방지를 위해 performance-service를 직접 import하지 않고, 
            // 필요한 정보만 DB 아이템에서 최대한 가져오거나, api-client는 클라이언트용이라 못씀.
            // 여기서는 DB에 저장된 정보 위주로 복원. sections가 없으면 seat number 계산이 정확하지 않을 수 있음.
            // 하지만 보통 holding 생성 시점엔 sections 정보가 저장되지 않음.
            // 필요하다면 performanceId로 performance 조회 로직을 추가해야 함.
            // 일단은 클라이언트에서 performanceId로 다시 fetch하도록 유도하거나, 여기서 performanceService를 import.
        } catch (e) { }

        const seats = items.map(item => ({
            seatId: item.seatId,
            price: item.price || 0,
            grade: item.grade || 'Unknown',
            color: item.color || '#333'
        }));

        const totalPrice = seats.reduce((sum, seat) => sum + seat.price, 0);

        return {
            holdingId: firstItem.holdingId,
            performanceId: firstItem.performanceId,
            performanceTitle: firstItem.performanceTitle,
            venue: firstItem.venue,
            date: firstItem.date,
            time: firstItem.time,
            totalPrice,
            seats,
            expiresAt: firstItem.expiresAt,
            sections: []
        };

    } catch (error) {
        console.error(`[getHolding] Error:`, error);
        return null;
    }
}

/**
 * 8. Get User Reservations (Optimized V7.8)
 */
export async function getUserReservations(userId: string): Promise<Reservation[]> {
    try {
        // V7.19: DR 모드 확인
        const isDRMode = process.env.DR_RECOVERY_MODE === 'true';

        // V7.15: GSI userId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        // V7.19: DR 모드에서는 HOLDING 상태도 조회 (DR_RECOVERED로 변환)
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'userId-index',
            KeyConditionExpression: "userId = :uid",
            FilterExpression: isDRMode
                ? "#s = :c1 OR #s = :c2 OR #s = :c3 OR #s = :c4 OR #s = :c5"  // HOLDING 포함
                : "#s = :c1 OR #s = :c2 OR #s = :c3 OR #s = :c4",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":uid": userId,
                ":c1": "CONFIRMED",
                ":c2": "DR_RECOVERED",
                ":c3": "CANCELLED",  // V7.14: 취소된 예약도 포함
                ":c4": "DR_RESERVED",  // V7.16: DR 리전에서 새 예약
                ...(isDRMode ? { ":c5": "HOLDING" } : {})  // V7.19: DR 모드에서 HOLDING 조회
            }
        }));

        const items = result.Items || [];
        const reservationsMap: Record<string, Reservation> = {};

        // V7.19: DR 모드에서 15분 유예 기간 계산용
        const now = new Date();
        const gracePeriodMinutes = parseInt(process.env.DR_GRACE_PERIOD_MINUTES || '30');

        for (const item of items) {
            // V7.19: HOLDING은 reservationId 대신 holdingId 사용
            const rid = item.reservationId || item.holdingId;
            if (!rid) continue;

            // V7.19: DR 모드에서 HOLDING은 원본 만료 시간 무시하고 복구 대상으로 처리
            // (원본 60초 TTL이 지나도 15분 유예 기간 부여)

            if (!reservationsMap[rid]) {
                // V7.19: HOLDING을 DR_RECOVERED로 변환할 때 15분 만료 시간 계산
                let displayStatus: string;
                let displayExpiresAt = item.expiresAt;

                // V7.19: HOLDING은 performanceTitle, venue, posterUrl이 비어있을 수 있음
                // -> performanceId로 공연 정보 조회 필요 (아래에서 처리)
                let perfTitle = item.performanceTitle || "";
                let perfVenue = item.venue || "";
                let perfPosterUrl = item.posterUrl || "";

                if (item.status === 'HOLDING' && isDRMode) {
                    // V7.21: sourceRegion으로 복구 대상 여부 판단
                    const currentRegion = process.env.AWS_REGION || 'ap-northeast-2';
                    const isFromMainRegion = item.sourceRegion !== currentRegion;

                    if (isFromMainRegion) {
                        // 메인 리전(Seoul)에서 생성된 HOLDING → 복구 대상
                        displayStatus = 'dr_recovered';
                        // V7.19: DR 서버 시작 시점(모듈 레벨 상수) 기준으로 15분 유예
                        const drRecoveryStartTime = DR_RECOVERY_START_TIMESTAMP || now;
                        displayExpiresAt = new Date(drRecoveryStartTime.getTime() + gracePeriodMinutes * 60 * 1000).toISOString();

                        console.log(`[DR] HOLDING→DR_RECOVERED: holdingId=${rid}, sourceRegion=${item.sourceRegion}, currentRegion=${currentRegion}, expiresAt=${displayExpiresAt}`);

                        // V7.20: HOLDING의 메타데이터가 비어있으면 공연 정보 조회 (posterUrl 포함)
                        if (!perfTitle || !perfVenue || !perfPosterUrl) {
                            try {
                                const perf = await getPerformance(item.performanceId);
                                if (perf) {
                                    perfTitle = perfTitle || perf.title || "알 수 없는 공연";
                                    perfVenue = perfVenue || (perf.venue as any)?.name || perf.venue || "알 수 없는 장소";
                                    perfPosterUrl = perfPosterUrl || perf.posterUrl || perf.poster || "";
                                }
                            } catch (e) {
                                console.warn('[getUserReservations] Failed to fetch performance info:', e);
                            }
                        }
                    } else {
                        // V7.21: DR 리전(Tokyo)에서 새로 생성된 HOLDING → 정상 HOLDING
                        // 원래 expiresAt 유지 (60초 TTL), "내 예약" 페이지에서는 표시하지 않음 (결제 페이지에서만 처리)
                        console.log(`[DR] HOLDING (local): holdingId=${rid}, sourceRegion=${item.sourceRegion}, skip display`);
                        continue;  // DR 리전에서 새로 생성된 HOLDING은 "내 예약" 목록에서 제외
                    }
                } else if (item.status === 'HOLDING' && !isDRMode) {
                    // 정상 모드에서 HOLDING은 "내 예약" 목록에서 제외 (결제 페이지에서만 처리)
                    continue;
                } else {
                    displayStatus = (() => {
                        switch (item.status) {
                            case 'CANCELLED': return 'cancelled';
                            case 'DR_RECOVERED': return 'dr_recovered';
                            case 'DR_RESERVED': return 'dr_reserved';
                            default: return 'confirmed';
                        }
                    })();
                }

                reservationsMap[rid] = {
                    id: rid,
                    holdingId: item.holdingId,  // V7.19: holdingId도 포함
                    userId: item.userId,
                    performanceId: item.performanceId,
                    performanceTitle: perfTitle || "알 수 없는 공연",
                    venue: perfVenue || "알 수 없는 장소",
                    posterUrl: perfPosterUrl,
                    date: item.date,
                    time: item.time,
                    seats: [],
                    totalPrice: 0,
                    status: displayStatus as any,
                    expiresAt: displayExpiresAt,
                    createdAt: item.confirmedAt || item.createdAt,
                    sections: []  // V7.22: 연속 번호 계산용 - 아래 루프 후 추가
                } as any;
            }
            reservationsMap[rid].seats.push({
                seatId: item.seatId,
                seatNumber: item.seatNumber || 0,
                rowId: item.rowId || 'unknown',
                grade: item.grade || 'S',
                price: item.price || 0,
                status: 'reserved'
            });
            reservationsMap[rid].totalPrice += (item.price || 0);
        }

        // V7.19: 만료된 DR_RECOVERED 필터링 (15분 초과 시 목록에서 제외)
        const filteredReservations = Object.values(reservationsMap).filter(r => {
            if (r.status === 'dr_recovered' && r.expiresAt) {
                const isNotExpired = new Date(r.expiresAt) > now;
                console.log(`[DR] Filter check: id=${r.id}, expiresAt=${r.expiresAt}, now=${now.toISOString()}, isNotExpired=${isNotExpired}`);
                return isNotExpired;  // 만료 안 된 것만 표시
            }
            return true;
        });

        // V7.22: sections 데이터 추가 (연속 좌석 번호 계산용)
        // performanceId별로 한 번만 조회하여 캐싱
        const sectionsByPerfId: Record<string, any[]> = {};
        for (const reservation of filteredReservations) {
            const perfId = reservation.performanceId;
            if (!sectionsByPerfId[perfId]) {
                try {
                    const perf = await getPerformance(perfId);
                    sectionsByPerfId[perfId] = perf?.sections || [];
                } catch (e) {
                    console.warn(`[getUserReservations] Failed to fetch sections for ${perfId}:`, e);
                    sectionsByPerfId[perfId] = [];
                }
            }
            (reservation as any).sections = sectionsByPerfId[perfId];
        }

        return filteredReservations.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

    } catch (error) {
        console.error(`[REALTIME] [USER] Error getting user reservations:`, error);
        return [];
    }
}

// Dummy functions for remaining exports to prevent breakage
export function cleanupExpiredHoldings(): void { }
export function releaseHoldingsByUser(userId: string): string[] { return []; }
export async function cancelReservation(reservationId: string): Promise<boolean> {
    try {
        // V7.15: GSI reservationId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'reservationId-index',
            KeyConditionExpression: "reservationId = :rid",
            ExpressionAttributeValues: {
                ":rid": reservationId
            }
        }));

        const items = result.Items || [];
        if (items.length === 0) return false;

        const now = new Date();
        const retentionDays = parseInt(process.env.CANCELLED_RETENTION_DAYS || '7'); // V7.14: 7일로 변경
        const ttl = Math.floor(now.getTime() / 1000) + (retentionDays * 86400);

        const updates = items.map((item: any) => ({
            Update: {
                TableName: RESERVATIONS_TABLE,
                Key: { PK: item.PK, SK: item.SK },
                UpdateExpression: "SET #s = :status, cancelledAt = :cancelledAt, #ttl = :ttl",
                ExpressionAttributeNames: { "#s": "status", "#ttl": "ttl" },
                ExpressionAttributeValues: {
                    ":status": "CANCELLED",
                    ":cancelledAt": now.toISOString(),
                    ":ttl": ttl
                }
            }
        }));

        await dynamoDb.send(new TransactWriteCommand({
            TransactItems: updates
        }));

        return true;
    } catch (error) {
        console.error(`[HoldingManager] Error canceling reservation:`, error);
        return false;
    }
}
export function getReservationCount(performanceId: string, date: string, time: string): number { return 0; }
export function getReservationCounts(performanceId: string): Record<string, number> { return {}; }

/**
 * V7.14: 취소된 예약 완전 삭제
 */
export async function deleteReservation(reservationId: string): Promise<boolean> {
    try {
        // V7.15: GSI reservationId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'reservationId-index',
            KeyConditionExpression: "reservationId = :rid",
            FilterExpression: "#s = :status",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":rid": reservationId,
                ":status": "CANCELLED"
            }
        }));

        const items = result.Items || [];
        if (items.length === 0) return false;

        const deletes = items.map((item: any) => ({
            Delete: {
                TableName: RESERVATIONS_TABLE,
                Key: { PK: item.PK, SK: item.SK }
            }
        }));

        await dynamoDb.send(new TransactWriteCommand({
            TransactItems: deletes
        }));

        return true;
    } catch (error) {
        console.error(`[HoldingManager] Error deleting reservation:`, error);
        return false;
    }
}
