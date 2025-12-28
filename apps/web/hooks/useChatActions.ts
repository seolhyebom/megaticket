import { useRouter, useSearchParams } from 'next/navigation';
import { ActionButton } from '../types/chat';

interface UseChatActionsProps {
    sendMessage: (message: string) => void;
    onActionTriggered?: () => void; // V7.13: 액션 실행 시 이전 버튼 제거용
}

export function useChatActions({ sendMessage, onActionTriggered }: UseChatActionsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const region = searchParams.get('region') || process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2';

    const handleAction = (action: ActionButton) => {
        if (action.disabled) return;

        // V7.13: 액션 실행 시 이전 버튼들 제거
        onActionTriggered?.();

        try {
            // V7.5: Support for Text Message Actions (e.g., "네, 선점해주세요")
            if (action.type === 'message' || action.text) {
                if (action.text) {
                    sendMessage(action.text);
                    return;
                }
            }

            // V7.10.3: Handle label-based actions (fallback for when action.action is undefined)
            if (!action.action && action.label) {
                // Map common Korean labels to messages
                const labelMap: Record<string, string> = {
                    '좌석 선점': '네, 선점해주세요',
                    '다른 좌석 보기': '다른 좌석 보여줘',
                    '예약 확정': '예약 확정해줘',
                    '예약 취소': '예약 취소해줘',
                    '내 좌석 보기': '내 좌석 보여줘',
                    '공연 정보 보기': '공연 정보 알려줘',
                    '예매하기': '예매할게',
                    '예약 보기': 'NAVIGATE_MY_PAGE', // [V7.12] 예약 보기 클릭 시 페이지 이동
                    '새 예약하기': '다른 공연 예매하고 싶어',
                };
                const message = labelMap[action.label];
                if (message === 'NAVIGATE_MY_PAGE') {
                    router.push(`/my?region=${region}`);
                    return;
                }
                if (message) {
                    sendMessage(message);
                    return;
                }
            }

            switch (action.action) {
                case 'confirm_reservation':
                    sendMessage('예약 확정해줘');
                    break;

                case 'cancel_hold':
                    sendMessage('예약 취소해줘');
                    break;

                case 'hold_seats':
                case 'select_seats':
                    sendMessage('네, 선점해주세요');
                    break;

                case 'select_performance':
                    if (action.data?.performanceId) {
                        router.push(`/chat?region=${region}&performanceId=${action.data.performanceId}`);
                    }
                    break;
                case 'select_schedule':
                    if (action.data?.performanceId && action.data?.date) {
                        router.push(`/chat?region=${region}&performanceId=${action.data.performanceId}&date=${action.data.date}`);
                    }
                    break;
                case 'book_seat':
                    if (action.data?.performanceId && action.data?.date && action.data?.time) {
                        router.push(`/chat?region=${region}&performanceId=${action.data.performanceId}&date=${action.data.date}&time=${action.data.time}`);
                    }
                    break;

                case 'cancel_reservation':
                    sendMessage('예약 취소해줘');
                    break;

                case 'view_held_seats':
                    if (action.data && action.data.performanceId) {
                        const { performanceId, date, time, scheduleId } = action.data || {};
                        let url = `/performances/${performanceId}/seats`;
                        const params = new URLSearchParams();
                        if (date) params.append('date', date);
                        if (time) params.append('time', time);
                        if (scheduleId) params.append('scheduleId', scheduleId);
                        params.append('region', region);

                        if (params.toString()) {
                            url += `?${params.toString()}`;
                        }
                        // V7.13: 새 탭에서 열기 (채팅 내역 보존)
                        window.open(url, '_blank');
                    }
                    break;

                case 'view_reservation':
                case 'navigate_my_page': // [V7.12] 예약 보기 버튼 액션
                    router.push(`/my?region=${region}`);
                    break;

                default:
                    // V7.10.3: Fallback - if action.action is unknown, try sending label as message
                    if (action.label) {
                        sendMessage(action.label);
                    } else {
                        console.warn('Unknown action:', action.action, action);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling action:', error, action);
            // Fallback to sending label as message
            if (action.label) {
                sendMessage(action.label);
            }
        }
    };

    return {
        handleAction
    };
}
