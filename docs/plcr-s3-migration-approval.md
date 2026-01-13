# Web S3 마이그레이션 진행 승인 및 가이드

> **작성일**: 2026-01-10
> **목적**: S3 정적 호스팅 마이그레이션 진행 승인 및 네이밍 규칙 전달

---

## ✅ 진행 승인

분석 결과 검토 완료. **Phase 0부터 순차 진행해주세요!**

---

## 📋 질문 답변

### 1. 백업 방식

```
main 브랜치 유지
    ↓
새 브랜치 생성: feature/s3-migration
    ↓
작업 완료 후 테스트
    ↓
✅ 성공 시: main으로 merge
❌ 실패 시: 브랜치 삭제
```

### 2. 인프라 작업

- **코드 작업과 병렬 진행** (혜봄 담당)
- 코드 완료 전에 S3, CloudFront, ALB 설정 미리 준비
- 빌드 성공하면 S3 업로드 후 통합 테스트

### 3. 도메인

- **운영 도메인**: `megaticket.click`
- **API 도메인**: `api.megaticket.click` (또는 CloudFront `/api/*` 경유)

---

## 🏷️ 네이밍 규칙 (필수 준수)

### 팀 정보

| 항목 | 값 |
|------|-----|
| **팀명** | PilotCrew |
| **팀 코드** | `plcr` |

### 네이밍 패턴

```
[필수] 팀명 - 리소스명 - 리전명
[옵션] AZ - 역할 - 기능명

예시: plcr-alb-an2
      plcr-s3-web-an2
      plcr-cfront-an2
```

### 리전 코드

| 리전 | 코드 | 설명 |
|------|------|------|
| ap-northeast-2 (서울) | `an2` | Main Region |
| ap-northeast-1 (도쿄) | `an1` | DR Region |

### 역할 코드

| 역할 | 코드 | 설명 |
|------|------|------|
| Web Tier | `web` | 프론트엔드 |
| App Tier | `app` | 백엔드 API |
| Public | `pub` | 퍼블릭 서브넷 |
| Private | `pri` | 프라이빗 서브넷 |

### 환경(Environment) 코드

| 환경 | 코드 | 설명 |
|------|------|------|
| Production | `prod` | 운영 환경 |
| Development | `dev` | 개발 환경 |
| Disaster Recovery | `dr` | 재해복구 환경 |

### 리소스 코드 (참고용)

| 리소스 | 코드 | 예시 |
|--------|------|------|
| S3 Bucket | `s3` | `plcr-s3-web-an2` |
| CloudFront | `cfront` | `plcr-cfront-an2` |
| ALB | `alb` | `plcr-alb-an2` |
| Lambda | `lambda` | `plcr-lambda-cors-an2` |
| DynamoDB Global Table | `gtbl` | `plcr-gtbl-performances` |
| DynamoDB Table (일반) | `tbl` | `plcr-tbl-sessions-an2` |

> **📌 DynamoDB 네이밍 차이점**
> - **Global Table (`gtbl`)**: 서울↔도쿄 복제되므로 리전 코드 **생략**
> - **일반 Table (`tbl`)**: 특정 리전에만 존재하므로 리전 코드 **포함**

---

## 📝 코드 작업 시 네이밍 적용

### config.js 예시

```javascript
// public/config.js
window.__PLCR_CONFIG__ = {
  API_URL: "https://api.megaticket.click",
  AWS_REGION: "ap-northeast-2",
  PROJECT: "plcr",
  ENVIRONMENT: "prod"
};
```

### runtime-config.ts 예시

```typescript
// lib/runtime-config.ts

interface PlcrRuntimeConfig {
  API_URL: string;
  AWS_REGION: string;
  PROJECT: string;
  ENVIRONMENT: string;
}

const DEFAULT_CONFIG: PlcrRuntimeConfig = {
  API_URL: "https://api.megaticket.click",
  AWS_REGION: "ap-northeast-2",
  PROJECT: "plcr",
  ENVIRONMENT: "prod"
};

export function getPlcrConfig(): PlcrRuntimeConfig {
  if (typeof window !== "undefined" && (window as any).__PLCR_CONFIG__) {
    return (window as any).__PLCR_CONFIG__;
  }
  return DEFAULT_CONFIG;
}

export function getApiUrl(): string {
  return getPlcrConfig().API_URL;
}

export function getAwsRegion(): string {
  return getPlcrConfig().AWS_REGION;
}
```

---

## 🔐 CORS 설정 (App 서버)

### 허용할 Origin 목록

```typescript
// App 서버 CORS 설정
const allowedOrigins = [
  'https://megaticket.click',              // 운영 도메인
  'https://www.megaticket.click',          // www 도메인
  /\.cloudfront\.net$/,                    // CloudFront 테스트
  'http://localhost:3000',                 // 로컬 개발
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## 🔑 인증 관련 참고사항

### 현재 상태

- 로그인/로그아웃 UI: ✅ 이미 구현됨
- 인증 방식: Mock 사용자 (`localStorage` 기반)

### 추후 실제 인증 추가 시

> ⚠️ **AWS Cognito는 DR에 부적합** (리전별 독립, Cross-Region 복제 없음)

**권장**: DynamoDB Global Tables 기반 커스텀 인증
- 이미 Global Tables 사용 중 → Users 테이블 추가 시 자동 DR 동기화
- JWT 발급/검증은 App 서버에서 처리

### config.js 확장 준비

```javascript
window.__PLCR_CONFIG__ = {
  API_URL: "https://api.megaticket.click",
  AWS_REGION: "ap-northeast-2",
  PROJECT: "plcr",
  ENVIRONMENT: "prod",
  
  // 추후 인증 추가 시 사용
  AUTH_ENABLED: false,
  AUTH_PROVIDER: "mock",  // "mock" | "dynamodb-custom"
};
```

---

## ✅ 작업 체크리스트 (최종)

### Phase 0: 백업
- [ ] 현재 main에서 `feature/s3-migration` 브랜치 생성
- [ ] 브랜치 전환 후 작업 시작

### Phase 1: 런타임 Config 시스템
- [ ] `public/config.js` 생성 (`__PLCR_CONFIG__` 사용)
- [ ] `lib/runtime-config.ts` 유틸리티 생성
- [ ] `layout.tsx`에 config.js 로드 추가
- [ ] `NEXT_PUBLIC_*` 사용처 교체 (5개 파일)

### Phase 2: API Route Handler 제거
- [ ] `app/api/` 폴더 삭제
- [ ] `lib/api-client.ts` 수정

### Phase 3: Server Component → CSR 전환
- [ ] `app/performances/[id]/page.tsx` CSR 전환

### Phase 4: Next.js Static Export 설정
- [ ] `next.config.ts`에 `output: 'export'` 추가
- [ ] `images.unoptimized: true` 설정
- [ ] `trailingSlash: true` 설정

### Phase 5: App 서버 CORS 설정
- [ ] CORS 미들웨어 추가 (위 설정 참고)

### Phase 6: 로컬 빌드 및 테스트
- [ ] `npm run build` 성공 확인
- [ ] `out/` 폴더 생성 확인
- [ ] 로컬 정적 서버 테스트

---

## 📞 연락 사항

- 작업 중 이슈 발생 시 바로 공유해주세요
- Phase 6 완료 후 알려주시면 인프라 통합 테스트 진행합니다

**작업 시작해주세요! 🚀**
