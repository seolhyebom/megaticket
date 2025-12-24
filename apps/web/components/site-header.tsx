"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Search, Menu, User, Ticket } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"

export function SiteHeader() {

    const [isScrolled, setIsScrolled] = useState(false)
    const { user, logout } = useAuth()

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <header className={cn(
            "sticky top-0 z-50 w-full transition-all duration-300",
            isScrolled ? "bg-white/80 backdrop-blur-md border-b shadow-sm" : "bg-transparent"
        )}>
            <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-center gap-8 md:gap-16">
                {/* Logo & Nav Group - Centered relative to screen with Search */}
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="font-bold text-xl md:text-2xl tracking-tight text-primary">
                            MegaTicket
                        </span>
                    </Link>
                    <nav className="hidden md:flex gap-4 lg:gap-6">
                        {[
                            { label: "뮤지컬", href: "#" },
                            { label: "콘서트", href: "#" },
                            { label: "연극", href: "#" },
                            { label: "클래식/무용", href: "#" },
                            { label: "스포츠", href: "#" },
                            { label: "전시/행사", href: "#" },
                            { label: "AI 챗봇", href: "/chat", className: "text-purple-600 font-bold hover:text-purple-700" }
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary whitespace-nowrap",
                                    item.className ? item.className : "text-muted-foreground"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>


                {/* Right Side Group */}
                <div className="flex items-center gap-3">
                    <div className="relative hidden lg:block">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            type="search"
                            placeholder="공연, 전시장, 인물로 검색해보세요"
                            className="pl-9 w-[340px] bg-gray-100 border-gray-200 focus-visible:ring-1 focus-visible:ring-primary rounded-full transition-all hover:bg-white hover:shadow-sm"
                        />
                    </div>

                    <div className="flex items-center">
                        {user ? (
                            <>
                                <span className="text-sm font-medium mr-2 hidden md:block text-muted-foreground">
                                    {user.name}님
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => logout()}
                                    className="hidden md:flex gap-2 text-muted-foreground hover:text-gray-900 hover:bg-transparent"
                                >
                                    <span className="font-medium">로그아웃</span>
                                </Button>
                                <Link href="/my">
                                    <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-muted-foreground hover:text-gray-900 hover:bg-transparent">
                                        <Ticket className="h-5 w-5" />
                                        <span className="font-medium">내 예약</span>
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <Link href="/login">
                                <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-muted-foreground hover:text-gray-900 hover:bg-transparent">
                                    <User className="h-5 w-5" />
                                    <span className="font-medium">로그인</span>
                                </Button>
                            </Link>
                        )}
                    </div>

                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Menu</span>
                    </Button>
                </div>
            </div>
        </header >
    )
}
