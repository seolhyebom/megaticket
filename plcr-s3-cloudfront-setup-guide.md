# PilotCrew S3 + CloudFront 설정 가이드

> **작성일**: 2026-01-11  
> **프로젝트**: MSP-Project-Pilot-Light  
> **버전**: V3.1  
> **최종 수정**: 2026-01-12 (CloudFront 배포 재생성, 함수 연결 가이드 추가)

---

## 1. 아키텍처 개요

### 1.1 구성 요소

```
┌─────────────────────────────────────────────────────────────────┐
│                    CloudFront (E2R4D3647K4SKR)                  │
├─────────────────────────────────────────────────────────────────┤
│  도메인: megaticket.click, d35zm306fnhknv.cloudfront.net       │
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │  /* (정적 콘텐츠) │         │  /api/* (API)   │               │
│  │  Origin Group   │         │  Custom Origin  │               │
│  │  + CF Function  │         │                 │               │
│  └────────┬────────┘         └────────┬────────┘               │
│           │                           │                         │
│    ┌──────┴──────┐                    │                         │
│    ▼             ▼                    ▼                         │
│ S3-Main      S3-DR            api.megaticket.click             │
│ (서울)       (도쿄)            (Route53 Failover)               │
│    │                                                            │
│    └──── S3 CRR (자동 복제) ────▶                               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 리소스 정보

| 항목 | 값 |
|------|-----|
| **CloudFront 배포 ID** | `E2R4D3647K4SKR` |
| **CloudFront 도메인** | `d35zm306fnhknv.cloudfront.net` |
| **사용자 도메인** | `megaticket.click` |
| **TLS 인증서** | `arn:aws:acm:us-east-1:626614672806:certificate/4be4ea74-1084-463a-8283-e83cf2a05768` |
| **Route53 호스팅 영역** | `Z02745862QYUFMC87Y6RJ` |

### 1.3 S3 버킷 구성

| 버킷명 | 리전 | 역할 | 비고 |
|--------|------|------|------|
| `plcr-s3-web-an2` | ap-northeast-2 (서울) | Primary | Origin Group 1순위, CRR 소스 |
| `plcr-s3-web-an1` | ap-northeast-1 (도쿄) | DR | Origin Group 2순위, CRR 대상 |

### 1.4 S3 Cross-Region Replication (CRR) 구성

| 항목 | 값 |
|------|-----|
| **규칙 이름** | plcr-crr-web-an2-to-an1 |
| **소스 버킷** | plcr-s3-web-an2 (서울) |
| **대상 버킷** | plcr-s3-web-an1 (도쿄) |
| **복제 범위** | 전체 버킷 (모든 객체) |
| **삭제 마커 복제** | ✅ 활성화 |
| **IAM 역할** | s3crr_role_for_plcr-s3-web-an2 |

> ⚠️ **주의**: CRR은 새로 업로드된 객체만 복제합니다. 기존 객체는 수동 동기화 필요.

### 1.5 CloudFront Origin 구성

| Origin 이름 | Origin 도메인 | Origin 유형 | Origin Access |
|-------------|--------------|-------------|---------------|
| S3-Main | plcr-s3-web-an2.s3.ap-northeast-2.amazonaws.com | S3 | OAC (plcr-oac-s3-an2) |
| S3-DR | plcr-s3-web-an1.s3.ap-northeast-1.amazonaws.com | S3 | OAC (plcr-oac-s3-an1) |
| API-ALB | api.megaticket.click | Custom | - |

### 1.6 Origin Group 구성

| Origin Group 이름 | Primary | Secondary | 장애 조치 기준 |
|-------------------|---------|-----------|---------------|
| S3-Origin-Group | S3-Main | S3-DR | 403, 404, 500, 502, 503, 504 |

---

## 2. S3 버킷 설정

### 2.1 버킷 버전 관리 (CRR 필수)

```powershell
# 버전 관리 활성화 (CRR 전제조건)
aws s3api put-bucket-versioning --bucket plcr-s3-web-an2 --versioning-configuration Status=Enabled --region ap-northeast-2
aws s3api put-bucket-versioning --bucket plcr-s3-web-an1 --versioning-configuration Status=Enabled --region ap-northeast-1

