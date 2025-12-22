import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const HOLDINGS_FILE = path.join(DATA_DIR, 'seat-holdings.json');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');

// Types
export type Seat = {
    seatId: string;
    row: string;
    number: number;
    grade: string;
    price: number;
};

export type Holding = {
    holdingId: string;
    performanceId: string;
    date: string;
    time: string;
    seats: Seat[];
    userId: string;
    createdAt: string; // ISO date string
    expiresAt: string; // ISO date string
};

export type Reservation = {
    id: string;
    userId: string;
    performanceId: string;
    performanceTitle: string;
    venue: string;
    posterUrl?: string; // Add field
    date: string;
    time: string;
    seats: Seat[];
    totalPrice: number;
    status: 'confirmed' | 'cancelled';
    createdAt: string;
};

// Helper: Ensure data directory and files exist
function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(HOLDINGS_FILE)) {
        fs.writeFileSync(HOLDINGS_FILE, JSON.stringify({ holdings: [] }, null, 2));
    }
    if (!fs.existsSync(RESERVATIONS_FILE)) {
        fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify({ reservations: [] }, null, 2));
    }
}

// Helper: Read/Write JSON
function readJson<T>(filePath: string): T {
    ensureDataFiles();
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    try {
        return JSON.parse(fileContent) as T;
    } catch (e) {
        console.error(`Error reading ${filePath}`, e);
        return { holdings: [], reservations: [] } as unknown as T;
    }
}

function writeJson<T>(filePath: string, data: T) {
    ensureDataFiles();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Holding Manager Functions ---

// 1. Clean up expired holdings
export function cleanupExpiredHoldings(): void {
    const data = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const now = new Date();

    const validHoldings = data.holdings.filter(h => new Date(h.expiresAt) > now);

    if (data.holdings.length !== validHoldings.length) {
        writeJson(HOLDINGS_FILE, { holdings: validHoldings });
        console.log(`[HoldingManager] Cleaned up ${data.holdings.length - validHoldings.length} expired holdings.`);
    }
}

// 2. Check if seats are available (not held by others and not reserved)
export function areSeatsAvailable(performanceId: string, seatIds: string[]): { available: boolean; conflicts: string[] } {
    // Note: We do NOT write to file here to avoid blocking/races. We just check.
    const now = new Date();

    // Check Holdings
    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    // Filter expired in memory relevant to this check
    const activeHoldings = holdingData.holdings.filter(h =>
        h.performanceId === performanceId &&
        new Date(h.expiresAt) > now
    );

    console.log(`[HoldingManager] Checking availability for ${performanceId}. Active Holdings: ${activeHoldings.length}`);

    const heldSeatIds = new Set<string>();
    activeHoldings.forEach(h => {
        h.seats.forEach(s => heldSeatIds.add(s.seatId));
    });

    // Check Reservations
    const reservationData = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    const confirmedReservations = reservationData.reservations.filter(r => r.performanceId === performanceId && r.status === 'confirmed');

    const reservedSeatIds = new Set<string>();
    confirmedReservations.forEach(r => {
        r.seats.forEach(s => reservedSeatIds.add(s.seatId));
    });

    const conflicts: string[] = [];
    seatIds.forEach(id => {
        if (heldSeatIds.has(id)) {
            console.log(`[HoldingManager] Conflict detected (Held): ${id}`);
            conflicts.push(id);
        } else if (reservedSeatIds.has(id)) {
            console.log(`[HoldingManager] Conflict detected (Reserved): ${id}`);
            conflicts.push(id);
        }
    });

    return {
        available: conflicts.length === 0,
        conflicts
    };
}

// 3. Create a new holding
export function createHolding(
    performanceId: string,
    seats: Seat[],
    userId: string,
    date: string,
    time: string
): { success: boolean; holdingId?: string; error?: string; expiresAt?: string; unavailableSeats?: string[] } {

    const seatIds = seats.map(s => s.seatId);

    // 좌석 ID 유효성 검사
    // 중략... (유효성 검사 로직 유지)
    // New format check logic...
    const invalidSeats = seatIds.filter(id => {
        const parts = id.split('-');
        if (parts.length === 4) {
            const [floor, section, row, seatNum] = parts;
            const rowNum = parseInt(row, 10);
            const seatNumber = parseInt(seatNum, 10);
            return !floor || !section || isNaN(rowNum) || isNaN(seatNumber);
        } else if (parts.length === 2) {
            const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
            const [row, numStr] = parts;
            const num = parseInt(numStr, 10);
            return !ROWS.includes(row) || isNaN(num) || num < 1 || num > 20;
        }
        return true;
    });

    if (invalidSeats.length > 0) {
        return {
            success: false,
            error: `존재하지 않는 좌석 번호입니다: ${invalidSeats.join(', ')}.`,
            unavailableSeats: invalidSeats
        };
    }

    // ATOMIC-like Operation: Read -> Clean -> Check -> Write
    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const now = new Date();

    // 1. Cleanup expired (in memory)
    const validHoldings = holdingData.holdings.filter(h => new Date(h.expiresAt) > now);

    // 2. Check conflicts against valid holdings
    const conflicts: string[] = [];
    const heldSeatIds = new Set<string>();
    validHoldings.filter(h => h.performanceId === performanceId).forEach(h => {
        h.seats.forEach(s => heldSeatIds.add(s.seatId));
    });

    // Check against reservations (Read separate file)
    const reservationData = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    reservationData.reservations
        .filter(r => r.performanceId === performanceId && r.status === 'confirmed')
        .forEach(r => r.seats.forEach(s => heldSeatIds.add(s.seatId))); // Treat reserved as held for conflict check

    seatIds.forEach(id => {
        if (heldSeatIds.has(id)) {
            conflicts.push(id);
        }
    });

    if (conflicts.length > 0) {
        return {
            success: false,
            error: `이미 예약된 좌석입니다: ${conflicts.join(', ')}`,
            unavailableSeats: conflicts
        };
    }

    const holdingId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + 60 * 1000).toISOString(); // 60 seconds TTL

    const newHolding: Holding = {
        holdingId,
        performanceId,
        date,
        time,
        seats,
        userId,
        createdAt: now.toISOString(),
        expiresAt
    };

    // 3. Add new holding
    validHoldings.push(newHolding);

    // 4. Write back (Replacing file with cleaned + new list)
    writeJson(HOLDINGS_FILE, { holdings: validHoldings });

    return { success: true, holdingId, expiresAt };
}

