"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, RefreshCcw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { ModelSelector } from "@/components/model-selector";

interface Message {
    role: "user" | "assistant";
    content: string;
}

type ActionData =
    | {
        type: "HOLDING_CREATED";
        holdingId: string;
        expiresAt: string;
        remainingMs?: number;
        seatMapUrl?: string;
    }
    | {
        type: "HOLDING_RELEASED";
        holdingId?: string; // Optional for released
        expiresAt?: string;
        remainingMs?: number;
    };

import { useAuth } from "@/contexts/auth-context";

export function ChatInterface() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [modelId, setModelId] = useState("anthropic.claude-3-5-sonnet-20240620-v1:0");
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [activeHolding, setActiveHolding] = useState<ActionData | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    const getModelName = (id: string) => {
        if (id.includes("nova-lite")) return "Amazon Nova Lite";
        if (id.includes("nova-micro")) return "Amazon Nova Micro";
        if (id.includes("sonnet-4-5")) return "Claude 4.5 Sonnet";
        if (id.includes("sonnet")) return "Claude 3.5 Sonnet";
        return "AI Model";
    };

    const handleReset = () => {
        setMessages([]);
        setInput("");
        setActiveHolding(null);
        setTimeLeft(0);
    };

    // Timer Logic
    useEffect(() => {
        if (!activeHolding) return;

        const tick = () => {
            if (!activeHolding.expiresAt) return;
            const now = new Date().getTime();
            const end = new Date(activeHolding.expiresAt).getTime();
            const diff = Math.floor((end - now) / 1000);

            if (diff <= 0) {
                setTimeLeft(0);
                setActiveHolding(null);

                // Add system message for expiration
                setMessages(prev => [...prev, {
                    role: "assistant", // Using assistant role for system alert
                    content: "선점 시간이 경과되어 예약이 취소 되었습니다."
                }]);
            } else {
                setTimeLeft(diff);
            }
        };

        // Run immediately
        tick();

        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [activeHolding]);

    // Track processed actions to prevent duplicate execution/events during streaming
    const processedActionsRef = useRef<{ idx: number; set: Set<string> }>({ idx: -1, set: new Set() });

    // Parse Metadata from Assistant Messages
    useEffect(() => {
        if (messages.length === 0) return;

        const lastIdx = messages.length - 1;
        const lastMsg = messages[lastIdx];

        // Reset processed set if we moved to a new message
        if (processedActionsRef.current.idx !== lastIdx) {
            processedActionsRef.current = { idx: lastIdx, set: new Set() };
        }

        if (lastMsg.role === 'assistant') {
            // Find ALL action data blocks using matchAll to handle multiple actions (e.g. Release -> Create)
            const matches = [...lastMsg.content.matchAll(/<!-- ACTION_DATA: ([\s\S]*?) -->/g)];

            if (matches.length > 0) {
                try {
                    // Iterate and process all actions found in the message
                    matches.forEach(match => {
                        const jsonStr = match[1];

                        // Deduplication: Skip if already processed for this message
                        if (processedActionsRef.current.set.has(jsonStr)) return;

                        // Mark as processed
                        processedActionsRef.current.set.add(jsonStr);

                        const data = JSON.parse(jsonStr) as ActionData;

                        if (data.type === 'HOLDING_CREATED' && data.holdingId && data.expiresAt) {
                            if (data.remainingMs) {
                                const localExpiresAt = new Date(new Date().getTime() + data.remainingMs).toISOString();
                                data.expiresAt = localExpiresAt;
                            }

                            // Always update if it's a create event
                            setActiveHolding(data);
                            window.dispatchEvent(new Event('REFRESH_SEAT_MAP'));

                        } else if (data.type === 'HOLDING_RELEASED') {
                            // Conditional Release: Only clear if it matches current holding or current is null
                            setActiveHolding(prev => {
                                if (!prev) return null; // Already empty

                                // Robust check: only release if ID matches. 
                                if (data.holdingId && prev.holdingId !== data.holdingId) {
                                    // This release event is for a DIFFERENT holding (e.g. the previous one).
                                    // So we Do NOT clear the *current* (new) one.
                                    return prev;
                                }
                                return null; // Clear it
                            });

                            window.dispatchEvent(new Event('REFRESH_SEAT_MAP'));
                        }
                    });

                } catch (e) {
                    console.error("Failed to parse action data", e);
                }
            }
        }
    }, [messages]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => setActiveHolding(null);
    }, []);

    // Auto-scroll to bottom using scrollTop to prevent layout shifts
    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
        }
    }, [messages, isLoading]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        // If action button clicked (confirm/cancel), clear timer immediately to give feedback
        if (activeHolding && (text.includes("예약 확정") || text.includes("취소"))) {
            setActiveHolding(null);
        }

        const userMessage: Message = { role: "user", content: text };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const apiMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: [{ text: m.content }]
            }));

            const response = await apiClient.chat(apiMessages, modelId, user?.id);

            if (!response.ok) throw new Error("Failed to send message");
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = "";

            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessage += chunk;

                setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === "assistant") {
                        lastMsg.content = assistantMessage;
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleActionClick = (action: string) => {
        const msg = action === 'confirm' ? '예약 확정해줘' : '예약 취소할래';
        sendMessage(msg);
    };

    return (
        <div className="w-full max-w-4xl h-full flex flex-col relative rounded-xl overflow-hidden shadow-2xl z-10">
            {/* Rotating Border Layer - Wave Effect (Transparent -> Color -> Transparent) */}
            <div className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0deg,#FF6B35_120deg,#9F7AEA_180deg,#FF6B35_240deg,transparent_360deg)] animate-border-rotate" />




            {/* Main Content Layer (inset by 4px to show thicker border) */}
            <Card className="absolute inset-[4px] flex flex-col bg-white border-0 rounded-[10px] overflow-hidden shadow-inner p-0">
                {/* Custom Scrollbar Styles */}
                <style jsx global>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 7px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background-color: #FF6B35; /* MegaTicket Primary Orange */
                        border-radius: 20px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background-color: #9F7AEA; /* Bedrock Purple */
                    }
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
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Online • {getModelName(modelId)}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="text-gray-600 hover:text-orange-600 hover:bg-white bg-white/80 border-orange-200 shadow-sm rounded-full flex items-center gap-2 px-3"
                            title="대화 초기화"
                        >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">새로고침</span>
                        </Button>
                        <ModelSelector value={modelId} onValueChange={setModelId} disabled={isLoading} />
                    </div>

                    {/* Timer Overlay (Centered in Header) */}
                    {activeHolding && timeLeft > 0 && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300">
                            <div className="bg-red-500 text-white px-4 py-1.5 rounded-full shadow-md flex items-center gap-2 font-bold text-sm border-2 border-white ring-2 ring-red-100">
                                <Clock className="h-4 w-4 animate-pulse" />
                                <span>남은 시간 {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
                            </div>
                        </div>
                    )}

                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden relative z-10 flex flex-col bg-white">
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col"
                    >
                        {messages.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center min-h-full">
                                <Bot className="h-16 w-16 mb-4 text-orange-500/80" />
                                <p className="text-2xl font-bold bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-text-shimmer pb-1">오늘 무엇을 도와드릴까요?</p>
                                <p className="text-sm text-foreground/80 mt-2">공연 추천, 예매 일정, 할인 혜택 등 무엇이든 물어보세요.</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex items-start gap-3",
                                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                <Avatar className={cn(
                                    "h-8 w-8 mt-1 border",
                                    msg.role === "user"
                                        ? "bg-secondary border-white/10"
                                        : "bg-primary/10 border-primary/20"
                                )}>
                                    <AvatarFallback className="text-xs">
                                        {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex flex-col max-w-[80%] items-start">
                                    <div
                                        className={cn(
                                            "rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed w-full",
                                            msg.role === "user"
                                                ? "bg-orange-500 text-white rounded-tr-sm shadow-md"
                                                : "bg-gray-100 text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm font-medium"
                                        )}
                                    >
                                        <div className="whitespace-pre-wrap break-words">
                                            {/* Hide raw metadata from view */}
                                            {msg.content.replace(/<!-- ACTION_DATA: [\s\S]*? -->/g, '').trim()}
                                        </div>
                                    </div>

                                    {/* Action Buttons for Assistant */}
                                    {msg.role === 'assistant' && idx === messages.length - 1 && (
                                        <>
                                            {/* Holding Actions (Confirm/Cancel) */}
                                            {activeHolding && timeLeft > 0 && /<!-- ACTION_DATA: [\s\S]*?"type":\s*"HOLDING_CREATED"[\s\S]*?-->/.test(msg.content) && (
                                                <div className="mt-2 ml-1 flex gap-2 animate-in fade-in slide-in-from-top-2">
                                                    <Button
                                                        onClick={() => handleActionClick('confirm')}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs px-4 rounded-full shadow-sm"
                                                    >
                                                        예약 확정
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleActionClick('cancel')}
                                                        variant="outline"
                                                        className="h-8 text-xs border-orange-200 text-orange-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-4 rounded-full bg-white transition-colors"
                                                    >
                                                        예약 취소
                                                    </Button>
                                                    {activeHolding.type === 'HOLDING_CREATED' && activeHolding.seatMapUrl && (
                                                        <Button
                                                            asChild
                                                            variant="outline"
                                                            className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 px-4 rounded-full bg-white transition-colors"
                                                        >
                                                            <a href={activeHolding.seatMapUrl} target="_blank" rel="noopener noreferrer">
                                                                좌석 배치도 보기
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Reservation Confirmed Link */}
                                            {/<!-- ACTION_DATA: [\s\S]*?"type":\s*"RESERVATION_CONFIRMED"[\s\S]*?-->/.test(msg.content) && (
                                                <div className="mt-2 ml-1 animate-in fade-in slide-in-from-top-2">
                                                    <Button
                                                        asChild
                                                        className="bg-green-600 hover:bg-green-700 text-white h-9 text-xs px-5 rounded-full shadow-sm font-semibold"
                                                    >
                                                        <a href="/my">
                                                            내 예약 확인하기
                                                        </a>
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8 bg-primary/10 border border-primary/20">
                                    <AvatarFallback><Bot className="h-4 w-4 text-primary" /></AvatarFallback>
                                </Avatar>
                                <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 border border-white/10 shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Identifying...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="p-4 border-t border-orange-100 bg-white z-10">
                    <form onSubmit={handleSubmit} className="flex gap-2 w-full relative">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="메시지를 입력해 주세요..."
                            disabled={isLoading}
                            className="flex-1 bg-white text-gray-900 border-orange-200 focus-visible:ring-orange-500 h-12 rounded-full px-6 shadow-sm placeholder:text-gray-400 transition-all border-2 focus:border-orange-500"
                        />
                        <Button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            size="icon"
                            className="h-12 w-12 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 hover:bg-primary/90"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}