# 확인
aws s3api get-bucket-versioning --bucket plcr-s3-web-an2 --region ap-northeast-2
aws s3api get-bucket-versioning --bucket plcr-s3-web-an1 --region ap-northeast-1
```

### 2.2 버킷 정책 (OAC용)

CloudFront OAC(Origin Access Control)를 통해서만 S3에 접근하도록 설정합니다.

#### 서울 버킷 (plcr-s3-web-an2)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::plcr-s3-web-an2/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::626614672806:distribution/E2R4D3647K4SKR"
        }
      }
    }
  ]
}
```

#### 도쿄 버킷 (plcr-s3-web-an1)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::plcr-s3-web-an1/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::626614672806:distribution/E2R4D3647K4SKR"
        }
      }
    }
  ]
}
```

### 2.3 버킷 정책 적용/확인 (PowerShell)

```powershell
# 서울 버킷 정책 적용
aws s3api put-bucket-policy --bucket plcr-s3-web-an2 --region ap-northeast-2 --policy file://seoul-s3-policy.json

# 도쿄 버킷 정책 적용
aws s3api put-bucket-policy --bucket plcr-s3-web-an1 --region ap-northeast-1 --policy file://tokyo-s3-policy.json

# 버킷 정책 확인
aws s3api get-bucket-policy --bucket plcr-s3-web-an2 --region ap-northeast-2
aws s3api get-bucket-policy --bucket plcr-s3-web-an1 --region ap-northeast-1
```

> ⚠️ **주의**: 버킷 정책이 없으면 CloudFront에서 403 에러 → Origin Group이 DR로 Failover됩니다!

---

## 3. config.js 설정

### 3.1 config.js 역할

| 항목 | 설명 | 용도 |
|------|------|------|
| `API_URL` | API 호출 기본 URL | API 요청 시 사용 |
| `AWS_REGION` | 현재 S3 리전 | **폴백용** (API 실패 시) |
| `ENVIRONMENT` | 환경 (prod/dr) | 로깅/디버깅용 |

> ✅ **Region 배지는 `/api/health` 응답 기준**으로 표시됩니다.  
> config.js의 `AWS_REGION`은 API 호출 실패 시 폴백용으로만 사용됩니다.

### 3.2 서울용 config.js

```javascript
// public/config.js (서울)
window.__PLCR_CONFIG__ = {
  API_URL: "https://megaticket.click",
  AWS_REGION: "ap-northeast-2",
  PROJECT: "plcr",
  ENVIRONMENT: "prod"
};
```

### 3.3 도쿄용 config.js

```javascript
// public/config.js (도쿄)
window.__PLCR_CONFIG__ = {
  API_URL: "https://megaticket.click",
  AWS_REGION: "ap-northeast-1",
  PROJECT: "plcr",
  ENVIRONMENT: "dr"
};
```

### 3.4 API_URL 설정 이유

| API_URL 값 | 동작 | CORS |
|-----------|------|------|
| `https://megaticket.click` | CloudFront `/api/*` 경유 | ❌ 불필요 (same-origin) |
| `https://api.megaticket.click` | 직접 ALB 호출 | ✅ 필요 (cross-origin) |

> **권장**: `https://megaticket.click` 사용 (CloudFront 경유)  
> CORS 설정 없이 same-origin으로 처리되어 안정적입니다.

---

## 4. CloudFront 설정

### 4.1 동작 (Behaviors) 설정

| 경로 패턴 | Origin | 캐시 정책 | 원본 요청 정책 | CF 함수 |
|----------|--------|----------|--------------|--------|
| `/api/*` | API-ALB | CachingDisabled | AllViewer | - |
| `/*` (기본) | S3-Origin-Group | CachingOptimized | - | plcr-rewrite-spa-routes |

### 4.2 오류 페이지 (Error Pages) 설정

Next.js SPA 라우팅을 위해 404/403 에러 시 index.html 반환:

