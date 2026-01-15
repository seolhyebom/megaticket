// public/config.js
// 서울 리전 기본 설정 - 배포 시 리전별로 다른 파일 사용
window.__PLCR_CONFIG__ = {
  API_URL: "https://app.pilotlight-test.click",
  AWS_REGION: "ap-southeast-1",
  PROJECT: "plcr",
  ENVIRONMENT: "prod",
  AUTH_ENABLED: false,
  AUTH_PROVIDER: "mock"
};
