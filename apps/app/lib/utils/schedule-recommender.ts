
// Performance, Schedule 등의 타입은 기존 프로젝트 타입 정의를 참조한다고 가정하거나, 여기서 간단히 정의
// 실제로는 shared types나 prisma schema에서 가져오는 것이 좋음
interface PerformanceSchedule {
    id: string;
    datetime: string; // ISO string
    performanceId: string;
}

interface ScheduleFilter {
    preferWeekend?: boolean;
    preferWeekday?: boolean;
    preferMatinee?: boolean;  // 낮공연 (17시 이전)
    preferEvening?: boolean;  // 저녁공연 (17시 이후)
    maxResults?: number;      // 기본값: 5
}

/**
 * 스마트 일정 필터링
 */
export function filterSchedules(
    schedules: PerformanceSchedule[],
    filters: ScheduleFilter
): PerformanceSchedule[] {
    let filtered = [...schedules];

    // 날짜순 정렬 (가까운 순)
    filtered.sort((a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    // 주말/평일 필터
    if (filters.preferWeekend) {
        filtered = filtered.filter(s => {
            const day = new Date(s.datetime).getDay();
            return day === 0 || day === 6; // 0:일, 6:토
        });
    } else if (filters.preferWeekday) {
        filtered = filtered.filter(s => {
            const day = new Date(s.datetime).getDay();
            return day >= 1 && day <= 5; // 월~금
        });
    }

    // 시간대 필터
    if (filters.preferMatinee) {
        filtered = filtered.filter(s => {
            const hour = new Date(s.datetime).getHours();
            return hour < 17;
        });
    } else if (filters.preferEvening) {
        filtered = filtered.filter(s => {
            const hour = new Date(s.datetime).getHours();
            return hour >= 17;
        });
    }

    // 결과 제한
    return filtered.slice(0, filters.maxResults || 5);
}