| HTTP 오류 코드 | 응답 페이지 경로 | HTTP 응답 코드 | 최소 TTL |
|---------------|-----------------|---------------|----------|
| 403 | /index.html | 200 | 10초 |
| 404 | /index.html | 200 | 10초 |

> **이유**: Next.js Static Export에서 `/performances/[id]` 같은 동적 라우트는 S3에 실제 폴더가 없어서 404가 발생합니다. CloudFront가 index.html을 반환하면 클라이언트 라우팅으로 처리됩니다.

### 4.3 일반 설정

| 항목 | 값 |
|------|-----|
| **기본 루트 객체** | `index.html` |
| **보안 정책** | TLSv1.2_2021 |
| **지원 HTTP 버전** | HTTP/2 |
| **대체 도메인 이름 (CNAME)** | megaticket.click |

### 4.4 CloudFront 함수 (SPA 라우팅) ⭐ 중요

Next.js Static Export에서 동적 라우트(`/performances/[id]`)를 처리하기 위한 CloudFront Functions 설정입니다.

#### 함수 정보

| 항목 | 값 |
|------|-----|
| **함수 이름** | plcr-rewrite-spa-routes |
| **런타임** | cloudfront-js-2.0 |
| **ARN** | arn:aws:cloudfront::626614672806:function/plcr-rewrite-spa-routes |
| **연결 위치** | CloudFront 동작 `/*` → 뷰어 요청 (Viewer Request) |

#### 함수 코드

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // /performances/{id} (끝에 /가 있거나 없거나)
    if (uri.match(/^\/performances\/[^\/]+\/?$/) && !uri.includes('_placeholder')) {
        request.uri = '/performances/_placeholder/index.html';
        return request;
    }
    
    // /performances/{id}/booking
    if (uri.match(/^\/performances\/[^\/]+\/booking\/?$/)) {
        request.uri = '/performances/_placeholder/booking/index.html';
        return request;
    }
    
    // /performances/{id}/seats
    if (uri.match(/^\/performances\/[^\/]+\/seats\/?$/)) {
        request.uri = '/performances/_placeholder/seats/index.html';
        return request;
    }
    
    return request;
}
```

#### 동작 원리

| 요청 URI | 리라이트 대상 | 설명 |
|----------|--------------|------|
| `/performances/perf-kinky-1` | `/performances/_placeholder/index.html` | 공연 상세 |
| `/performances/perf-kinky-1/` | `/performances/_placeholder/index.html` | 공연 상세 (trailing slash) |
| `/performances/perf-kinky-1/booking` | `/performances/_placeholder/booking/index.html` | 예매 페이지 |
| `/performances/perf-kinky-1/seats` | `/performances/_placeholder/seats/index.html` | 좌석 선택 |

> ⚠️ **중요**: `_placeholder` 폴더가 S3에 존재해야 합니다. Next.js 빌드 시 `generateStaticParams()`로 생성됩니다.

#### 함수 생성 방법 (AWS Console)

```
1. CloudFront → 함수 → 함수 생성
2. 이름: plcr-rewrite-spa-routes
3. 런타임: cloudfront-js-2.0
4. 함수 코드 붙여넣기
5. 저장 → 게시
```

#### 함수를 배포에 연결 (AWS Console)

```
1. CloudFront → 함수 → plcr-rewrite-spa-routes
2. "게시" 탭 클릭
3. "관련 배포" 섹션 → "연결 추가" 클릭
4. 배포 선택: E2R4D3647K4SKR
5. 이벤트 유형: Viewer Request
6. 캐시 동작: Default (*)
7. "연결 추가" 클릭
```

> ⚠️ **배포 재생성 시**: 새 배포에 함수 연결을 다시 해야 합니다!

### 4.5 캐시 무효화 (PowerShell)

```powershell
# 전체 캐시 무효화
aws cloudfront create-invalidation --distribution-id E2R4D3647K4SKR --paths "/*"

# 특정 파일만 무효화
aws cloudfront create-invalidation --distribution-id E2R4D3647K4SKR --paths "/config.js" "/index.html"