// 4. Get holding by ID
export function getHolding(holdingId: string): Holding | null {
    // Read only, ignore expired
    const data = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const holding = data.holdings.find(h => h.holdingId === holdingId);
    if (holding && new Date(holding.expiresAt) > new Date()) {
        return holding;
    }
    return null;
}

// 5. Release specific holding
export function releaseHolding(holdingId: string): boolean {
    const data = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const exists = data.holdings.some(h => h.holdingId === holdingId);
    if (!exists) return false;

    // Remove specific + clean expired
    const now = new Date();
    const updated = data.holdings.filter(h => h.holdingId !== holdingId && new Date(h.expiresAt) > now);
    writeJson(HOLDINGS_FILE, { holdings: updated });
    return true;
}

// 6. Release all holdings for a user
export function releaseHoldingsByUser(userId: string): string[] {
    const data = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const now = new Date();

    // Identify holdings to be released (belonging to user)
    const userHoldings = data.holdings.filter(h => h.userId === userId);
    const releasedIds = userHoldings.map(h => h.holdingId);

    // Filter out user's holdings AND expired holdings of others
    const updated = data.holdings.filter(h => h.userId !== userId && new Date(h.expiresAt) > now);

    if (data.holdings.length !== updated.length) {
        writeJson(HOLDINGS_FILE, { holdings: updated });
    }

    return releasedIds;
}

