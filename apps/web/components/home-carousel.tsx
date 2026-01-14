"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import Autoplay from "embla-carousel-autoplay"

export function HomeCarousel() {
    const plugin = React.useRef(
        Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
    )

    const slides = [
        {
            title: "MEGA TICKET GRAND OPEN",
            subtitle: "모든 공연의 시작, 메가티켓에서 만나보세요",
            bg: "bg-gradient-to-r from-violet-600 to-indigo-600",
            cta: "자세히 보기"
        },
        {
            title: "2026 시즌 뮤지컬 <시카고>",
            subtitle: "전 세계를 사로잡은 매혹적인 재즈의 선율",
            bg: "bg-gradient-to-r from-rose-600 to-pink-600",
            cta: "예매하기"
        },
        {
            title: "싸이 흠뻑쇼 2026",
            subtitle: "무더위를 날려버릴 최고의 퍼포먼스",
            bg: "bg-gradient-to-r from-blue-600 to-cyan-600",
            cta: "티켓 오픈"
        }
    ]

    return (
        <div className="w-full relative group">
            <Carousel
                plugins={[plugin.current]}
                className="w-full"
                opts={{
                    loop: true,
                }}
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
            >
                <CarouselContent>
                    {slides.map((slide, index) => (
                        <CarouselItem key={index}>
                            <div className="p-1">
                                <Card className="border-none shadow-none">
                                    <CardContent className={`flex h-[480px] md:h-[560px] items-center justify-center rounded-xl p-6 ${slide.bg} text-white relative overflow-hidden`}>
                                        <div className="absolute inset-0 bg-black/10" />
                                        <div className="relative z-10 text-center space-y-4">
                                            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">
                                                {slide.title}
                                            </h2>
                                            <p className="text-lg md:text-xl text-white/90 font-medium mb-6">
                                                {slide.subtitle}
                                            </p>
                                            <Button size="lg" variant="secondary" className="font-bold text-primary hover:bg-white/90">
                                                {slide.cta}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="left-4 h-14 w-14 border-2 border-white/30 bg-black/20 text-white hover:bg-black/40 hover:border-white [&>svg]:h-8 [&>svg]:w-8 transition-all" />
                <CarouselNext className="right-4 h-14 w-14 border-2 border-white/30 bg-black/20 text-white hover:bg-black/40 hover:border-white [&>svg]:h-8 [&>svg]:w-8 transition-all" />
            </Carousel>
        </div>
    )
}