# 무효화 상태 확인
aws cloudfront list-invalidations --distribution-id E2R4D3647K4SKR
```

---

## 5. CloudFront 배포 재생성 가이드 ⭐ 신규

배포를 삭제 후 재생성해야 하는 경우 (예: 원본 구성 변경, 설정 오류 등)

### 5.1 재생성 시 체크리스트

#### Step 1: 배포 생성

| 항목 | 설정 |
|------|------|
| 원본 도메인 | plcr-s3-web-an2.s3.ap-northeast-2.amazonaws.com |
| 원본 액세스 | OAC 선택 (새로 생성 또는 기존 선택) |
| 뷰어 프로토콜 | Redirect HTTP to HTTPS |
| 기본 루트 객체 | `index.html` |
| 대체 도메인 이름 | `megaticket.click` |
| TLS 인증서 | ACM 인증서 선택 (us-east-1) |

#### Step 2: 원본 추가 (3개)

| 원본 이름 | 도메인 | OAC | 용도 |
|----------|--------|-----|------|
| S3-Main | plcr-s3-web-an2.s3.ap-northeast-2.amazonaws.com | plcr-oac-s3-an2 | Primary |
| S3-DR | plcr-s3-web-an1.s3.ap-northeast-1.amazonaws.com | plcr-oac-s3-an1 | DR Failover |
| API-ALB | api.megaticket.click | - | API 프록시 |

**API-ALB 원본 설정**:
- 프로토콜: HTTPS only
- HTTPS 포트: 443
- 최소 원본 SSL 프로토콜: TLSv1.2

#### Step 3: 원본 그룹 생성

| 항목 | 값 |
|------|-----|
| 이름 | S3-Origin-Group |
| Primary | S3-Main |
| Secondary | S3-DR |
| Failover criteria | 403, 404, 500, 502, 503, 504 |

#### Step 4: 동작 설정 (2개)

**기본 동작 (Default *)**:
| 항목 | 값 |
|------|-----|
| 원본 | S3-Origin-Group |
| 뷰어 프로토콜 | Redirect HTTP to HTTPS |
| 허용 HTTP 방법 | GET, HEAD |
| 캐시 정책 | CachingOptimized |

**/api/* 동작**:
| 항목 | 값 |
|------|-----|
| 경로 패턴 | /api/* |
| 원본 | API-ALB |
| 뷰어 프로토콜 | Redirect HTTP to HTTPS |
| 허용 HTTP 방법 | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| 캐시 정책 | CachingDisabled |
| 원본 요청 정책 | AllViewer |

#### Step 5: 오류 페이지 설정

| 오류 코드 | 응답 페이지 | 응답 코드 | TTL |
|----------|------------|----------|-----|
| 403 | /index.html | 200 | 10초 |
| 404 | /index.html | 200 | 10초 |

#### Step 6: S3 버킷 정책 업데이트

**⚠️ 필수!** 새 배포 ID로 버킷 정책 업데이트:

```powershell
# 새 배포 ID 확인 후 정책 파일 수정
# AWS:SourceArn 값을 새 배포 ARN으로 변경

# 서울 버킷 정책 업데이트
aws s3api put-bucket-policy --bucket plcr-s3-web-an2 --region ap-northeast-2 --policy file://seoul-s3-policy.json

# 도쿄 버킷 정책 업데이트
aws s3api put-bucket-policy --bucket plcr-s3-web-an1 --region ap-northeast-1 --policy file://tokyo-s3-policy.json
```

#### Step 7: Route53 레코드 업데이트

```
1. Route53 → megaticket.click 호스팅 영역
2. megaticket.click A 레코드 편집
3. 별칭 대상을 새 CloudFront 배포로 변경
4. 저장
```

#### Step 8: CloudFront 함수 연결

```
1. CloudFront → 함수 → plcr-rewrite-spa-routes
2. "게시" 탭 → "연결 추가"
3. 배포: 새 배포 ID 선택
4. 이벤트 유형: Viewer Request
5. 캐시 동작: Default (*)
6. "연결 추가" 클릭
```

#### Step 9: 캐시 무효화 및 테스트

```powershell
# 캐시 무효화
aws cloudfront create-invalidation --distribution-id <새-배포-ID> --paths "/*"

