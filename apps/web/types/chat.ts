
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
    action?: string; // tool name to call
    type?: 'message' | 'action'; // V7.6 explicit type
    text?: string; // text to send if type is message
    style?: 'primary' | 'secondary' | 'danger';
    data?: any;
    disabled?: boolean;
}

export interface TimerInfo {
    expiresAt: string;
    message: string;
    warningThreshold?: number;
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
