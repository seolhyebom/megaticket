// @ts-nocheck
import { randomUUID } from 'crypto';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand, TransactWriteCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Seat, Holding, Reservation } from '@mega-ticket/shared-types';
import { dynamoDb, RESERVATIONS_TABLE, VENUES_TABLE, createPK, createSK } from "../dynamodb";
import { getPerformance } from './performance-service';

/**
 * 2. Check if seats are available (DynamoDB Only)
 */
export async function areSeatsAvailable(performanceId: string, seatIds: string[], date: string, time: string): Promise<{ available: boolean; conflicts: string[] }> {
    const pk = createPK(performanceId, date, time);
    const conflicts: string[] = [];

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
        const occupiedSeatIds = new Set(existingItems.map(item => item.SK.replace('SEAT#', '')));

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
): Promise<{ success: boolean; holdingId?: string; error?: string; expiresAt?: string; unavailableSeats?: string[] }> {

    const pk = createPK(performanceId, date, time);
    const holdingId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000).toISOString(); // 60 seconds TTL for POC
    const ttl = Math.floor(now.getTime() / 1000) + 60;

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

        return { success: true, holdingId, expiresAt };
    } catch (error: any) {
        if (error.name === 'TransactionCanceledException') {
            return { success: false, error: "이미 선택된 좌석이 포함되어 있습니다." };
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
        const result = await dynamoDb.send(new ScanCommand({
            TableName: RESERVATIONS_TABLE,
            FilterExpression: "holdingId = :hid AND #s = :status",
            ExpressionAttributeNames: {
                "#s": "status"
            },
            ExpressionAttributeValues: {
                ":hid": holdingId,
                ":status": "HOLDING"
            }
        }) as any); // Type cast due to ScanCommand being in lib-dynamodb

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
        const result = await dynamoDb.send(new ScanCommand({
            TableName: RESERVATIONS_TABLE,
            FilterExpression: "holdingId = :hid",
            ExpressionAttributeValues: {
                ":hid": holdingId
            }
        }) as any);

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
export async function confirmReservation(holdingId: string, performanceTitle: string, venue: string): Promise<{ success: boolean; reservation?: Reservation; error?: string }> {
    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: RESERVATIONS_TABLE,
            FilterExpression: "holdingId = :hid AND #s = :status",
            ExpressionAttributeNames: {
                "#s": "status"
            },
            ExpressionAttributeValues: {
                ":hid": holdingId,
                ":status": "HOLDING"
            }
        }) as any);

        const items = result.Items || [];
        if (items.length === 0) return { success: false, error: '선점된 정보를 찾을 수 없거나 만료되었습니다.' };

        const reservationId = randomUUID();
        const now = new Date().toISOString();
        const first = items[0];

        const updates = items.map((item: any) => ({
            Update: {
                TableName: RESERVATIONS_TABLE,
                Key: { PK: item.PK, SK: item.SK },
                UpdateExpression: "SET #s = :status, reservationId = :rid, performanceTitle = :title, venue = :venue, confirmedAt = :now",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                    ":status": "CONFIRMED",
                    ":rid": reservationId,
                    ":title": performanceTitle,
                    ":venue": venue,
                    ":now": now
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
            date: (first.date as string) || "",
            time: (first.time as string) || "",
            seats: items.map((i: any) => ({
                seatId: (i.seatId as string) || "",
                seatNumber: (i.seatNumber as number) || 0,
                rowId: (i.rowId as string) || 'unknown',
                grade: (i.grade as string) || 'S',
                price: (i.price as number) || 0,
                status: 'reserved' as any
            })),
            totalPrice: items.reduce((sum: number, i: any) => sum + ((i.price as number) || 0), 0),
            status: 'confirmed',
            createdAt: now
        };
        return { success: true, reservation };
    } catch (error) {
        console.error(`[HoldingManager] Error confirming reservation:`, error);
        return { success: false, error: '예약 확정 중 오류가 발생했습니다.' };
    }
}

/**
 * 7. Get Seat Status Map for UI (DynamoDB Only)
 */
export async function getSeatStatusMap(performanceId: string, date: string, time: string): Promise<Record<string, 'reserved' | 'holding' | 'available'>> {
    const statusMap: Record<string, 'reserved' | 'holding' | 'available'> = {};

    try {
        // 1. Fetch Performance to get venueId
        const perf = await getPerformance(performanceId);
        if (!perf) return statusMap;

        const vId = perf.venueId || 'charlotte-theater';

        // 2. Fetch Venue Item from DynamoDB
        const venueResult = await dynamoDb.send(new GetCommand({
            TableName: VENUES_TABLE,
            Key: { venueId: vId }
        }));

        if (venueResult.Item) {
            const sections = venueResult.Item.sections || [];
            sections.forEach((section: any) => {
                const rows = section.rows || [];
                rows.forEach((row: any) => {
                    const rowSeats = row.seats || [];
                    if (rowSeats.length > 0) {
                        rowSeats.forEach((seat: any) => {
                            statusMap[seat.seatId] = 'available';
                        });
                    } else if (row.length) {
                        for (let i = 1; i <= row.length; i++) {
                            const seatId = `${section.sectionId}-${row.rowId}-${i}`;
                            statusMap[seatId] = 'available';
                        }
                    }
                });
            });
        }

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
            } else if (item.status === 'HOLDING') {
                statusMap[seatId] = 'holding';
            }
        });

    } catch (e) {
        console.error('[getSeatStatusMap] Error:', e);
    }

    return statusMap;
}

