import { Seat, validateAndCorrectSeatId } from '@mega-ticket/shared-types';
import { createHolding, releaseHolding, releaseHoldingsByUser } from '../server/holding-manager';
import { getPerformance, getSeatInfo } from '../server/performance-service';

export async function holdSeats(input: any) {
    const { performanceId, date, time, seatIds, seats, userId } = input;
    const targetSeats = seatIds || seats; // seatIds(V7.2) or seats(Old)

    // [V8.13 DEBUG] AI가 전달한 좌석 ID 상세 로깅
    console.log('========================================');
    console.log('[HOLD_SEATS] 🎫 AI가 전달한 입력값:');
    console.log(JSON.stringify({
        performanceId,
        date,
        time,
        seatIds: targetSeats,
        userId,
        timestamp: new Date().toISOString()
    }, null, 2));
    console.log('========================================');

    if (!targetSeats || !Array.isArray(targetSeats)) {
        return { error: "Invalid seat selection. Please provide a list of seat IDs." };
    }

    // [V8.13 DEBUG] 각 좌석 ID 파싱 결과 로깅
    console.log('[HOLD_SEATS] 전달된 좌석 수:', targetSeats.length);
    targetSeats.forEach((id: string, idx: number) => {
        const parts = id.split('-');
        console.log(`[HOLD_SEATS] 좌석 ${idx + 1}: ${id} → parts:`, parts);

        // [V8.17] seatId 유효성 검증: 로컬 번호가 너무 크면 AI가 잘못된 seatId를 사용한 것
        if (parts.length === 4) {
            const localNum = parseInt(parts[3]);
            if (localNum > 15) {
                console.warn(`⚠️ [HOLD_SEATS] 경고: 좌석 번호 ${localNum}이 비정상적으로 큽니다!`);
                console.warn(`   AI가 글로벌 번호(label의 18~21)를 seatId에 잘못 넣었을 수 있습니다.`);
                console.warn(`   올바른 seatId: recommendedOptions[N].seats 또는 _seatIdsForHoldSeats 배열을 사용하세요.`);
            }
        }
    });

    // V7.7: Fetch Performance first to get sections and grades
    let perf = null;
    try {
        perf = await getPerformance(performanceId);
    } catch (e) {
        console.error("Failed to fetch performance:", e);
    }
    const sections = perf?.sections || [];
    const seatGrades = perf?.seatGrades || [];

    // [V8.18] AI가 글로벌 번호를 seatId에 잘못 넣었으면 자동 변환
    const correctedSeats = seatIds.map((id: string) => {
        // @ts-ignore - SectionData 타입 호환성
        const validation = validateAndCorrectSeatId(id, sections);
        if (validation.needsConversion) {
            console.log(`✅ [HOLD_SEATS] seatId 자동 변환: ${id} → ${validation.correctedSeatId} (글로벌 ${validation.originalNumber} → 로컬 ${validation.correctedNumber})`);
            return validation.correctedSeatId;
        }
        return id;
    });

    // 변환된 좌석 ID 사용
    const finalSeatIds = correctedSeats;
    console.log('[HOLD_SEATS] 최종 seatIds (변환 후):', finalSeatIds);

    // V7.4 Optimization: Pre-calculate grades to fetch prices in batch
    const mappedInputs = finalSeatIds.map((id: string) => {
        const parts = id.split('-');
        const { grade } = getSeatInfo(id, sections); // Use dynamic sections
        return { id, parts, grade };
    });

    // Fetch grades once
    let priceMap = new Map();
    if (seatGrades && Array.isArray(seatGrades)) {
        priceMap = new Map(seatGrades.map((g: any) => [g.grade, g.price]));
    }

    const seatObjects: Seat[] = mappedInputs.map((item: any) => {
        const { id, parts, grade } = item;
        const { price: defaultPrice } = getSeatInfo(id, sections); // fallback 0
        const price = priceMap.get(grade) || defaultPrice || 0;

        if (parts.length === 4) {
            // 새 형식: 1층-B-OP-14 또는 1층-B-2-11
            const [floor, section, row, seatNum] = parts;
            return {
                seatId: id,
                seatNumber: parseInt(seatNum),
                number: parseInt(seatNum),
                rowId: row,
                row: row,
                grade: grade,
                price: price,
                status: 'holding'
            };
        } else {
            // 구 형식: A-5
            const [row, numStr] = parts;

            // [V8.3] 가격 누락 방지: ID 포맷이 맞지 않아 가격을 못 찾는 경우 방어
            if (price === 0) {
                console.warn(`[HOLDING] Price is 0 for seat ${id} (grade: ${grade}). This usually means Invalid Seat ID format.`);
            }

            return {
                seatId: id,
                seatNumber: parseInt(numStr),
                number: parseInt(numStr),
                rowId: row,
                row: row,
                grade: grade,
                price: price,
                status: 'holding'
            };
        }
    });

    // [V8.13 DEBUG] 최종 생성된 좌석 객체 로깅
    console.log('[HOLD_SEATS] 생성된 Seat 객체들:');
    seatObjects.forEach((seat, idx) => {
        console.log(`  ${idx + 1}. ${seat.seatId} | ${seat.grade}석 | ${seat.rowId}열 ${seat.seatNumber}번 | ${seat.price}원`);
    });

    // [V8.3] 가격 검증 로직 추가
    const invalidSeats = seatObjects.filter(s => s.price === 0);
    if (invalidSeats.length > 0) {
        const invalidIds = invalidSeats.map(s => s.seatId).join(', ');
        console.error(`[HOLDING] Rejected due to 0 price (Invalid IDs): ${invalidIds}`);
        return {
            success: false,
            error: `좌석 ID 형식이 올바르지 않아 가격 정보를 찾을 수 없습니다. (ID: ${invalidIds})`,
            message: "죄송합니다. 좌석 정보를 정확히 인식하지 못했습니다. **'1층 B구역 OP 7번'** 처럼 풀네임으로 다시 선택해주시겠어요? (시스템 로그: Invalid Seat ID)",
            _actions: [
                {
                    id: 'retry_seats_id',
                    label: '다른 좌석 다시 선택',
                    action: 'send',
                    text: '다른 좌석 보여줘',
                    style: 'primary'
                }
            ]
        };
    }

    const targetUserId = userId || 'mock-user-01';

    // [Fix] Auto-release any existing holdings for this user before creating a new one.
    const releasedIds = await releaseHoldingsByUser(targetUserId);
    if (releasedIds.length > 0) {
        console.log('[HOLD_SEATS] 이전 선점 해제됨:', releasedIds);
    }

    // [Robustness] Wait briefly to ensure file system sync and state propagation
    await new Promise(resolve => setTimeout(resolve, 500));

    // V7.20: venue, performanceTitle, posterUrl 파라미터 추가
    const venue = perf?.venue || '';
    const performanceTitle = perf?.title || '';
    const posterUrl = (perf as any)?.posterUrl || (perf as any)?.poster || '';

    // [COST_OPTIMIZATION] 로그 주석 처리
    /*
    console.log('[HOLD_SEATS] createHolding 호출 직전:', {
        performanceId,
        seatCount: seatObjects.length,
        seatIds: seatObjects.map(s => s.seatId),
        userId: targetUserId,
        date,
        time,
        venue,
        performanceTitle
    });
    */

    const result = await createHolding(performanceId, seatObjects, targetUserId, date, time, venue, performanceTitle, posterUrl);

    if (!result.success) {
        // [COST_OPTIMIZATION] 에러 로그는 유지하되 warn으로 조정
        console.warn('[HOLDING] Failed:', { error: result.error, unavailable: result.unavailableSeats });
        return {
            success: false,
            error: result.error || "좌석 선점에 실패했습니다.",
            // ... (생략)
            message: result.error === "일시적인 오류로 선점이 확인되지 않습니다. 잠시 후 다시 시도해주세요."
                ? "죄송합니다, 일시적인 시스템 오류로 선점 확인이 되지 않았습니다. 잠시 후 다시 시도해주시겠어요? 🙏"
                : `죄송합니다. ${result.unavailableSeats?.join(', ') || '선택하신 좌석'}이(가) 이미 선점 또는 예약 중입니다. 다른 좌석을 선택해주세요.`,
            unavailableSeats: result.unavailableSeats,
            releasedHoldings: releasedIds,
            _actions: [
                {
                    id: 'retry_seats',
                    label: '다른 좌석 선택',
                    type: 'message',
                    text: '다른 좌석 보여줘',
                    style: 'primary'
                }
            ]
        };
    }

    // [V8.13 DEBUG] 성공 로깅 -> [COST_OPTIMIZATION] 주석 처리
    // console.log('========================================');
    // console.log('[HOLD_SEATS] ✅ 선점 성공!');
    /*
    console.log(JSON.stringify({
        holdingId: result.holdingId,
        seatIds: seatObjects.map(s => s.seatId),
        totalPrice: seatObjects.reduce((sum, s) => sum + (s.price || 0), 0),
        expiresAt: result.expiresAt
    }, null, 2));
    */
    // console.log('========================================');

    // 만료 시간: 10분 후 (V7.22: 60초 → 600초)
    const expiresAt = result.expiresAt || new Date(Date.now() + 600 * 1000).toISOString();
    const expiresAtText = result.expiresAtText || new Date(Date.now() + 600 * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    const region = process.env.AWS_REGION || 'ap-northeast-2';
    const payUrl = `/reservation/confirm?holdingId=${result.holdingId}&expiresAt=${encodeURIComponent(expiresAt)}&region=${region}`;
    const seatMapUrlWithRegion = `/performances/${performanceId}/seats?date=${date}&time=${time}&region=${region}`;

    // [V8.6] AI가 바로 복사-붙여넣기할 수 있는 완전한 ACTION_DATA JSON
    const actionDataJson = JSON.stringify({
        timer: {
            expiresAt: expiresAt,
            holdingId: result.holdingId,
            message: "선점 시간",
            warningThreshold: 30
        },
        actions: [
            { id: "pay", label: "결제 진행", action: "navigate", url: payUrl, target: "_blank", style: "primary" },
            { id: "cancel", label: "선점 취소", action: "send", text: "선점 취소할래", style: "danger" },
            { id: "seat_map", label: "좌석 배치도 보기", action: "navigate", url: seatMapUrlWithRegion, target: "_blank", style: "default" }
        ]
    });

    return {
        success: true,
        holdingId: result.holdingId,
        expiresAt: expiresAt,
        expiresAtText: expiresAtText,
        releasedHoldings: releasedIds,
        // [V8.13] 선점된 좌석 정보 명시적 반환 (AI가 정확히 안내하도록)
        heldSeats: seatObjects.map(s => ({
            seatId: s.seatId,
            grade: s.grade,
            rowId: s.rowId,
            seatNumber: s.seatNumber,
            price: s.price
        })),
        totalPrice: seatObjects.reduce((sum, s) => sum + (s.price || 0), 0),
        seatMapUrl: `/performances/${performanceId}/seats?date=${date}&time=${time}`,
        message: `좌석이 선점되었습니다. 10분 내에 결제를 완료해주세요. (마감: ${expiresAtText})\n\n👉 [결제 완료하러 가기](${payUrl})`,

        _actionDataForResponse: `[[ACTION_DATA]]\n${actionDataJson}\n[[/ACTION_DATA]]`,

        _timer: {
            duration: 600,
            expiresAt: expiresAt,
            expiresAtText: expiresAtText,
            holdingId: result.holdingId
        },
        _actions: [
            {
                id: 'pay',
                label: '결제 진행하기',
                action: 'navigate',
                url: payUrl,
                target: '_blank',
                style: 'primary',
                data: { holdId: result.holdingId, seatIds: finalSeatIds }
            },
            {
                id: 'cancel',
                label: '선점 취소',
                action: 'send',
                text: '선점 취소할래',
                style: 'danger',
                data: { holdId: result.holdingId }
            }
        ],
    };
}

export async function cancelHold(input: any) {
    const { holdingId, holdId } = input;
    const targetId = holdId || holdingId;

    if (!targetId || typeof targetId !== 'string') {
        return { success: false, error: "Invalid holding ID" };
    }

    const result = await releaseHolding(targetId);

    if (result) {
        return {
            success: true,
            holdingId: targetId,
            message: "좌석 선점이 정상적으로 해제되었습니다."
        };
    } else {
        return {
            success: false,
            holdingId: targetId,
            message: "선점 ID를 찾을 수 없거나 이미 해제되었습니다."
        };
    }
}
