import { Suspense } from "react";
import { ChatInterface } from "@/components/chat-interface";

export default function ChatPage() {
    return (
        <main className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-[#2D3748] to-[#1A202C]">
            {/* 배경 데코레이션 (Aurora Effects) */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />

            <div className="z-10 w-full flex justify-center h-full py-10">
                <Suspense fallback={<div className="text-white">로딩 중...</div>}>
                    <ChatInterface />
                </Suspense>
            </div>
        </main>
    );
}