/**
 * 9. Get User Reservations (DynamoDB Only)
 */
export async function getUserReservations(userId: string): Promise<Reservation[]> {
    try {
        // Since we don't have GSI for userId, we use Scan (Filter by userId)
        const result = await dynamoDb.send(new ScanCommand({
            TableName: RESERVATIONS_TABLE,
            FilterExpression: "userId = :uid AND #s = :status",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":uid": userId,
                ":status": "CONFIRMED"
            }
        }) as any);

        const items = result.Items || [];
        // Group by reservationId
        const reservationsMap: Record<string, Reservation> = {};

        items.forEach((item: any) => {
            const rid = item.reservationId || item.PK; // Fallback to PK if reservationId missing
            if (!reservationsMap[rid]) {
                reservationsMap[rid] = {
                    id: rid,
                    userId: item.userId,
                    performanceId: item.performanceId,
                    performanceTitle: item.performanceTitle || "알 수 없는 공연",
                    venue: item.venue || "알 수 없는 장소",
                    date: item.date,
                    time: item.time,
                    seats: [],
                    totalPrice: 0,
                    status: 'confirmed',
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

        const uniquePerformanceIds = Array.from(new Set(Object.values(reservationsMap).map(r => r.performanceId)));
        const performanceMap: Record<string, any> = {};

        await Promise.all(uniquePerformanceIds.map(async (pId) => {
            if (pId) {
                const perf = await getPerformance(pId);
                if (perf) {
                    performanceMap[pId] = perf;
                }
            }
        }));

        return Object.values(reservationsMap).map(reservation => ({
            ...reservation,
            posterUrl: performanceMap[reservation.performanceId]?.posterUrl || performanceMap[reservation.performanceId]?.poster || ""
        })).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

    } catch (error) {
        console.error(`[HoldingManager] Error getting user reservations:`, error);
        return [];
    }
}

// Dummy functions for remaining exports to prevent breakage
export function cleanupExpiredHoldings(): void { }
export function releaseHoldingsByUser(userId: string): string[] { return []; }
export async function cancelReservation(reservationId: string): Promise<boolean> {
    try {
        const result = await dynamoDb.send(new ScanCommand({
            TableName: RESERVATIONS_TABLE,
            FilterExpression: "reservationId = :rid",
            ExpressionAttributeValues: {
                ":rid": reservationId
            }
        }) as any);

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
        console.error(`[HoldingManager] Error canceling reservation:`, error);
        return false;
    }
}
export function getReservationCount(performanceId: string, date: string, time: string): number { return 0; }
export function getReservationCounts(performanceId: string): Record<string, number> { return {}; }
