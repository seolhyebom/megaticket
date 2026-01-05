"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, RefreshCcw, Clock } from "lucide-react";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ModelSelector } from "@/components/model-selector";
import { useAuth } from "@/contexts/auth-context";
import { DEFAULT_MODEL, getModelById } from "@/lib/model-config";

// V7.2 Components & Hooks
import { ChatMessage } from "./chat/ChatMessage";
import { useChatActions } from "@/hooks/useChatActions";
import { ActionButton, TimerInfo, ActionData } from "@/types/chat";

// [V8.33] Global Holding Status Panel
import { HoldingStatusPanel } from "./holding-status-panel";

interface Message {
    role: "user" | "assistant";
    content: string;
    // Client-side tracked metadata
    actions?: ActionButton[];
    timer?: TimerInfo;
}

// [V7.9] Helper to map full ID to display name
// [V7.9] Helper to map full ID to display name
const getDisplayModelName = (fullId: string) => {
    if (fullId.includes("haiku-4-5")) return "Claude Haiku 4.5"; // Request: Full Name
    if (fullId.includes("nova-lite")) return "Amazon Nova Lite"; // Request: Full Name
    if (fullId.includes("sonnet")) return "Claude 3.5 Sonnet";
    return fullId.split('.')[1] || fullId; // Fallback to partial ID
};