# DNS 캐시 플러시 (Windows)
ipconfig /flushdns
```

**테스트 URL**:
- 메인 페이지: `https://megaticket.click`
- 공연 상세: `https://megaticket.click/performances/perf-kinky-1`
- API: `https://megaticket.click/api/health`

---

## 6. S3 파일 배포 (CRR 적용)

### 6.1 배포 흐름 (V3.0 - CRR 적용)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Web 코드 변경 배포                          │
├─────────────────────────────────────────────────────────────────┤
│  1. npm run build                                               │
│           ↓                                                     │
│  2. 서울 S3 업로드 (aws s3 sync)                                │
│           ↓                                                     │
│  3. CRR이 자동으로 도쿄 S3에 복제 (config.js 포함)              │
│           ↓                                                     │
│  4. 도쿄 config.js 덮어쓰기 (리전 정보 변경)                    │
│           ↓                                                     │
│  5. CloudFront 캐시 무효화                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 전체 배포 (Web 코드 변경 시)

```powershell
# 1. Web 빌드
cd c:\bedrock_space\apps\web
npm run build

# 2. 서울 S3에 전체 배포
aws s3 sync out/ s3://plcr-s3-web-an2/ --region ap-northeast-2 --delete

# 3. CRR 복제 대기 (약 1-5분)
# CRR이 자동으로 도쿄에 복제 (config.js 포함)

# 4. 도쿄 config.js 덮어쓰기 (필수!)
aws s3 cp config-tokyo.js s3://plcr-s3-web-an1/config.js --region ap-northeast-1

# 5. CloudFront 캐시 무효화
aws cloudfront create-invalidation --distribution-id E2R4D3647K4SKR --paths "/*"
```

> ⚠️ **중요**: CRR이 서울 config.js를 도쿄로 복제하므로, **반드시 도쿄 config.js를 덮어써야** 합니다!

### 6.3 config.js만 배포 (설정 변경 시)

```powershell
# 서울 S3에 config.js 업로드
aws s3 cp config-seoul.js s3://plcr-s3-web-an2/config.js --region ap-northeast-2

# CRR 복제 대기 (약 1-5분)

# 도쿄 S3에 config.js 덮어쓰기 (필수!)
aws s3 cp config-tokyo.js s3://plcr-s3-web-an1/config.js --region ap-northeast-1

# 캐시 무효화
aws cloudfront create-invalidation --distribution-id E2R4D3647K4SKR --paths "/config.js"
```

### 6.4 S3 파일 확인

```powershell
# 서울 S3 파일 목록
aws s3 ls s3://plcr-s3-web-an2/ --region ap-northeast-2

# 도쿄 S3 파일 목록
aws s3 ls s3://plcr-s3-web-an1/ --region ap-northeast-1

# config.js 내용 확인
aws s3 cp s3://plcr-s3-web-an2/config.js - --region ap-northeast-2
aws s3 cp s3://plcr-s3-web-an1/config.js - --region ap-northeast-1
```

### 6.5 CRR 복제 상태 확인

```powershell
# CRR 설정 확인
aws s3api get-bucket-replication --bucket plcr-s3-web-an2 --region ap-northeast-2

# 특정 객체 복제 상태 확인
aws s3api head-object --bucket plcr-s3-web-an1 --key index.html --region ap-northeast-1
```

---

## 7. 트러블슈팅

### 7.1 CloudFront가 DR(도쿄)로 Failover되는 경우

**증상**: 서울 S3가 정상인데도 도쿄 config.js가 반환됨

**원인**: 서울 S3 버킷 정책 누락 → CloudFront에서 403 에러 → Origin Group Failover

