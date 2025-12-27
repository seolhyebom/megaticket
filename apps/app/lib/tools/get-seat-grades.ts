
import { getPerformance } from '../server/performance-service';
import { parsePriceString } from '../utils/price-parser';

// [V7.9.3.1] Fallback constants instead of missing imports
const CHARLOTTE_THEATER_NAME = "샤롯데씨어터";

interface GetSeatGradesParams {
    performanceId: string;
    scheduleId?: string;
}

export async function getSeatGrades(params: GetSeatGradesParams) {
    const { performanceId, scheduleId } = params;

    // Performance 정보 조회 (가격 정보용)
    const perf = await getPerformance(performanceId);
    if (!perf) {
        return { error: "해당 공연을 찾을 수 없습니다." };
    }

    // [V7.7] DB Single Source of Truth
    // 1. 가격 파싱 (문자열 -> 객체)
    const priceMap = parsePriceString(perf.price || "");

    // 2. 등급 메타데이터 조회
    const rawGrades = perf.seatGrades && perf.seatGrades.length > 0
        ? perf.seatGrades
        : []; // Fallback to empty if no grades

    // [V7.10] Emoji Mapping
    const EMOJI_MAP: Record<string, string> = {
        'OP': '🟣',
        'VIP': '🔴',
        'R': '🟠',
        'S': '🟡',
        'A': '🟢'
    };

    // 3. 메타데이터 + 실제 가격 + 색상 결합
    const mappedGrades = rawGrades.map(g => {
        const item = g as any;
        const gradePrice = priceMap[item.grade] || item.price || 0;
        const color = perf.seatColors?.[item.grade] || item.color;
        const emoji = EMOJI_MAP[item.grade] || '🎫';

        // [V7.9.3.1] DB 원본 가격 데이터 디버깅 로깅
        console.log(`[DB_PRICE_DEBUG] Performance: ${perf.title}, Grade: ${item.grade}, Price: ${gradePrice}`);

        // [V7.11] DB에서 description, location, features 가져오기
        return {
            grade: item.grade,
            price: gradePrice,
            color: color,
            emoji: emoji, // [V7.10]
            formattedPrice: `${gradePrice.toLocaleString()}원`, // 이중 방어용 필드
            description: item.description || "",
            location: item.location || "",
            features: item.features || []
        };
    });

    // 킹키부츠 등 OP석 우선 정렬 (V7.7 가이드)
    mappedGrades.sort((a: any, b: any) => {
        if (a.grade === 'OP') return -1;
        if (b.grade === 'OP') return 1;
        return 0;
    });

    return {
        performance: perf.title,
        venue: (perf as any).venue || CHARLOTTE_THEATER_NAME,
        grades: mappedGrades,
        _seatGrades: mappedGrades, // Metadata for frontend
        message: `${perf.title}의 좌석 등급 정보입니다.\n\n` +
            mappedGrades.map((g: any) => `${g.emoji} ${g.grade}석: ${g.formattedPrice}`).join('\n') +
            `\n\n선호하시는 좌석 등급이 있으신가요?`
    };
}
