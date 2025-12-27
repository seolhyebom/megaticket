/**
 * V7.7: 가격 문자열 파싱 유틸리티 (Server Side)
 * "OP석 190,000원 / VIP석 170,000원" -> { [grade]: price }
 */
export function parsePriceString(priceStr: string): Record<string, number> {
    if (!priceStr) return {};
    const prices: Record<string, number> = {};
    // 구분자: , 또는 / (단, 숫자 사이의 컴마는 제외)
    // "등급1/등급2 170,000원" 같은 패턴을 처리하기 위해 먼저 / 나 , 로 나눕니다.
    const segments = priceStr.split(/\s+[\/,]\s+/);

    // split 패턴이 복잡할 수 있으므로, 명시적으로 "원" 또는 "숫자" 뒤의 구분자로 나눕니다.
    const parts = priceStr.split(/(?<=원|[\d,])\s*[\/,]\s*/);

    parts.forEach(seg => {
        // "등급명 [석] [가격] [원]" 패턴 매칭
        // 예: "VIP/OP석 170,000원", "R 120,000", "S석 90,000원"
        // [V7.9.3.1] 가격 자릿수 검증 ({4,}) 추가하여 170원 등의 오류 방지
        const match = seg.trim().match(/^(.+?)(?:석)?\s*([\d,]{4,})\s*(?:원)?/);
        if (match) {
            const rawGrades = match[1].trim();
            const price = parseInt(match[2].replace(/,/g, ''), 10);

            // "VIP/OP" 처럼 묶인 경우 분리
            const gradeList = rawGrades.split(/[\/,]/).map(g => g.trim());
            gradeList.forEach(grade => {
                if (grade) prices[grade] = price;
            });
        }
    });

    return prices;
}
