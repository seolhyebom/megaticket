"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Clock } from "lucide-react"

export default function PerformanceDetailPage() {
    const params = useParams()
    const id = params.id

    // Mock Data - In real app, fetch execution
    const performance = {
        id: id,
        title: "오페라의 유령 (The Phantom of the Opera)",
        image: "/placeholder.jpg",
        date: "2024.12.25",
        time: "19:00",
        venue: "Mega Arts Center - Grand Theater",
        description: "전 세계를 매혹시킨 불멸의 명작! 브로드웨이 최장기 공연 기네스북 등재.",
        price: "VIP 150,000원 / R 120,000원 / S 90,000원"
    }

    return (
        <div className="container mx-auto px-4 py-6 max-w-6xl">
            <div className="grid md:grid-cols-2 gap-8 h-full">
                {/* Image Section */}
                <div className="relative aspect-[4/5] md:aspect-auto md:h-[600px] w-full bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center text-gray-500 shadow-md">
                    {/* In a real app, use next/image with object-cover */}
                    <span className="text-lg">Poster Image</span>
                </div>

                {/* Info Section */}
                <div className="flex flex-col h-full md:h-[600px] py-2">
                    <div>
                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm font-bold rounded-full mb-3">
                            뮤지컬
                        </span>
                        <h1 className="text-3xl font-bold mb-3 tracking-tight">{performance.title}</h1>
                        <p className="text-muted-foreground leading-relaxed text-sm lg:text-base mb-6">
                            {performance.description}
                        </p>
                    </div>

                    <div className="space-y-4 border-t border-b py-5">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">{performance.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">{performance.time}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">{performance.venue}</span>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg mt-4">
                        <h3 className="font-bold mb-1 text-sm text-gray-700">티켓 가격</h3>
                        <p className="text-sm text-gray-600 font-medium">{performance.price}</p>
                    </div>

                    <div className="mt-auto pt-6">
                        <Link href={`/performances/${id}/seats?date=2024-12-25&time=19:00`} className="block">
                            <Button size="lg" className="w-full text-lg h-14 font-bold shadow-lg transition-transform hover:scale-[1.02]">
                                예매하기
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
