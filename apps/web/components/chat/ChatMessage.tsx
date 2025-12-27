import React, { useMemo } from 'react';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";
import { SeatGradeList } from '../SeatGradeList';
import { ActionButton, TimerInfo, ActionData } from '../../types/chat';
import { ActionButtons } from './ActionButtons';
import { CountdownTimer } from './CountdownTimer';

export interface ChatMessageProps {
    role: 'user' | 'assistant' | 'system';
    content: string;
    actions?: ActionButton[];
    timer?: TimerInfo;
    onAction: (action: ActionButton) => void;
    onTimerExpire?: () => void;
    isLast: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    actions,
    timer,
    onAction,
    onTimerExpire,
    isLast
}) => {
    // Parse metadata
    const actionData = useMemo<ActionData>(() => {
        const match = content.match(/<!-- ACTION_DATA: (.*?) -->/);
        if (!match) return {} as ActionData;
        try {
            // [V7.9] Fix: Robust JSON parsing
            const raw = match[1].replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(raw);
        } catch (e) {
            console.error('[ChatMessage] Failed to parse action data:', e);
            return {} as ActionData;
        }
    }, [content]);

    // Hide metadata comments from view
    const displayContent = useMemo(() => {
        return content.replace(/<!-- ACTION_DATA: [\s\S]*? -->/g, '').trim();
    }, [content]);

    const seatGrades = actionData?.seatGrades; // [Issue 10] & [V7.9 Fix] Optional chaining

    // [V7.10.4] 버튼 중복 방지: actions prop 우선, 없으면 actionData에서 파싱된 버튼 사용
    // 또한 ID 기반 중복 제거
    const resolvedActions = useMemo(() => {
        const sourceActions = actions && actions.length > 0 ? actions : actionData?.actions;
        if (!sourceActions || sourceActions.length === 0) return [];

        // ID 기반 중복 제거
        const seenIds = new Set<string>();
        return sourceActions.filter((action: ActionButton) => {
            const id = action.id || action.label || '';
            if (seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
        });
    }, [actions, actionData]);

    // V7.3 Markdown Renderer
    const renderMessage = (text: string) => {
        const parts = text.split(/(```[\s\S]*?```)/g); // Split by code blocks
        return parts.map((part, i) => {
            if (!part || part.trim() === '') return null;
            if (i % 2 === 1) { // This is a code block
                return (
                    <div key={i} className="my-4 p-4 bg-muted/50 rounded-lg overflow-x-auto">
                        <pre className="text-sm whitespace-pre-wrap break-all">
                            <code>{part.trim().slice(3, -3)}</code> {/* Remove ``` delimiters */}
                        </pre>
                    </div>
                );
            }
            // This is regular text, further split by bold
            const boldParts = part.split(/(\*\*.*?\*\*)/g);
            return (
                <div key={i} className="whitespace-pre-wrap">
                    {boldParts.map((boldPart, j) => {
                        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                            return <strong key={`${i}-${j}`} className="font-bold text-indigo-600">{boldPart.slice(2, -2)}</strong>;
                        }
                        return <span key={`${i}-${j}`}>{boldPart}</span>;
                    })}
                </div>
            );
        });
    };

    if (!displayContent && (!actions || actions.length === 0) && !timer) return null;

    return (
        <div className={cn(
            "flex items-start gap-3 w-full",
            role === "user" ? "flex-row-reverse" : "flex-row"
        )}>
            <Avatar className={cn(
                "h-8 w-8 mt-1 border",
                role === "user"
                    ? "bg-secondary border-white/10"
                    : "bg-primary/10 border-primary/20"
            )}>
                <AvatarFallback className="text-xs">
                    {role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                </AvatarFallback>
            </Avatar>

            <div className="flex flex-col max-w-[85%] items-start">
                {displayContent && (
                    <div
                        className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed w-full whitespace-pre-wrap break-words",
                            role === "user"
                                ? "bg-orange-500 text-white rounded-tr-sm shadow-md"
                                : "bg-gray-100 text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm font-medium"
                        )}
                    >
                        {renderMessage(displayContent)}
                    </div>
                )}

                {/* [Issue 10] Seat Grades Legend using V7.6 Component */}
                {role === 'assistant' && seatGrades && seatGrades.length > 0 && (
                    <div className="w-full">
                        <SeatGradeList grades={seatGrades} />
                    </div>
                )}

                {/* Render Interactive Elements only for the latest message or if persisted */}
                {/* For V7.2, we assume actions attach to the message that generated them */}
                {/* If Timer is present, it's global or message specific? Prompt said "UI에 ... 버튼이 자동으로 표시됩니다" */}
                {role === 'assistant' && (
                    <div className="flex flex-col gap-2 ml-1 w-full">
                        {/* [V7.10.3] 타이머는 헤더에서만 표시, 메시지 내 중복 제거 */}

                        {/* [V7.11] 버튼 잔류 버그 수정: 마지막 메시지에서만 버튼 표시 */}
                        {isLast && resolvedActions && resolvedActions.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <ActionButtons actions={resolvedActions} onAction={onAction} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
