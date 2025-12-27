
/**
 * V7.6 응답 필터링 시스템
 * 
 * 목적: 내부 데이터/태그가 사용자에게 노출되지 않도록 필터링
 * 
 * 필터링 대상:
 * 1. <tool>, </tool> 태그
 * 2. <thinking>...</thinking> 태그 및 내용
 * 3. ```json ... ``` 코드블록
 * 4. { "performanceId": ..., "scheduleId": ... } 내부 JSON
 * 5. 중복된 메시지 라인
 */

// 내부 태그 및 데이터 필터링
export function filterInternalData(response: string): string {
    let filtered = response;

    // 1. tool 태그 제거
    filtered = filtered.replace(/<\/?tool>/g, '');

    // 2. thinking 태그 및 내용 제거
    filtered = filtered.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');

    // 3. JSON 코드블록 제거
    filtered = filtered.replace(/```json[\s\S]*?```/g, '');

    // 4. 내부 JSON 객체 제거
    const internalJsonPattern = /\{\s*"(?:performanceId|scheduleId|preferredGrade|groupSize|seatIds|holdId|userId)"[\s\S]*?\}/g;
    filtered = filtered.replace(internalJsonPattern, '');

    // 5. 연속 줄바꿈 정리 (3개 이상 → 2개)
    filtered = filtered.replace(/\n{3,}/g, '\n\n');

    return filtered.trim();
}

// 응답 중복 제거
export function deduplicateResponse(response: string): string {
    const lines = response.split('\n');
    const seen = new Set<string>();
    const uniqueLines: string[] = [];

    for (const line of lines) {
        const normalized = line.trim().replace(/\s+/g, ' ');

        // 빈 줄은 유지
        if (normalized === '') {
            uniqueLines.push(line);
            continue;
        }

        // 중복되지 않은 줄만 추가
        if (!seen.has(normalized)) {
            seen.add(normalized);
            uniqueLines.push(line);
        }
    }

    return uniqueLines.join('\n');
}

// 메인 필터링 파이프라인
export function processResponse(response: string): string {
    let processed = response;
    processed = filterInternalData(processed);
    processed = deduplicateResponse(processed);
    return processed;
}