**해결 (PowerShell)**:
```powershell
# 1. 서울 버킷 정책 확인
aws s3api get-bucket-policy --bucket plcr-s3-web-an2 --region ap-northeast-2

# 2. 정책 없으면 추가
aws s3api put-bucket-policy --bucket plcr-s3-web-an2 --region ap-northeast-2 --policy file://seoul-s3-policy.json

# 3. 캐시 무효화
aws cloudfront create-invalidation --distribution-id E2R4D3647K4SKR --paths "/*"
```

### 7.2 공연 상세 페이지가 메인으로 리다이렉트

**증상**: `/performances/perf-xxx` 접속 시 메인 페이지로 이동

**원인**: CloudFront 함수 (plcr-rewrite-spa-routes)가 연결되지 않음

**해결**:
```
1. CloudFront → 함수 → plcr-rewrite-spa-routes
2. "게시" 탭 → "관련 배포" 확인
3. 배포가 없으면 "연결 추가" 클릭
4. 배포: E2R4D3647K4SKR 선택
5. 이벤트 유형: Viewer Request
6. 캐시 동작: Default (*)
7. "연결 추가" 클릭
8. 캐시 무효화 실행
```

### 7.3 CRR이 작동하지 않는 경우

**증상**: 서울 S3 업로드 후 도쿄에 파일이 복제되지 않음

**원인 1**: 버전 관리 비활성화
```powershell
# 확인
aws s3api get-bucket-versioning --bucket plcr-s3-web-an2 --region ap-northeast-2
# Status가 "Enabled"여야 함
```

**원인 2**: 기존 객체는 CRR 대상 아님
```powershell
# 기존 객체 수동 복사
aws s3 sync s3://plcr-s3-web-an2 s3://plcr-s3-web-an1 --region ap-northeast-1 --exclude "config.js"
```

**원인 3**: IAM 역할 권한 문제
- AWS Console → S3 → 복제 규칙 → IAM 역할 확인

### 7.4 도쿄 config.js가 서울 값으로 덮어써짐

**증상**: 배포 후 도쿄 config.js의 AWS_REGION이 `ap-northeast-2`로 변경됨

**원인**: CRR이 서울 config.js를 도쿄로 복제함

**해결**: 배포 후 항상 도쿄 config.js 덮어쓰기
```powershell
aws s3 cp config-tokyo.js s3://plcr-s3-web-an1/config.js --region ap-northeast-1
```

### 7.5 CORS 에러 발생

**증상**: 브라우저 Console에 CORS 에러 표시

**원인**: config.js의 `API_URL`이 `https://api.megaticket.click` (cross-origin)

**해결**: config.js의 `API_URL`을 `https://megaticket.click`으로 변경

```javascript
// ❌ CORS 필요 (cross-origin)
API_URL: "https://api.megaticket.click"

// ✅ CORS 불필요 (same-origin, CloudFront 경유)
API_URL: "https://megaticket.click"
```

### 7.6 페이지 404 에러 (공연 상세 등)

**증상**: `/performances/perf-xxx` 접속 시 "공연을 찾을 수 없습니다" 표시

**원인 1**: CloudFront Error Pages 미설정
- 해결: 403, 404 → /index.html (200) 설정

**원인 2**: CloudFront 함수 미연결
- 해결: plcr-rewrite-spa-routes 함수 연결

**원인 3**: API 호출 실패
- 해결: 브라우저 개발자 도구 Network 탭 확인

### 7.7 CloudFront 캐시 문제

**증상**: 파일 업로드 후에도 이전 내용이 표시됨

**해결**:
```powershell
# 캐시 무효화
aws cloudfront create-invalidation --distribution-id E2R4D3647K4SKR --paths "/*"

# 브라우저: Ctrl + Shift + R (강력 새로고침)
# 또는 시크릿/프라이빗 창에서 테스트
```

### 7.8 Region 배지가 업데이트 안 됨

**증상**: API Failover 후에도 배지가 이전 리전 표시

**원인**: sessionStorage 캐시

**해결**:
```javascript
// 브라우저 개발자 도구 Console에서
sessionStorage.removeItem('api-region');
location.reload();
```

