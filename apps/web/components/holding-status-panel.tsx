"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Clock, CreditCard, Ticket } from "lucide-react";

interface SeatInfo {
    seatId: string;
    grade: string;
    section?: string;
    row?: string;
    rowId?: string;
    number?: string;
    seatNumber?: number;
    price: number;
}

interface HoldingStatusPanelProps {
    activeTimer: {
        holdingId: string;
        performanceName?: string;
        performanceDate?: string;
        expiresAt?: string;
        seats?: SeatInfo[];
        totalPrice?: number;
        remainingTime?: number;
        payUrl?: string;
        message?: string;
    } | null;
    onCancel: () => void;
    onExpire?: () => void;
}

export function HoldingStatusPanel({ activeTimer, onCancel, onExpire }: HoldingStatusPanelProps) {
    const [timeLeft, setTimeLeft] = useState<number>(600); // 기본 10분
    const [isMinimized, setIsMinimized] = useState(false);

    // [V8.34] expiresAt 기반 실시간 계산 함수 (빨간색 타이머와 동일한 로직)
    const calculateTimeLeft = useCallback(() => {
        if (!activeTimer?.expiresAt) return 0;
        try {
            const expiresAtMs = new Date(activeTimer.expiresAt).getTime();
            if (isNaN(expiresAtMs)) return 0;
            const diff = Math.floor((expiresAtMs - Date.now()) / 1000);
            return diff > 0 ? diff : 0;
        } catch {
            return 0;
        }
    }, [activeTimer?.expiresAt]);

    // [V8.34] 타이머 - expiresAt 기반 실시간 계산 (빨간색 타이머와 동일)
    useEffect(() => {
        if (!activeTimer?.expiresAt) return;

        // 초기값 설정
        const initialTime = calculateTimeLeft();
        setTimeLeft(initialTime);

        if (initialTime <= 0) {
            onExpire?.();
            return;
        }

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                onExpire?.();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [activeTimer?.expiresAt, activeTimer?.holdingId, calculateTimeLeft, onExpire]);

    if (!activeTimer) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 색상 결정 (10분 기준)
    const getTimerColor = () => {
        if (timeLeft > 300) return 'text-green-600';  // 5분 이상
        if (timeLeft > 180) return 'text-orange-500'; // 3~5분
        return 'text-red-500';  // 3분 미만
    };

    const getTimerBgColor = () => {
        if (timeLeft > 300) return 'bg-green-500';
        if (timeLeft > 180) return 'bg-orange-500';
        return 'bg-red-500';
    };

    // 타이머 바 퍼센트 (10분 = 600초 기준)
    const progressPercent = Math.max(0, (timeLeft / 600) * 100);

    // 좌석 정보 포맷팅
    const formatSeat = (seat: SeatInfo) => {
        const row = seat.row || seat.rowId || '';
        const num = seat.number || seat.seatNumber || '';
        const section = seat.section || '';
        return `${seat.grade}석 ${section} ${row}열 ${num}번`.replace(/\s+/g, ' ').trim();
    };

    // 결제 URL 생성
    const payUrl = activeTimer.payUrl || `/reservation/confirm?holdingId=${activeTimer.holdingId}`;

    // 다중 좌석 처리
    const seats = activeTimer.seats || [];
    const totalPrice = activeTimer.totalPrice || seats.reduce((sum, s) => sum + (s.price || 0), 0);

    // [V8.34] 최소화 상태 - 챗봇 뱃지 위에 위치 (bottom-28로 여유 확보)
    if (isMinimized) {
        return (
            <div
                className="fixed bottom-28 right-6 z-50 animate-in slide-in-from-right-5 fade-in duration-300"
            >
                <button
                    onClick={() => setIsMinimized(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border-2 transition-all hover:scale-105 ${timeLeft <= 180 ? 'bg-red-500 border-red-300 animate-pulse' : 'bg-orange-500 border-orange-300'
                        }`}
                >
                    <Ticket className="h-4 w-4 text-white" />
                    <span className="text-white font-bold text-sm">{timeDisplay}</span>
                    <span className="text-white/80 text-xs">남음</span>
                </button>
            </div>
        );
    }

    return (
        <div
            className="fixed bottom-28 right-6 z-50 animate-in slide-in-from-right-5 fade-in duration-300"
        >
            <div className="w-72 bg-white rounded-xl shadow-2xl border border-orange-200 overflow-hidden">
                {/* 헤더 - 압축 */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Ticket className="h-4 w-4" />
                        <span className="font-bold text-sm">선점 현황 ({seats.length || 1}석)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                            title="최소화"
                        >
                            <div className="w-4 h-0.5 bg-white rounded" />
                        </button>
                        <button
                            onClick={onCancel}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                            title="닫기"
                        >
                            <X className="h-4 w-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* 본문 - 압축 */}
                <div className="p-3 space-y-3">
                    {/* 공연 정보 */}
                    {activeTimer.performanceName && (
                        <div className="text-sm text-gray-700">
                            <p className="font-medium text-gray-900">{activeTimer.performanceName}</p>
                            {activeTimer.performanceDate && (
                                <p className="text-gray-500 text-xs mt-0.5">{activeTimer.performanceDate}</p>
                            )}
                        </div>
                    )}

                    {/* 좌석 목록 */}
                    {seats.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">선택 좌석</p>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {seats.map((seat, index) => (
                                    <div
                                        key={seat.seatId || index}
                                        className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <span className="text-gray-800">{formatSeat(seat)}</span>
                                        <span className="text-gray-600 font-medium">
                                            {(seat.price || 0).toLocaleString()}원
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 총 가격 */}
                    {totalPrice > 0 && (
                        <div className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-600">총 결제 금액</span>
                            <span className="text-lg font-bold text-orange-600">
                                {totalPrice.toLocaleString()}원
                            </span>
                        </div>
                    )}

                    {/* 타이머 - 압축 */}
                    <div className="text-center py-1">
                        <div className={`text-2xl font-mono font-bold ${getTimerColor()} ${timeLeft <= 180 ? 'animate-pulse' : ''}`}>
                            <Clock className="inline-block h-5 w-5 mr-1 -mt-1" />
                            {timeDisplay}
                        </div>
                        <p className="text-xs text-gray-500">남은 결제 시간</p>
                        {/* 타이머 바 */}
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div
                                className={`h-1 rounded-full transition-all duration-1000 ${getTimerBgColor()}`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* 버튼 - 압축 */}
                    <div className="space-y-1.5">
                        <button
                            onClick={() => window.open(payUrl, '_blank')}
                            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-200 text-sm"
                        >
                            <CreditCard className="h-4 w-4" />
                            결제하기
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('선점을 취소하시겠습니까?')) {
                                    onCancel();
                                }
                            }}
                            className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors text-xs"
                        >
                            선점 취소
                        </button>
                    </div>

                    {/* 안내 문구 - 압축 */}
                    <div className="text-center text-xs text-gray-400 pt-1">
                        ⏰ 10분 내 결제 필수
                    </div>
                </div>
            </div>
        </div>
    );
}
