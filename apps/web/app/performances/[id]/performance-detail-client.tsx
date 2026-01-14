'use client';

import { useEffect, useState, useRef } from 'react';
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, Info, Loader2 } from "lucide-react"
import { getApiUrl } from '@/lib/runtime-config';
import { usePerformanceId } from '@/lib/use-url-params';
import type { Performance } from '@mega-ticket/shared-types';

export default function PerformanceDetailClient() {
    // S3 Static Export 환경: useParams() 대신 URL에서 직접 ID 추출
    const id = usePerformanceId();
    const [performance, setPerformance] = useState<Performance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    // API 중복 호출 방지
    const hasFetched = useRef(false);

    // 하이드레이션 완료 감지
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        async function fetchPerformance() {
            // 하이드레이션 전이거나 ID가 없거나 이미 호출했으면 스킵
            if (!isHydrated || !id || hasFetched.current) return;

            hasFetched.current = true;  // 한 번만 실행
            setLoading(true);
            try {
                const apiUrl = getApiUrl();
                const res = await fetch(`${apiUrl}/api/performances/${id}`);
                if (!res.ok) {
                    throw new Error('Not found');
                }
                const data = await res.json();
                setPerformance(data);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }
        fetchPerformance();
    }, [id, isHydrated]);

    // 로딩 중 (하이드레이션 전 또는 데이터 로딩 중)
    if (!isHydrated || loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-gray-500 mt-4">공연 정보를 불러오는 중...</p>
            </div>
        );
    }

    // 에러 또는 데이터 없음
    if (error || !performance) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="text-6xl font-bold text-primary/20">404</h1>
                    <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">
                        공연을 찾을 수 없습니다
                    </h2>
                    <p className="text-gray-500 mb-6">
                        요청하신 공연 정보가 존재하지 않습니다.
                    </p>
                    <Link href="/">
                        <Button>홈으로 이동</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col animate-in fade-in duration-300">
            <main className="flex-1">
                {/* Hero Section with Poster Background - Blurry */}
                <div className="relative w-full h-[450px] overflow-hidden bg-black">
                    {/* Background Image */}
                    <div className="absolute inset-0 opacity-40">
                        <Image
                            src={performance.posterUrl || (performance as any).poster || ""}
                            alt={performance.title}
                            fill
                            className="object-cover blur-md"
                            priority
                        />
                    </div>

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                    {/* Content Container */}
                    <div className="container mx-auto px-4 md:px-8 max-w-7xl h-full relative z-10 flex items-center">
                        <div className="flex flex-col md:flex-row gap-8 items-end md:items-center">
                            {/* Poster Image */}
                            <div className="w-[180px] md:w-[260px] aspect-[3/4] relative rounded-lg shadow-2xl overflow-hidden border-2 border-white/20 flex-shrink-0">
                                <Image
                                    src={performance.posterUrl || (performance as any).poster || ""}
                                    alt={performance.title}
                                    fill
                                    className="object-cover"
                                />
                            </div>

                            {/* Text Info */}
                            <div className="text-white space-y-4 mb-4 md:mb-0">
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-600 text-white text-sm font-bold animate-pulse">
                                    <Clock className="w-4 h-4 mr-1" />
                                    예매중
                                </div>
                                <h1 className="text-4xl md:text-5xl font-bold leading-tight">{performance.title}</h1>
                                <div className="flex items-center text-gray-200 text-lg">
                                    <Calendar className="w-5 h-5 mr-2 text-primary" />
                                    {performance.dates && performance.dates.length > 0
                                        ? (performance.dates[0] + " ~ " + performance.dates[performance.dates.length - 1])
                                        : ((performance as any).dateRange || "일정 정보 없음")}
                                </div>
                                <div className="flex items-center text-gray-200 text-lg">
                                    <MapPin className="w-5 h-5 mr-2 text-primary" />
                                    {performance.venue || performance.venueId}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detail Content Section */}
                <div className="container mx-auto px-4 md:px-8 max-w-7xl py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* Left Column: Information */}
                        <div className="lg:col-span-2 space-y-10">
                            {/* Notice Card */}
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                                <h3 className="flex items-center text-orange-800 font-bold mb-3 text-lg">
                                    <Info className="w-5 h-5 mr-2" />
                                    예매 유의사항
                                </h3>
                                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                    <li>본 공연은 {performance.ageLimit || "전체 관람가"}입니다.</li>
                                    <li>티켓 수령은 공연 시작 1시간 30분 전부터 가능합니다.</li>
                                    <li>공연 당일 티켓 취소, 변경 및 환불이 불가능합니다.</li>
                                </ul>
                            </div>

                            {/* Performance Info */}
                            <section>
                                <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">공연 정보</h2>
                                <div className="prose max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
                                    {performance.description}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Sticky Booking Card */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-24 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                                <div className="bg-gray-900 text-white p-4 text-center font-bold text-lg">
                                    예매 가능 일정
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                            <span className="text-gray-500">관람 등급</span>
                                            <span className="font-medium text-gray-900">{performance.ageLimit || "전체 관람가"}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                            <span className="text-gray-500">관람 시간</span>
                                            <span className="font-medium text-gray-900">{performance.runtime || "150분"}</span>
                                        </div>
                                        <div className="space-y-2 pt-2">
                                            <span className="text-gray-500 block text-sm">티켓 가격</span>
                                            <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm text-gray-700">
                                                {/* seatGrades가 있으면 사용, 없으면 price 문자열 파싱 */}
                                                {(performance as any).seatGrades && (performance as any).seatGrades.length > 0 ? (
                                                    (performance as any).seatGrades.map((gradeInfo: any, idx: number) => {
                                                        // seatColors에서 색상 가져오기, 없으면 gradeInfo.color 사용
                                                        const gradeColor = ((performance as any).seatColors && (performance as any).seatColors[gradeInfo.grade]) || gradeInfo.color || '#888888';
                                                        return (
                                                            <div key={idx} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className="w-3 h-3 rounded-none"
                                                                        style={{ backgroundColor: gradeColor }}
                                                                    />
                                                                    <span className="font-medium text-gray-600">{gradeInfo.grade}석</span>
                                                                </div>
                                                                <span className="font-bold text-gray-900">{gradeInfo.price?.toLocaleString()}원</span>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    (performance.price || "").split(" / ").map((priceItem: string, idx: number) => {
                                                        const [grade, ...rest] = priceItem.trim().split(" ");
                                                        const cost = rest.join(" ");
                                                        let badgeColor = "#888888";
                                                        if (grade.includes("OP")) badgeColor = "#9E37D1";
                                                        else if (grade.includes("VIP")) badgeColor = "#FF0000";
                                                        else if (grade.includes("R")) badgeColor = "#FFA500";
                                                        else if (grade.includes("S")) badgeColor = "#1E90FF";
                                                        else if (grade.includes("A")) badgeColor = "#32CD32";

                                                        return (
                                                            <div key={idx} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-3 h-3 rounded-none" style={{ backgroundColor: badgeColor }} />
                                                                    <span className="font-medium text-gray-600">{grade}</span>
                                                                </div>
                                                                <span className="font-bold text-gray-900">{cost}</span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/performances/${performance.id}/booking`}
                                        className="block w-full"
                                    >
                                        <Button className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02]">
                                            예매하기
                                        </Button>
                                    </Link>

                                    <p className="text-xs text-center text-gray-400">
                                        * 예매 수수료 장당 2,000원이 부과됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
