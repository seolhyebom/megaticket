// apps/web/lib/model-config.ts
// MegaTicket V7.0 - Bedrock 모델 설정

/**
 * Cross-Region Inference Profile을 사용한 Bedrock 모델 정의
 * 서울(Main)과 도쿄(DR) 리전에서 동일하게 사용
 * APAC 리전 프로파일을 사용하여 레이턴시와 가용성을 최적화함
 */
export const BEDROCK_MODELS = {
    // Primary: Claude Haiku 4.5 (Base Model in Seoul)
    // Cross-Region Profile logic:
    // - Nova Lite (Secondary): Uses 'apac.amazon.nova-lite-v1:0' (Cross-Region supported)
    // - Haiku 4.5 (Primary): Uses 'anthropic.claude-haiku-4-5-20251001-v1:0' (Base Model, no APAC profile yet)
    PRIMARY: {
        id: 'anthropic.claude-haiku-4-5-20251001-v1:0',
        name: 'Claude Haiku 4.5',
        provider: 'anthropic',
        description: '빠른 응답, 비용 효율적 (최신 v4.5)',
        maxTokens: 4096,
        supportsPromptCaching: true,
    },

    // Secondary: Amazon Nova Lite (APAC Cross-Region)
    SECONDARY: {
        id: 'apac.amazon.nova-lite-v1:0',
        name: 'Amazon Nova Lite',
        provider: 'amazon',
        description: 'Fallback 모델',
        maxTokens: 4096,
        supportsPromptCaching: false,
    },
} as const;

/**
 * 기본 모델 설정
 */
export const DEFAULT_MODEL = BEDROCK_MODELS.PRIMARY;

/**
 * System Prompt 캐싱 설정
 * Bedrock Converse API 호환
 */
export const PROMPT_CACHING_CONFIG = {
    enabled: true,
    betaFeature: 'prompt-caching-2024-07-31',
};

/**
 * MegaTicket 기본 System Prompt
 */
export const SYSTEM_PROMPT = `당신은 MegaTicket의 AI 어시스턴트입니다.
K-POP 콘서트와 뮤지컬 티켓 예매를 도와드립니다.

주요 기능:
- 공연 정보 안내
- 좌석 추천
- 예매 절차 안내
- 일반 문의 응답

항상 친절하고 정확한 정보를 제공하세요.`;

/**
 * 모델 ID로 모델 정보 조회
 */
export function getModelById(modelId: string) {
    return Object.values(BEDROCK_MODELS).find(m => m.id === modelId) || DEFAULT_MODEL;
}

/**
 * 프론트엔드 UI용 모델 목록
 */
export function getModelOptions() {
    return Object.entries(BEDROCK_MODELS).map(([key, model]) => ({
        value: model.id,
        label: model.name,
        description: model.description,
    }));
}
