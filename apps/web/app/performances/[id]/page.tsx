
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, Info } from "lucide-react"


import { apiClient } from "@/lib/api-client"

export default async function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    let performance;
    try {
        performance = await apiClient.getPerformance(id)
    } catch {
        notFound()
    }

    if (!performance) {
        notFound()
    }



    // Check if booking is open (Example logic)
    // const now = new Date()
    // const openTime = new Date("2024-10-25T14:00:00") // Example hardcoded or fetch from DB
    // const isBookingOpen = true // Force open for demo

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <main className="flex-1">
                {/* Hero Section with Poster Background - Blurry */}
                <div className="relative w-full h-[450px] overflow-hidden bg-black">
                    {/* Background Image */}
                    <div className="absolute inset-0 opacity-40">
                        <Image
                            src={performance.posterUrl || performance.poster || ""}
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
                                    src={performance.posterUrl || performance.poster || ""}
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
                                        : (performance.dateRange || "일정 정보 없음")}
                                </div>
                                <div className="flex items-center text-gray-200 text-lg">
                                    <MapPin className="w-5 h-5 mr-2 text-primary" />
                                    {performance.venueId}
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
                                                {(performance.price || "").split(" / ").map((priceItem: string, idx: number) => {
                                                    const [grade, ...rest] = priceItem.trim().split(" ");
                                                    const cost = rest.join(" ");
                                                    let badgeColor = "bg-gray-500";
                                                    if (grade.includes("OP")) badgeColor = "bg-purple-600";
                                                    else if (grade.includes("VIP")) badgeColor = "bg-rose-500";
                                                    else if (grade.includes("R")) badgeColor = "bg-green-600";
                                                    else if (grade.includes("S")) badgeColor = "bg-blue-500";
                                                    else if (grade.includes("A")) badgeColor = "bg-yellow-500";

                                                    return (
                                                        <div key={idx} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-3 h-3 rounded-none ${badgeColor}`} />
                                                                <span className="font-medium text-gray-600">{grade}</span>
                                                            </div>
                                                            <span className="font-bold text-gray-900">{cost}</span>
                                                        </div>
                                                    );
                                                })}
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
