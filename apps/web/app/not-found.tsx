'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
            <div className="text-center">
                {/* 404 숫자 */}
                <h1 className="text-9xl font-bold text-primary/20 select-none">404</h1>

                {/* 메시지 */}
                <h2 className="text-2xl font-bold text-gray-900 mt-4 mb-2">
                    페이지를 찾을 수 없습니다
                </h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    요청하신 페이지가 존재하지 않거나, 이동되었을 수 있습니다.
                    <br />
                    주소를 다시 확인해주세요.
                </p>

                {/* 버튼 그룹 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        variant="outline"
                        onClick={() => window.history.back()}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        이전 페이지
                    </Button>
                    <Link href="/">
                        <Button className="gap-2 w-full sm:w-auto">
                            <Home className="w-4 h-4" />
                            홈으로 이동
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