// 6.5 Confirm Reservation (Move from Holding to Reservation)
export function confirmReservation(holdingId: string, performanceTitle: string, venue: string): { success: boolean; reservation?: Reservation; error?: string } {
    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const holding = holdingData.holdings.find(h => h.holdingId === holdingId);

    if (!holding) {
        return { success: false, error: 'Holding not found' };
    }
    if (new Date(holding.expiresAt) <= new Date()) {
        return { success: false, error: 'Holding expired' };
    }

    // Calculate total price
    const totalPrice = holding.seats.reduce((sum, seat) => sum + seat.price, 0);

    // Create Reservation
    const reservation: Reservation = {
        id: crypto.randomUUID(),
        userId: holding.userId,
        performanceId: holding.performanceId,
        performanceTitle,
        venue,
        date: holding.date,
        time: holding.time,
        seats: holding.seats,
        totalPrice,
        status: 'confirmed',
        createdAt: new Date().toISOString()
    };

    // Save Reservation
    const reservationData = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    reservationData.reservations.push(reservation);
    writeJson(RESERVATIONS_FILE, reservationData);

    // Remove confirmed holding (and clean others)
    const now = new Date();
    const updatedHoldings = holdingData.holdings.filter(h => h.holdingId !== holdingId && new Date(h.expiresAt) > now);
    writeJson(HOLDINGS_FILE, { holdings: updatedHoldings });

    return { success: true, reservation };
}
// 7. Get Seat Status Map for UI
export function getSeatStatusMap(performanceId: string, date: string, time: string): Record<string, 'reserved' | 'holding' | 'available'> {
    // NO WRITE HERE. Read only.

    const statusMap: Record<string, 'reserved' | 'holding' | 'available'> = {};

    // venue.json load...
    const VENUE_FILE = path.join(process.cwd(), 'data', 'venues', 'sample-theater.json');

    try {
        if (fs.existsSync(VENUE_FILE)) {
            const venueData = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
            venueData.sections?.forEach((section: any) => {
                section.rows?.forEach((row: any) => {
                    row.seats?.forEach((seat: any) => {
                        statusMap[seat.seatId] = 'available';
                    });
                });
            });
        }
    } catch (e) {
        console.error('[getSeatStatusMap] Error reading venue file:', e);
    }

    if (Object.keys(statusMap).length === 0) {
        // fallback logic usually...
        const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        const SEATS_PER_ROW = 20;
        ROWS.forEach(row => {
            for (let i = 1; i <= SEATS_PER_ROW; i++) {
                statusMap[`${row}-${i}`] = 'available';
            }
        });
    }

    // Reserved
    const reservationData = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    reservationData.reservations
        .filter(r => r.performanceId === performanceId && r.date === date && r.time === time && r.status === 'confirmed')
        .forEach(r => {
            r.seats.forEach(s => {
                statusMap[s.seatId] = 'reserved';
            });
        });

    // Holding - Filter expired in memory
    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const now = new Date();

    holdingData.holdings
        .filter(h =>
            h.performanceId === performanceId &&
            h.date === date &&
            h.time === time &&
            new Date(h.expiresAt) > now // MEMORY CHECK ONLY
        )
        .forEach(h => {
            h.seats.forEach(s => {
                if (statusMap[s.seatId] !== 'reserved') {
                    statusMap[s.seatId] = 'holding';
                }
            });
        });

    return statusMap;
}

// 8. Cancel Reservation
export function cancelReservation(reservationId: string): boolean {
    const data = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    const reservationIndex = data.reservations.findIndex(r => r.id === reservationId);

    if (reservationIndex === -1) {
        return false;
    }

    // Update status to cancelled
    data.reservations[reservationIndex].status = 'cancelled';
    writeJson(RESERVATIONS_FILE, data);
    return true;
}

// 9. Get User Reservations
export function getUserReservations(userId: string): Reservation[] {
    const data = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    const reservations = data.reservations
        .filter(r => r.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Inject posterUrl dynamically
    const { getAllPerformances } = require('./performance-service'); // Lazy load to avoid circular dep if any
    const allPerformances = getAllPerformances();

    return reservations.map(r => {
        const perf = allPerformances.find((p: any) => p.id === r.performanceId);
        return {
            ...r,
            posterUrl: perf?.posterUrl
        };
    });
}
