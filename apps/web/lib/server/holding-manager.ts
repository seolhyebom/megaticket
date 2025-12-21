import fs from 'fs';
import path from 'path';

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
    cleanupExpiredHoldings();

    // Check Holdings
    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const activeHoldings = holdingData.holdings.filter(h => h.performanceId === performanceId);

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
): { success: boolean; holdingId?: string; error?: string; expiresAt?: string } {

    const seatIds = seats.map(s => s.seatId);
    const { available, conflicts } = areSeatsAvailable(performanceId, seatIds);

    if (!available) {
        return {
            success: false,
            error: `이미 예약된 좌석입니다: ${conflicts.join(', ')}`
        };
    }

    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const holdingId = crypto.randomUUID();
    const now = new Date();
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

    holdingData.holdings.push(newHolding);
    writeJson(HOLDINGS_FILE, holdingData);

    return { success: true, holdingId, expiresAt };
}

// 4. Get holding by ID
export function getHolding(holdingId: string): Holding | null {
    cleanupExpiredHoldings();
    const data = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    return data.holdings.find(h => h.holdingId === holdingId) || null;
}

// 5. Delete holding (release seats)
export function releaseHolding(holdingId: string): boolean {
    const data = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    const initialLength = data.holdings.length;
    const newHoldings = data.holdings.filter(h => h.holdingId !== holdingId);

    if (initialLength !== newHoldings.length) {
        writeJson(HOLDINGS_FILE, { holdings: newHoldings });
        return true;
    }
    return false;
}

// 6. Confirm Reservation (Move from Holding to Reserved)
export function confirmResercation(
    holdingId: string,
    performanceTitle: string,
    venue: string
): { success: boolean; reservation?: Reservation; error?: string } {

    const holding = getHolding(holdingId);

    if (!holding) {
        return { success: false, error: "Holding expired or invalid" };
    }

    const reservationData = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    const reservationId = crypto.randomUUID();

    const totalPrice = holding.seats.reduce((sum, seat) => sum + seat.price, 0);

    const newReservation: Reservation = {
        id: reservationId,
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

    reservationData.reservations.push(newReservation);
    writeJson(RESERVATIONS_FILE, reservationData);

    // Remove the holding
    releaseHolding(holdingId);

    return { success: true, reservation: newReservation };
}

// 7. Get Seat Status Map for UI
export function getSeatStatusMap(performanceId: string): Record<string, 'reserved' | 'holding' | 'available'> {
    cleanupExpiredHoldings();

    const statusMap: Record<string, 'reserved' | 'holding' | 'available'> = {};

    // Reserved
    const reservationData = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    reservationData.reservations
        .filter(r => r.performanceId === performanceId && r.status === 'confirmed')
        .forEach(r => {
            r.seats.forEach(s => {
                statusMap[s.seatId] = 'reserved';
            });
        });

    // Holding
    const holdingData = readJson<{ holdings: Holding[] }>(HOLDINGS_FILE);
    holdingData.holdings
        .filter(h => h.performanceId === performanceId)
        .forEach(h => {
            h.seats.forEach(s => {
                // If not already reserved (shouldn't happen with cleanup logic, but safety first)
                if (statusMap[s.seatId] !== 'reserved') {
                    statusMap[s.seatId] = 'holding';
                }
            });
        });

    return statusMap;
}

// 8. Get User Reservations
export function getUserReservations(userId: string): Reservation[] {
    const data = readJson<{ reservations: Reservation[] }>(RESERVATIONS_FILE);
    return data.reservations
        .filter(r => r.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
