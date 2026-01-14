import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HomeCarousel } from "@/components/home-carousel"
import { ConcertSection } from "@/components/concert-section"
import { ScrollToTop } from "@/components/scroll-to-top"



export default function Home() {
  const musicals = [
    { id: "perf-kinky-1", title: "킹키부츠", category: "뮤지컬", price: "170,000원", badge: "HOT", poster: "/posters/kinky-boots.png" },
    { id: "perf-phantom-of-the-opera-1", title: "오페라의 유령", category: "뮤지컬", price: "180,000원", badge: "HOT", poster: "/posters/opera.png" },
    { title: "레미제라블", category: "뮤지컬", price: "170,000원", badge: "NEW" },
    { title: "위키드", category: "뮤지컬", price: "160,000원", badge: "NEW" },
  ]

  const activities = [
    { title: "모나용평 팡팡 유니버스", category: "테마파크", discount: "", price: "20,000원", badge: "HOT" },
    { title: "코코컬쳐클럽 일출 페스티벌", category: "관광/입장권", discount: "50%", price: "15,000원", badge: "NEW" },
    { title: "하이원 스키캠프", category: "레저/스포츠", discount: "", price: "5,000원", badge: "" },
    { title: "아쿠아플라넷(일산)", category: "테마파크", discount: "", price: "6,000원", badge: "" },
  ]

  const exhibitions = [
    { title: "빛의 시어터 <파라오의 이집트>", category: "전시", discount: "37%", price: "9,500원", badge: "" },
    { title: "빛의 벙커 <칸딘스키>", category: "전시", discount: "45%", price: "6,000원", badge: "" },
    { title: "사랑의 단상", category: "전시", discount: "30%", price: "7,000원", badge: "" },
    { title: "빈센트 발 : SHADOWGRAM", category: "전시", discount: "20%", price: "12,000원", badge: "" },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">

      {/* Hero Slider Section (Full Width) */}
      <HomeCarousel />

      {/* Main Content Container (Centered) */}
      <div className="container mx-auto max-w-7xl px-4 md:px-8 space-y-16 -mt-8 relative z-30">

        {/* Time Sale Section */}
        <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 animate-in slide-in-from-bottom duration-700">
          <ConcertSection />
        </div>

        {/* Section: Musicals */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">🎭 뮤지컬</h2>
            <Button variant="ghost" className="text-muted-foreground hover:text-primary">더보기 &gt;</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {musicals.map((item, idx) => (
              <SimpleCard key={idx} item={item} />
            ))}
          </div>
        </section>

        {/* Section: Activities */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">🎡 액티비티</h2>
            <Button variant="ghost" className="text-muted-foreground hover:text-primary">더보기 &gt;</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activities.map((item, idx) => (
              <SimpleCard key={idx} item={item} />
            ))}
          </div>
        </section>

        {/* Section: Exhibitions (Pink Background like ref) */}
        <section className="rounded-3xl bg-rose-50 p-8 md:p-12 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">🎨 전시회</h2>
              <p className="text-rose-500 font-medium">예술의 다양성과 아름다움을 즐겨요</p>
            </div>
            <Button variant="ghost" className="text-rose-600 hover:text-rose-800 hover:bg-rose-100">전체보기 &gt;</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {exhibitions.map((item, idx) => (
              <SimpleCard key={idx} item={item} bgWhite />
            ))}
          </div>
        </section>

      </div>

      <ScrollToTop />
    </div>
  )
}

interface SimpleCardItem {
  id?: string;
  title: string;
  category: string;
  discount?: string;
  price: string;
  badge?: string;
  poster?: string;
}

function SimpleCard({ item, bgWhite = false }: { item: SimpleCardItem, bgWhite?: boolean }) {
  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (item.id) {
      // Use Next.js Link instead of a tag
      return <Link href={`/performances/${item.id}`} className="block">{children}</Link>
    }
    return <>{children}</>
  }

  return (
    <CardWrapper>
      <Card className={`group border-none shadow-none hover:bg-transparent cursor-pointer ${bgWhite ? 'bg-white/70 backdrop-blur-sm' : 'bg-transparent'}`}>
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-200 mb-3 shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1">
          {item.badge && (
            <div className={`absolute top-3 left-3 z-10 ${item.badge === 'HOT' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black'} text-xs font-bold px-2 py-1 rounded`}>
              {item.badge}
            </div>
          )}
          {item.poster ? (
            <Image
              src={item.poster}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-white/50">
              Image
            </div>
          )}
        </div>
        <div className="space-y-1.5 px-1">
          <p className="text-xs text-muted-foreground font-medium">{item.category}</p>
          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <div className="flex items-center gap-2 pt-1">
            {item.discount && <span className="text-xl font-bold text-red-500">{item.discount}</span>}
            <span className="text-lg font-bold text-gray-900">{item.price}</span>
          </div>
        </div>
      </Card>
    </CardWrapper>
  )
}
