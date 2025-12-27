
export interface SeatRecommendation {
    seats: string[];      // ["1층-B-7-14", "1층-B-7-15"]
    grade: string;
    price: number;
    description: string;
    priority: 'best' | 'value' | 'economy';
}

/**
 * 중앙 좌석 번호 계산
 * 총 좌석 수의 정중앙을 기준으로 좌우 번호를 계산하여 반환
 */
export function getCenterSeats(seatsPerRow: number, count: number): number[] {
    // 실제 좌석 번호가 1부터 시작한다고 가정
    const center = Math.floor((seatsPerRow + 1) / 2);
    const half = Math.floor(count / 2);
    let start = center - half;

    // 짝수이면서 count가 짝수일 때, 혹은 조정이 필요할 때의 보정 로직
    // 여기서는 단순화하여 시작점 계산 (범위가 1보다 작으면 1로 보정)
    if (start < 1) start = 1;
    const end = start + count - 1;
    if (end > seatsPerRow) start = Math.max(1, seatsPerRow - count + 1);

    return Array.from({ length: count }, (_, i) => start + i);
}

/**
 * 좌석 문자열 파싱 (예: "1층-B-7-14")
 */
function parseSeatId(seatId: string) {
    const parts = seatId.split('-');
    return {
        floor: parts[0],      // 1층
        section: parts[1],    // B
        row: parseInt(parts[2]), // 7
        number: parseInt(parts[3]) // 14
    };
}

/**
 * 다수 인원 좌석 배치 추천 (간소화된 로직)
 * 실제로는 가용 좌석 데이터를 기반으로 연속석을 찾아야 함
 */
export function recommendGroupSeats(
    availableSeats: any[], // 가용 좌석 객체 배열 (id, price, grade 등 포함)
    groupSize: number,
    preference: 'together' | 'split' | 'any' = 'together'
): SeatRecommendation[] {
    // 1. 그룹핑: 구역+열 기준으로 좌석을 그룹핑
    const rowsMap = new Map<string, any[]>();

    availableSeats.forEach(seat => {
        const parsed = parseSeatId(seat.id);
        const key = `${parsed.floor}-${parsed.section}-${parsed.row}`;

        if (!rowsMap.has(key)) {
            rowsMap.set(key, []);
        }
        rowsMap.get(key)?.push({ ...seat, number: parsed.number });
    });

    const recommendations: SeatRecommendation[] = [];

    // 2. 각 라인에서 연속석 찾기
    for (const [key, seats] of rowsMap.entries()) {
        // 번호순 정렬
        seats.sort((a, b) => a.number - b.number);

        let consecutive: any[] = [];
        for (let i = 0; i < seats.length; i++) {
            // 이전 좌석과 번호가 1 차이나면 연속
            if (consecutive.length === 0) {
                consecutive.push(seats[i]);
            } else if (seats[i].number === consecutive[consecutive.length - 1].number + 1) {
                consecutive.push(seats[i]);
            } else {
                // 끊김 -> 초기화
                consecutive = [seats[i]];
            }

            // 원하는 인원수만큼 모이면 추천 목록에 추가
            if (consecutive.length === groupSize) {
                const seatsList = consecutive.map(s => s.id);
                const grade = consecutive[0].grade;
                const price = consecutive[0].price;

                // 우선순위 결정 (VIP > R > S > A)
                let priority: 'best' | 'value' | 'economy' = 'value';
                if (grade === 'VIP' || grade === 'R') priority = 'best';
                else if (grade === 'S') priority = 'value';
                else priority = 'economy';

                recommendations.push({
                    seats: seatsList,
                    grade: grade,
                    price: price,
                    description: `${key}구역 연속 ${groupSize}석`,
                    priority
                });

                // 다른 조합을 찾기 위해 리셋하지 않고 계속 진행할 수도 있으나, 
                // 여기서는 심플하게 한 라인에서 여러 조합이 나올 수 있도록 함.
                // 다만 중복 추천 방지를 위해 연속된 다음 세트로 넘어가는 로직이 필요할 수 있음.
                // 일단은 하나 찾으면 sliding window 처럼 다음 인덱스로 진행.
                consecutive.shift();
            }
        }
    }

    // 3. 우선순위 정렬 (Best > Value > Economy)
    recommendations.sort((a, b) => {
        const priorityScore = { best: 3, value: 2, economy: 1 };
        return priorityScore[b.priority] - priorityScore[a.priority];
    });

    return recommendations.slice(0, 5); // 상위 5개 추천
}
