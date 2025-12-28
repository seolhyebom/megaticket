// @ts-nocheck
import { randomUUID } from 'crypto';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Seat, Holding, Reservation } from '@mega-ticket/shared-types';
import { dynamoDb, RESERVATIONS_TABLE, VENUES_TABLE, createPK, createSK } from "../dynamodb";
import { getPerformance } from './performance-service';

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
 */
export async function createHolding(
    performanceId: string,
    seats: Seat[],
    userId: string,
    date: string,
    time: string
): Promise<{ success: boolean; holdingId?: string; error?: string; expiresAt?: string; remainingSeconds?: number; unavailableSeats?: string[] }> {

    const pk = createPK(performanceId, date, time);
    const holdingId = randomUUID();
    const now = new Date();
    const HOLDING_TTL_SECONDS = 60; // 60 seconds TTL for POC
    const expiresAt = new Date(now.getTime() + HOLDING_TTL_SECONDS * 1000).toISOString();
    const ttl = Math.floor(now.getTime() / 1000) + HOLDING_TTL_SECONDS;



    try {
        // Check availability first
        const { available, conflicts } = await areSeatsAvailable(performanceId, seats.map(s => s.seatId), date, time);
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
                    date,
                    time,
                    createdAt: now.toISOString(),
                    expiresAt: expiresAt,
                    holdExpiresAt: ttl // DynamoDB TTL field
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
            }
        }));

        await dynamoDb.send(new TransactWriteCommand({
            TransactItems: puts
        }));

        return { success: true, holdingId, expiresAt, remainingSeconds: HOLDING_TTL_SECONDS };
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
        const expiresAtISO = new Date(now.getTime() + 60 * 1000).toISOString();

        const holding: Holding = {
            holdingId: (first.holdingId as string) || holdingId,
            performanceId: (first.performanceId as string) || "",
            date: (first.date as string) || "",
            time: (first.time as string) || "",
            userId: (first.userId as string) || "",
            seats: items.map((i: any) => ({
                seatId: (i.seatId as string) || "",
                seatNumber: (i.seatNumber as number) || 0,
                rowId: (i.rowId as string) || 'unknown',
                grade: (i.grade as string) || 'S',
                price: (i.price as number) || 0,
                status: 'holding' as any
            })),
            createdAt: (first.createdAt as string) || now.toISOString(),
            expiresAt: (first.expiresAt as string) || expiresAtISO
        };
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

        // --- DR Grace Period Logic (V7.8) ---
        let finalStatus = "CONFIRMED";
        const isDRMode = process.env.DR_RECOVERY_MODE === 'true';

        // [V7.9] If already recovered, skip check and proceed to CONFIRM
        if (isDRMode && first.status !== 'DR_RECOVERED') {
            const recoveryStartTimeStr = process.env.DR_RECOVERY_START_TIME || nowISO;
            const recoveryStartTime = new Date(recoveryStartTimeStr);
            const gracePeriodMinutes = parseInt(process.env.DR_GRACE_PERIOD_MINUTES || '15');
            const gracePeriodLimit = new Date(recoveryStartTime.getTime() + gracePeriodMinutes * 60 * 1000);

            const holdingCreatedAt = new Date(first.createdAt);

            // 만약 장애 복구 시작 전에 생성된 선점 데이터이고, 현재가 유예 기간 내라면
            if (holdingCreatedAt < recoveryStartTime && now < gracePeriodLimit) {
                finalStatus = "DR_RECOVERED";
                console.log(JSON.stringify({
                    event: '[REALTIME] [RESERVATION] DR_GRACE_PERIOD_APPLIED',
                    reservationId: reservationId,
                    visitorId: first.userId,
                    holdingCreatedAt: first.createdAt,
                    drRecoveryStartTime: recoveryStartTimeStr,
                    gracePeriodMinutes: gracePeriodMinutes,
                    timestamp: nowISO
                }));
            } else if (holdingCreatedAt < recoveryStartTime && now >= gracePeriodLimit) {
                // 유예 기간 초과 (로그만 기록)
                console.log(JSON.stringify({
                    event: '[REALTIME] [RESERVATION] DR_GRACE_PERIOD_EXPIRED',
                    reservationId: reservationId,
                    visitorId: first.userId,
                    holdingCreatedAt: first.createdAt,
                    expiredAt: nowISO,
                    reason: 'Grace period exceeded'
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
                    ? "SET #s = :status, reservationId = :rid, performanceTitle = :title, venue = :venue, posterUrl = :poster, confirmedAt = :now, #ttl = :ttl REMOVE holdExpiresAt"
                    : "SET #s = :status, reservationId = :rid, performanceTitle = :title, venue = :venue, posterUrl = :poster, confirmedAt = :now REMOVE holdExpiresAt, #ttl",
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
        const resResult = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": pk }
        }));

        (resResult.Items || []).forEach(item => {
            const seatId = item.SK.replace('SEAT#', '');
            if (item.status === 'CONFIRMED') {
                statusMap[seatId] = 'reserved';
            } else if (item.status === 'HOLDING' || item.status === 'DR_RECOVERED') {
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
 * 8. Get User Reservations (Optimized V7.8)
 */
export async function getUserReservations(userId: string): Promise<Reservation[]> {
    try {
        // V7.15: GSI userId-index 사용하여 Query (Scan 대비 99% RCU 절감)
        const result = await dynamoDb.send(new QueryCommand({
            TableName: RESERVATIONS_TABLE,
            IndexName: 'userId-index',
            KeyConditionExpression: "userId = :uid",
            FilterExpression: "#s = :c1 OR #s = :c2 OR #s = :c3",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":uid": userId,
                ":c1": "CONFIRMED",
                ":c2": "DR_RECOVERED",
                ":c3": "CANCELLED"  // V7.14: 취소된 예약도 포함
            }
        }));

        const items = result.Items || [];
        const reservationsMap: Record<string, Reservation> = {};

        items.forEach((item: any) => {
            const rid = item.reservationId;
            if (!rid) return;

            if (!reservationsMap[rid]) {
                reservationsMap[rid] = {
                    id: rid,
                    userId: item.userId,
                    performanceId: item.performanceId,
                    performanceTitle: item.performanceTitle || "알 수 없는 공연",
                    venue: item.venue || "알 수 없는 장소",
                    posterUrl: item.posterUrl || "",
                    date: item.date,
                    time: item.time,
                    seats: [],
                    totalPrice: 0,
                    // V7.14: 프론트엔드와 일관성을 위해 소문자로 변환
                    status: (item.status === 'CANCELLED' ? 'cancelled' : 'confirmed') as any,
                    createdAt: item.confirmedAt || item.createdAt
                };
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
        });

        return Object.values(reservationsMap).sort((a, b) =>
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
