
export interface SeatGradeDisplay {
    grade: string;
    price: number;
    color: string;
    description?: string;
    count?: number; // For availability summary
}

export interface ActionButton {
    id: string;
    label: string;
    action?: string; // tool name to call, or 'navigate' for URL navigation
    type?: 'message' | 'action'; // V7.6 explicit type
    text?: string; // text to send if type is message
    style?: 'primary' | 'secondary' | 'danger';
    data?: any;
    disabled?: boolean;
    url?: string; // V7.12: URL for navigate action
    target?: '_blank' | '_self'; // V7.12: open in new window or same window
}

export interface TimerInfo {
    expiresAt: string;
    message: string;
    warningThreshold?: number;
    holdingId?: string; // [V8.4] For auto-release on timeout
    // [V8.33] Extended for HoldingStatusPanel
    performanceName?: string;
    performanceDate?: string;
    seats?: Array<{
        seatId: string;
        grade: string;
        section?: string;
        row?: string;
        rowId?: string;
        number?: string;
        seatNumber?: number;
        price: number;
    }>;
    heldSeats?: Array<{
        seatId: string;
        grade: string;
        section?: string;
        row?: string;
        rowId?: string;
        number?: string;
        seatNumber?: number;
        price: number;
    }>;
    totalPrice?: number;
    payUrl?: string;
}

export interface ActionData {
    type?: string;
    actions?: ActionButton[];
    timer?: TimerInfo;
    seatGrades?: SeatGradeDisplay[];
    releasedHoldings?: boolean;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    _timer?: {
        duration: number; // seconds
        expiresAt: string; // ISO
    };
    _actions?: ActionButton[];
    seatGrades?: SeatGradeDisplay[]; // For presenting grade info
}
