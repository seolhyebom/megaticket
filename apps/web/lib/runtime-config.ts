/**
 * 런타임 Config 시스템
 * S3 정적 호스팅을 위해 환경변수 대신 런타임에 config.js에서 설정을 로드
 */

interface PlcrRuntimeConfig {
    API_URL: string;
    AWS_REGION: string;
    PROJECT: string;
    ENVIRONMENT: string;
    AUTH_ENABLED: boolean;
    AUTH_PROVIDER: string;
}

declare global {
    interface Window {
        __PLCR_CONFIG__?: PlcrRuntimeConfig;
    }
}

const DEFAULT_CONFIG: PlcrRuntimeConfig = {
    API_URL: "https://megaticket.click",
    AWS_REGION: "ap-northeast-2",
    PROJECT: "plcr",
    ENVIRONMENT: "prod",
    AUTH_ENABLED: false,
    AUTH_PROVIDER: "mock"
};

/**
 * 런타임 Config 가져오기
 * window.__PLCR_CONFIG__가 있으면 사용, 없으면 기본값 반환
 */
export function getPlcrConfig(): PlcrRuntimeConfig {
    if (typeof window !== "undefined" && window.__PLCR_CONFIG__) {
        return window.__PLCR_CONFIG__;
    }
    return DEFAULT_CONFIG;
}

/**
 * API URL 가져오기
 */
export function getApiUrl(): string {
    return getPlcrConfig().API_URL;
}

/**
 * AWS 리전 가져오기
 */
export function getAwsRegion(): string {
    return getPlcrConfig().AWS_REGION;
}

/**
 * 환경 정보 가져오기
 */
export function getEnvironment(): string {
    return getPlcrConfig().ENVIRONMENT;
}
