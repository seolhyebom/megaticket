"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

export function ConcertSection() {
    const concerts = [
        {
            id: "perf-bts-worldtour",
            title: "방탄소년단 MAP OF THE SOUL TOUR",
            venue: "잠실 종합운동장 주경기장",
            price: "220,000원",
            image: "/posters/bts.jpg",
            tag: "HOT"
        },
        {
            id: "perf-blackpink-worldtour",
            title: "블랙핑크 WORLD TOUR IN GOYANG",
            venue: "고양 종합운동장",
            price: "210,000원",
            image: "/posters/blackpink.jpg",
            tag: "HOT"
        },
        {
            id: "perf-day6-present",
            title: "DAY6 The Present",
            venue: "KSPO DOME",
            price: "150,000원",
            image: "/posters/day6.png",
            tag: "NEW"
        },
        {
            id: "perf-ive-showhave",
            title: "아이브 THE 1ST WORLD TOUR",
            venue: "KSPO DOME",
            price: "200,000원",
            image: "/posters/ive.png",
            tag: "NEW"
        }
    ]


    return (
        <section className="w-full space-y-6">
            <div className="flex items-center justify-between border-b-2 border-primary pb-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight">🎤 콘서트</h2>
                    <span className="text-sm text-primary font-medium">최고의 아티스트를 만나보세요</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {concerts.map((item) => (
                    <Link key={item.id} href={`/performances/${item.id}/`}>
                        <Card className="group relative overflow-hidden border-none shadow-md transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer">

                            <div className="relative aspect-[3/4] overflow-hidden">
                                {/* Badge - inside poster */}
                                <div className={`absolute top-3 left-3 z-10 text-xs font-bold px-2 py-1 rounded ${item.tag === 'HOT' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black'}`}>
                                    {item.tag}
                                </div>
                                <Image
                                    src={item.image}
                                    alt={item.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 25vw"
                                />
                                {/* Gradient overlay on hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>

                            <CardContent className="p-4 space-y-1.5 bg-white">
                                <h3 className="font-bold text-base line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-muted-foreground line-clamp-1">{item.venue}</p>
                            </CardContent>

                            <CardFooter className="p-4 pt-0 bg-white">
                                <span className="text-lg font-bold text-gray-900">{item.price}</span>
                            </CardFooter>
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    )
}