또는 **시크릿/프라이빗 창**에서 테스트

---

## 8. 배포 체크리스트

### 8.1 Web 코드 변경 시 (전체 배포)

- [ ] `npm run build` 성공 확인
- [ ] `out/` 폴더 생성 확인
- [ ] 서울 S3 배포: `aws s3 sync out/ s3://plcr-s3-web-an2/ --delete`
- [ ] CRR 복제 대기 (1-5분)
- [ ] 도쿄 config.js 덮어쓰기: `aws s3 cp config-tokyo.js s3://plcr-s3-web-an1/config.js`
- [ ] 도쿄 config.js 확인: `aws s3 cp s3://plcr-s3-web-an1/config.js -`
- [ ] CloudFront 캐시 무효화: `/*`
- [ ] 브라우저 테스트

### 8.2 config.js만 변경 시

- [ ] 서울 config.js 업로드
- [ ] CRR 복제 대기 (1-5분)
- [ ] 도쿄 config.js 덮어쓰기
- [ ] CloudFront 캐시 무효화: `/config.js`
- [ ] 브라우저 테스트

### 8.3 DR 검증 시

- [ ] 서울 S3 버킷 정책 존재 확인
- [ ] 도쿄 S3 버킷 정책 존재 확인
- [ ] CRR 설정 확인: `aws s3api get-bucket-replication`
- [ ] Origin Group 순서 확인 (S3-Main → S3-DR)
- [ ] Error Pages 설정 확인 (403, 404 → /index.html)
- [ ] **CloudFront 함수 연결 확인** (plcr-rewrite-spa-routes)
- [ ] config.js 리전 값 확인 (서울: ap-northeast-2, 도쿄: ap-northeast-1)

### 8.4 CloudFront 배포 재생성 시

- [ ] 원본 3개 생성 (S3-Main, S3-DR, API-ALB)
- [ ] 원본 그룹 생성 (S3-Origin-Group)
- [ ] 동작 2개 설정 (Default, /api/*)
- [ ] 오류 페이지 설정 (403, 404)
- [ ] 기본 루트 객체 설정 (index.html)
- [ ] 대체 도메인 및 TLS 인증서 설정
- [ ] S3 버킷 정책 업데이트 (새 배포 ARN)
- [ ] Route53 A 레코드 업데이트
- [ ] **CloudFront 함수 연결** (plcr-rewrite-spa-routes)
- [ ] 캐시 무효화
- [ ] 전체 기능 테스트

---

## 9. 배포 시나리오별 요약

| 변경 사항 | 배포 범위 | S3 업로드 | CRR | config.js 덮어쓰기 | 캐시 무효화 |
|----------|----------|----------|-----|-------------------|------------|
| **Web 코드 변경** | 전체 빌드 | 서울만 | ✅ 자동 복제 | ✅ 도쿄 필수 | `/*` |
| **config.js만 변경** | config.js | 서울만 | ✅ 자동 복제 | ✅ 도쿄 필수 | `/config.js` |
| **App 코드 변경** | Golden AMI | 해당 없음 | - | - | - |
| **CloudFront 재생성** | 전체 | - | - | - | `/*` + 함수 연결 |

---

## 10. 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-11 | 최초 작성 |
| 2026-01-11 | PowerShell 문법 적용, Region 배지 API 연동 설명 추가 |
| 2026-01-11 | S3 CRR 설정 반영: 배포 방식 변경, CRR 트러블슈팅 추가 |
| **2026-01-12** | **CloudFront 배포 ID 변경 (E29X0KCRDE95EC → E2R4D3647K4SKR)** |
| **2026-01-12** | **CloudFront 함수 연결 가이드 추가 (섹션 4.4)** |
| **2026-01-12** | **배포 재생성 가이드 추가 (섹션 5)** |
| **2026-01-12** | **트러블슈팅 추가: 공연 상세 페이지 리다이렉트 문제 (섹션 7.2)** |

---

## 11. 참고 자료

- [S3 Cross-Region Replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)
- [CloudFront Origin Groups](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html)
- [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)
- [S3 Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
