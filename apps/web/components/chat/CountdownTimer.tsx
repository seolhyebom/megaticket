import React, { useEffect, useState } from 'react';
import { TimerInfo } from '../../types/chat';

interface CountdownTimerProps {
    timer: TimerInfo;
    onExpire?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ timer, onExpire }) => {
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const expireTime = new Date(timer.expiresAt).getTime();
            const diff = Math.floor((expireTime - now) / 1000);
            return diff > 0 ? diff : 0;
        };

        const initialTime = calculateTimeLeft();
        setTimeLeft(initialTime);

        if (initialTime <= 0) {
            setIsExpired(true);
            if (onExpire) onExpire();
            return;
        }

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                setIsExpired(true);
                if (onExpire) onExpire();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [timer.expiresAt, onExpire]);

    if (isExpired) {
        return (
            <div className="flex items-center gap-2 text-gray-500 mt-2 text-sm bg-gray-50 p-2 rounded-lg border border-gray-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>만료된 요청입니다</span>
            </div>
        );
    }

    const isUrgent = timeLeft <= (timer.warningThreshold || 30);

    return (
        <div className={`
            flex items-center gap-2 mt-2 text-sm font-medium px-3 py-2 rounded-lg border
            transition-colors duration-300
            ${isUrgent
                ? 'text-red-600 bg-red-50 border-red-100 animate-pulse'
                : 'text-blue-600 bg-blue-50 border-blue-100'}
        `}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{timer.message}: {timeLeft}초</span>
        </div>
    );
};
