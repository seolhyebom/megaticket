import React from 'react';
import { ActionButton } from '../../types/chat';
import { Info, Ticket, CheckCircle2, XCircle, Sparkles, RotateCcw } from 'lucide-react';

interface ActionButtonsProps {
    actions: ActionButton[];
    onAction: (action: ActionButton) => void;
}

// 버튼 라벨에 따라 아이콘 반환
const getButtonIcon = (label: string) => {
    if (label.includes('정보')) return <Info className="h-4 w-4" />;
    if (label.includes('예매') || label.includes('예약')) return <Ticket className="h-4 w-4" />;
    if (label.includes('확정') || label.includes('선점')) return <CheckCircle2 className="h-4 w-4" />;
    if (label.includes('취소')) return <XCircle className="h-4 w-4" />;
    if (label.includes('보기')) return <Sparkles className="h-4 w-4" />;
    if (label.includes('다른')) return <RotateCcw className="h-4 w-4" />;
    return null;
};

export const ActionButtons: React.FC<ActionButtonsProps> = ({ actions, onAction }) => {
    if (!actions || actions.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-3 mt-3">
            {actions.map((action, index) => {
                const label = action.label || action.text || action.id || '버튼';
                const icon = getButtonIcon(label);
                const isPrimary = action.style === 'primary' || label.includes('예매') || label.includes('확정') || label.includes('선점');
                const isDanger = action.style === 'danger' || label.includes('취소');

                return (
                    <button
                        key={action.id || `action-${index}`}
                        onClick={() => {
                            // [V7.11] navigate 액션 처리 - 페이지 이동
                            if (action.action === 'navigate' && (action as any).url) {
                                window.location.href = (action as any).url;
                                return;
                            }
                            onAction(action);
                        }}
                        disabled={action.disabled}
                        className={`
                            group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold 
                            transition-all duration-300 ease-out
                            ${action.disabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'
                                : isPrimary
                                    ? `bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 text-white 
                                       shadow-lg shadow-orange-500/30 
                                       hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 hover:scale-[1.02]
                                       active:scale-[0.98] active:shadow-md
                                       border border-white/20`
                                    : isDanger
                                        ? `bg-white text-rose-600 border-2 border-rose-200 
                                           shadow-sm shadow-rose-100
                                           hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 
                                           hover:border-rose-400 hover:shadow-md hover:shadow-rose-200/50
                                           hover:-translate-y-0.5
                                           active:scale-[0.98]`
                                        : `bg-white text-gray-700 border-2 border-gray-200 
                                           shadow-sm
                                           hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 
                                           hover:border-orange-300 hover:text-orange-600 
                                           hover:shadow-md hover:shadow-orange-100/50
                                           hover:-translate-y-0.5
                                           active:scale-[0.98]`
                            }
                        `}
                    >
                        {/* Shine effect for primary buttons */}
                        {isPrimary && !action.disabled && (
                            <span className="absolute inset-0 rounded-xl overflow-hidden">
                                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            </span>
                        )}

                        {icon && (
                            <span className={`transition-transform duration-300 ${!action.disabled ? 'group-hover:scale-110' : ''}`}>
                                {icon}
                            </span>
                        )}
                        <span className="relative">{label}</span>
                    </button>
                );
            })}
        </div>
    );
};
