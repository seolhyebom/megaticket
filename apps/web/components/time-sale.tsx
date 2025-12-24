
"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"


export function TimeSale() {
    const [timeLeft, setTimeLeft] = useState("10:19:19")

    // Mock Timer Logic (Simple countdown for demo)
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date()
            // Set target to end of day
            const target = new Date(now)
            target.setHours(23, 59, 59, 999)

            const diff = target.getTime() - now.getTime()

            const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
            const m = Math.floor((diff / (1000 * 60)) % 60)
            const s = Math.floor((diff / 1000) % 60)

            setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    const sales = [
        {
            id: 1,
            title: "연극 <늘근도둑이야기>",
            venue: "대학로 아트포레스트 1관",
            discount: "70%",
            price: "15,000원",
            image: "/placeholder-sale1.jpg",
            tag: "타임세일"
        },
        {
            id: 2,
            title: "뮤지컬 <집이 없어>",
            venue: "서울숲 씨어터 2관",
            discount: "45%",
            price: "30,250원",
            image: "/placeholder-sale2.jpg",
            tag: "마감임박"
        },
        {
            id: 3,
            title: "뮤지컬 <이름 없는 약속들로부터>",
            venue: "극상 온(구 CJ아지트)",
            discount: "50%",
            price: "33,000원",
            image: "/placeholder-sale3.jpg",
            tag: "단독특가"
        },
        {
            id: 4,
            title: "뮤지컬 <EVITA>",
            venue: "광림아트센터 BBCH홀",
            discount: "50%",
            price: "30,000원",
            image: "/placeholder-sale4.jpg",
            tag: "타임세일"
        }
    ]

    return (
        <section className="w-full space-y-6">
            <div className="flex items-center justify-between border-b-2 border-primary pb-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight">⏰ 오늘의 타임세일</h2>
                    <div className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-red-600 font-mono font-bold">
                        <Clock className="w-4 h-4" />
                        <span>남은 시간 {timeLeft}</span>
                    </div>
                </div>
                <span className="text-sm text-gray-400">매일 오전 10시 새로운 특가!</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sales.map((item) => (
                    <Card key={item.id} className="group relative overflow-hidden border-none shadow transition-all hover:-translate-y-1 hover:shadow-lg">

                        {/* Discount Badge (Nol Interpark Style) */}
                        <div className="absolute top-0 left-0 z-10 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-br-lg shadow-md">
                            {item.tag}
                        </div>

                        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 group-hover:scale-105 transition-transform duration-500">
                                {/* Placeholder Image */}
                                Img
                            </div>
                        </div>

                        <CardContent className="p-4 space-y-2">
                            <h3 className="font-bold text-base line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1">{item.venue}</p>
                        </CardContent>

                        <CardFooter className="p-4 pt-0 flex items-end gap-2">
                            <span className="text-2xl font-extrabold text-red-500">{item.discount}</span>
                            <span className="text-lg font-bold text-gray-900">{item.price}</span>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </section>
    )
}