export function ChatInterface() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [modelId, setModelId] = useState<string>(DEFAULT_MODEL.id);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Global Active State (for Timer Overlay in Header, etc.)
    const [activeTimer, setActiveTimer] = useState<TimerInfo | undefined>(undefined);

    // [V7.9] Runtime Model Info from API Headers
    const [runtimeModelInfo, setRuntimeModelInfo] = useState<{ name: string; isFallback: boolean } | null>(null);

    // [V7.11] Session Timeout - 2분 경고, 5분 종료
    const [lastActivityTime, setLastActivityTime] = useState(Date.now());
    const [sessionWarningShown, setSessionWarningShown] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    // [V8.2] 세션 경고를 별도 상태로 분리 (배너 UI)
    const [sessionWarning, setSessionWarning] = useState<string | null>(null);

    // [V8.0] Session ID - 새로고침마다 새 세션 생성 (localStorage 미사용)
    const [sessionId, setSessionId] = useState<string>('');

    useEffect(() => {
        // 새로고침 시 항상 새 세션 ID 생성 (localStorage 미사용)
        const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSessionId(newId);
        console.log('[Chat] New session started:', newId);
    }, []);

    // Use the custom hook for actions
    // Cyclic dependency: sendMessage needs to be defined
    // But useChatActions needs sendMessage.
    // We will define sendMessage first, then pass it.

    // We need a stable reference for sendMessage to avoid re-creating hook on every render?
    // Actually, we can just define sendMessage inside component and pass it.

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading || sessionExpired || !sessionId) return;

        // [V7.11] 세션 타이머 리셋
        resetSessionTimer();

        // Reset timer if action is taken (heuristic)
        if (activeTimer && (text.includes("예약 확정") || text.includes("취소"))) {
            setActiveTimer(undefined);
        }

        // [V7.12] 사용자가 직접 메시지를 보낼 때만 이전 버튼 제거
        // isSessionWarningMessage가 false일 때만 버튼 제거
        setMessages(prev => prev.map(m => ({
            ...m,
            actions: undefined, // Completely hide buttons
            timer: undefined    // Also clear timer from previous messages
        })));

        const userMessage: Message = { role: "user", content: text };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            // Filter out metadata from history sent to API to save tokens?
            // Or keep it as is, route.ts handles it? route.ts uses messages array.
            // Client messages array contains raw content including <!-- ACTION_DATA -->.
            // backend expects array of { role, content: string | block[] }.
            const apiMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: [{ text: m.content }]
            }));

            const response = await apiClient.chat(apiMessages, modelId, user?.id, sessionId);

            if (!response.ok) throw new Error("Failed to send message");
            if (!response.body) throw new Error("No response body");

            // [V7.9] Read Headers for Model Info
            const usedModelId = response.headers.get("X-Bedrock-Model");
            const isFallback = response.headers.get("X-Bedrock-Fallback") === "true";

            if (usedModelId) {
                setRuntimeModelInfo({
                    name: getDisplayModelName(usedModelId),
                    isFallback
                });
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = "";
            let currentActionData: ActionData | null = null;

            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessage += chunk;

                // Real-time metadata parsing from chunk (detecting the tag end)
                // We check the WHOLE assistantMessage for the last Action Data block

                // [V8.5] Robust Parsing: Support both HTML comments and explicit tags [[ACTION_DATA]]
                // We check for the explicit tag first as it's the new standard
                let actionDataJson = null;

                // Strategy 1: Explicit Tag [[ACTION_DATA]] JSON [[/ACTION_DATA]] or just to end
                const tagMatches = [...assistantMessage.matchAll(/\[\[ACTION_DATA\]\]([\s\S]*?)(\[\[\/ACTION_DATA\]\]|$)/g)];
                if (tagMatches.length > 0) {
                    actionDataJson = tagMatches[tagMatches.length - 1][1];
                }
                // Strategy 2: Legacy HTML Comment <!-- ACTION_DATA: ... -->
                else {
                    const matches = [...assistantMessage.matchAll(/<!--\s*ACTION_DATA:\s*([\s\S]*?)\s*-->/g)];
                    if (matches.length > 0) {
                        actionDataJson = matches[matches.length - 1][1];
                    }
                }

                if (actionDataJson) {
                    try {
                        let rawJson = actionDataJson.trim();

                        // Strip markdown code blocks if present (e.g., ```json ... ```) 
                        // Often models put ```json inside the comment or wrap the whole comment in ```
                        // We aggressive strip ```json and ```
                        rawJson = rawJson.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

                        // Handle case where model puts literal "json" at start without backticks
                        if (rawJson.startsWith("json")) rawJson = rawJson.substring(4).trim();

                        const parsed = JSON.parse(rawJson) as ActionData;
                        currentActionData = parsed;

                        // Update global timer if present
                        if (parsed.timer) {
                            console.log('[Timer] ✅ Setting activeTimer from ACTION_DATA:', parsed.timer);
                            console.log('[Timer] Current Time:', new Date().toISOString());
                            console.log('[Timer] Expires At:', parsed.timer.expiresAt);

                            // [V8.33] Merge extended info for HoldingStatusPanel
                            const extendedTimer = {
                                ...parsed.timer,
                                // 추가 정보가 parsed에 직접 있을 수 있음 (백엔드 응답 구조에 따라)
                                performanceName: parsed.timer.performanceName || (parsed as any).performanceName,
                                performanceDate: parsed.timer.performanceDate || (parsed as any).performanceDate,
                                seats: parsed.timer.seats || parsed.timer.heldSeats || (parsed as any).seats || (parsed as any).heldSeats,
                                totalPrice: parsed.timer.totalPrice || (parsed as any).totalPrice,
                                payUrl: parsed.timer.payUrl || (parsed as any).payUrl ||
                                    (parsed.actions?.find(a => a.id === 'pay')?.url),
                            };
                            setActiveTimer(extendedTimer);
                        } else {
                            console.warn('[Timer] ⚠️ ACTION_DATA found but NO timer field:', parsed);
                        }



                        // Handle Legacy Seat Map Refresh
                        if (parsed.type === 'HOLDING_CREATED' || parsed.type === 'HOLDING_RELEASED' || parsed.releasedHoldings) {
                            window.dispatchEvent(new Event('REFRESH_SEAT_MAP'));
                        }

                    } catch (e) { console.error("JSON parse error", e); }
                }

                setMessages((prev) => {
                    const newMessages = [...prev];
                    if (newMessages.length > 0) {
                        if (newMessages.length > 0) {
                            const lastMsg = newMessages[newMessages.length - 1];
                            if (lastMsg && lastMsg.role === "assistant") {
                                lastMsg.content = assistantMessage;
                                // Attach actions/timer to the message state
                                if (currentActionData) {
                                    lastMsg.actions = currentActionData.actions;
                                    lastMsg.timer = currentActionData.timer;
                                }
                            }
                        }
                    }
                    return newMessages;
                });
            }

        } catch (error) {
            console.error("Chat error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // V7.13: 액션 버튼 클릭 시 이전 버튼 제거
    const { handleAction } = useChatActions({
        sendMessage,
        onActionTriggered: () => {
            setMessages(prev => prev.map(m => ({
                ...m,
                actions: undefined
            })));
        }
    });

    const handleReset = () => {
        setMessages([]);
        setInput("");
        setActiveTimer(undefined);

        // [V8.2] 세션 관련 상태 완전 초기화
        setSessionExpired(false);
        setSessionWarningShown(false);
        setSessionWarning(null);
        setLastActivityTime(Date.now());

        // 새 세션 ID 생성
        const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSessionId(newId);
        console.log('[Chat] New session started (reset):', newId);
    };

    const getModelName = (id: string) => {
        return getModelById(id).name;
    };

    const handleTimerExpire = async () => {
        // [V8.4] Chatbot Timeout Cleanup (Sync with Web)
        if (activeTimer?.holdingId) {
            try {
                console.log('[Timer] Expired, deleting holding:', activeTimer.holdingId);
                await apiClient.deleteHolding(activeTimer.holdingId);
            } catch (e) {
                console.error('[Timer] Failed to delete holding on expire:', e);
            }
        }

        setActiveTimer(undefined);
        // [V7.11] 타이머 만료 시 모든 메시지의 버튼 제거
        setMessages(prev => prev.map(m => ({ ...m, actions: undefined })));
        setMessages(prev => [...prev, {
            role: "assistant",
            content: "선점 시간이 경과되어 예약이 취소 되었습니다. 다시 좌석을 선택해주세요."
        }]);
    };

    // [V8.33] 선점 취소 핸들러 (패널에서 호출)
    const handleHoldingCancel = async () => {
        if (activeTimer?.holdingId) {
            try {
                console.log('[HoldingPanel] Cancelling holding:', activeTimer.holdingId);
                await apiClient.deleteHolding(activeTimer.holdingId);
            } catch (e) {
                console.error('[HoldingPanel] Failed to cancel holding:', e);
            }
        }
        setActiveTimer(undefined);
        setMessages(prev => prev.map(m => ({ ...m, actions: undefined, timer: undefined })));
    };

    // Auto-scroll
    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
        }
    }, [messages, isLoading]);

    const formatTime = (isoString?: string) => {
        if (!isoString) return '--:--';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) {
                console.warn('[Timer] Invalid expiresAt:', isoString);
                return '--:--'; // Check for invalid date
            }
            let diff = Math.floor((date.getTime() - new Date().getTime()) / 1000);
            if (diff <= 0) return "0:00";

            // [V7.14] 방어 로직: 선점 시간은 최대 15분(900초)이므로 이를 초과하면 잘못된 값
            // 15분(900초) 이상이면 AI가 잘못된 expiresAt을 생성한 것으로 간주
            if (diff > 900) {
                console.warn('[Timer] expiresAt too far in future, likely AI error:', isoString, 'diff:', diff);
                diff = 60; // 60초로 강제 설정
            }

            return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
        } catch (e) {
            console.error("Error formatting time:", e);
            return '--:--';
        }
    };

    // Global timer tick for header
    const [headerTimeLeft, setHeaderTimeLeft] = useState("");
    useEffect(() => {
        if (!activeTimer) return;
        const interval = setInterval(() => {
            const t = formatTime(activeTimer.expiresAt);
            if (t === "0:00") handleTimerExpire(); // Trigger expire
            setHeaderTimeLeft(t);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeTimer]);

    // [V7.12] 세션 타임아웃 체크 - 5분 경고, 10분 종료
    useEffect(() => {
        if (messages.length === 0) return; // 대화 시작 전에는 체크 안 함

        const interval = setInterval(() => {
            const elapsed = Date.now() - lastActivityTime;

            // 10분(600초) 경과 → 세션 종료
            if (elapsed >= 10 * 60 * 1000 && !sessionExpired) {
                setSessionExpired(true);
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "⏰ 10분 동안 대화가 없어 세션이 종료되었습니다. 다시 대화하시려면 **새로고침** 버튼을 클릭해주세요."
                }]);
            }
            // [V8.2] 5분(300초) 경과 → 경고 (배너 UI로 표시)
            else if (elapsed >= 5 * 60 * 1000 && !sessionWarningShown && !sessionExpired) {
                setSessionWarningShown(true);
                setSessionWarning("⏰ 5분간 대화가 없을 경우 상담이 종료됩니다. 계속 대화하시려면 메시지를 입력해주세요.");
            }
        }, 10000); // 10초마다 체크

        return () => clearInterval(interval);
    }, [lastActivityTime, messages.length, sessionWarningShown, sessionExpired]);

    // [V8.2] 새 메시지 입력 시 타이머 리셋 + 배너 숨김
    const resetSessionTimer = () => {
        setLastActivityTime(Date.now());
        setSessionWarningShown(false);
        setSessionWarning(null);
    };


    return (
        <div className="w-full max-w-4xl h-full flex flex-col relative rounded-xl overflow-hidden shadow-2xl z-10">
            {/* Rotating Border Layer */}
            <div className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0deg,#FF6B35_120deg,#9F7AEA_180deg,#FF6B35_240deg,transparent_360deg)] animate-border-rotate" />

            <Card className="absolute inset-[4px] flex flex-col bg-white border-0 rounded-[10px] overflow-hidden shadow-inner p-0">
                <style jsx global>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 7px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #FF6B35; border-radius: 20px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #9F7AEA; }
                `}</style>

                <CardHeader className="relative border-b border-orange-100 flex flex-row items-center justify-between z-10 bg-orange-50 py-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-primary/20">
                            <AvatarImage src="/bot-avatar.png" />
                            <AvatarFallback className="bg-primary/10 text-primary"><Bot className="h-6 w-6" /></AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent font-bold text-xl">
                                Bedrock AI Agent
                            </CardTitle>
                            <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-1">
                                {runtimeModelInfo ? (
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Current: <span className="text-[10px] font-medium opacity-90">{runtimeModelInfo.name}</span>
                                        {runtimeModelInfo.isFallback && <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1 rounded">Fallback</span>}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Online <span className="text-[10px] opacity-70">• {getModelName(modelId)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={handleReset} className="rounded-full flex items-center gap-2 px-3" title="대화 초기화">
                            <RefreshCcw className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">새로고침</span>
                        </Button>
                        <ModelSelector value={modelId} onValueChange={setModelId} disabled={isLoading} />
                    </div>

                    {/* Header Timer Overlay (optional, synced with activeTimer) */}
                    {activeTimer && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300">
                            <div className="bg-red-500 text-white px-4 py-1.5 rounded-full shadow-md flex items-center gap-2 font-bold text-sm border-2 border-white ring-2 ring-red-100">
                                <Clock className="h-4 w-4 animate-pulse" />
                                <span>남은 시간 {headerTimeLeft}</span>
                            </div>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden relative z-10 flex flex-col bg-white">
                    {/* [V8.2] 세션 경고 배너 */}
                    {sessionWarning && (
                        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 mx-4 mt-2 text-sm rounded-r flex items-center gap-2">
                            <span>{sessionWarning}</span>
                            <button
                                onClick={() => setSessionWarning(null)}
                                className="ml-auto text-yellow-600 hover:text-yellow-800 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 pb-24 space-y-6 custom-scrollbar flex flex-col">
                        {/* [V7.9] Floating Badge for Runtime Model Info - Bottom Right (Stacked above Region) */}
                        {runtimeModelInfo && (
                            <div className="fixed bottom-14 right-5 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-500 flex flex-col items-end gap-1">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-xl border backdrop-blur-md transition-all hover:scale-105 ${runtimeModelInfo.isFallback
                                    ? "bg-yellow-50/95 border-yellow-300 text-yellow-900 ring-2 ring-yellow-100"
                                    : "bg-blue-50/95 border-blue-200 text-blue-900 ring-2 ring-blue-100"
                                    }`}>
                                    <div className={`p-1 rounded-full ${runtimeModelInfo.isFallback ? "bg-yellow-200" : "bg-blue-200"}`}>
                                        <Bot className="h-3 w-3" />
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[9px] uppercase tracking-wider opacity-70 font-semibold mb-0.5">Model</span>
                                        <span className="text-xs font-bold whitespace-nowrap">{runtimeModelInfo.name}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {messages.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center min-h-full">
                                <Bot className="h-16 w-16 mb-4 text-orange-500/80" />
                                <p className="text-2xl font-bold bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-text-shimmer pb-1">오늘 무엇을 도와드릴까요?</p>
                                <p className="text-sm text-foreground/80 mt-2">공연 추천, 예매 일정, 할인 혜택 등 무엇이든 물어보세요.</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <ChatMessage
                                key={idx}
                                role={msg.role}
                                content={msg.content}
                                actions={msg.actions}
                                timer={msg.timer}
                                onAction={handleAction}
                                onTimerExpire={handleTimerExpire}
                                isLast={idx === messages.length - 1}
                            />
                        ))}

                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8 bg-primary/10 border border-primary/20">
                                    <AvatarFallback><Bot className="h-4 w-4 text-primary" /></AvatarFallback>
                                </Avatar>
                                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 border border-white/10 shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="p-4 border-t border-orange-100 bg-white z-10">
                    <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2 w-full relative">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={sessionExpired ? "세션이 종료되었습니다. 새로고침을 클릭해주세요." : "메시지를 입력해 주세요..."}
                            disabled={isLoading || sessionExpired}
                            className={`flex-1 bg-white text-gray-900 border-orange-200 focus-visible:ring-orange-500 h-12 rounded-full px-6 shadow-sm placeholder:text-gray-400 transition-all border-2 focus:border-orange-500 ${sessionExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <Button
                            type="submit"
                            disabled={isLoading || !input.trim() || sessionExpired}
                            size="icon"
                            className={`h-12 w-12 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 hover:bg-primary/90 ${sessionExpired ? 'opacity-50' : ''}`}
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* [V8.33] 글로벌 선점 현황 패널 (팝업 스타일) */}
            <HoldingStatusPanel
                activeTimer={activeTimer ? {
                    holdingId: activeTimer.holdingId || '',
                    performanceName: (activeTimer as any).performanceName,
                    performanceDate: (activeTimer as any).performanceDate,
                    expiresAt: activeTimer.expiresAt,
                    seats: (activeTimer as any).seats || (activeTimer as any).heldSeats,
                    totalPrice: (activeTimer as any).totalPrice,
                    payUrl: (activeTimer as any).payUrl,
                    message: activeTimer.message,
                } : null}
                onCancel={handleHoldingCancel}
                onExpire={handleTimerExpire}
            />
        </div >
    );
}
