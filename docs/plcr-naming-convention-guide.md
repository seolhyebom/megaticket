# PilotCrew (PLCR) 네이밍 규칙 및 리소스 코드 가이드

> **팀명**: PilotCrew  
> **팀 코드**: `plcr`  
> **작성일**: 2026-01-10

---

## 1. 네이밍 규칙

### 1.1 기본 패턴

```
[필수] 팀명 - 리소스명 - 리전명
[옵션] AZ - 역할 - 기능명

예시: plcr-alb-an2
      plcr-sbn-pub-an2-a
      plcr-lambda-post-an1
```

### 1.2 네이밍 규칙 상세

| 구분 | 항목 | 설명 | 코드/값 | 참고 사항 |
|------|------|------|---------|-----------|
| 네이밍 규칙 | **패턴** | [필수] 팀명-리소스명-리전명 [옵션] AZ-역할-기능명 | e.g. `plcr-alb-an2` | 소문자 사용, 하이픈(-)으로 구분 |
| | **팀명** | PilotCrew 약어 | `plcr` | |
| | **리소스명** | 리소스 정리 시트 참조 | 리소스 종류에 따라 상이 | 최대 6자로 리소스명을 코드화 |
| | **리전명** | Primary / Secondary 리전 약어 | `an2` / `an1` | ap-northeast-2 / ap-northeast-1 |
| | **AZ** | 가용영역 구분 | `a` / `c` | 서울/도쿄 리전의 가용영역 a와 c만 사용 |
| | **역할** | 리소스의 역할 구분 | `web` / `app` / `pub` / `pri` | 리소스 상황에 따라 추가적으로 역할 코드 정의가 필요하다면 자유롭게 정의하되 좌측 칸에 기재 |
| | **기능명** | 리소스의 주요 기능 | `post` / `get` | 위의 '역할'과 동일 |

### 1.3 리전 코드

| 리전 | 코드 | 설명 |
|------|------|------|
| ap-northeast-2 (서울) | `an2` | Main Region (Primary) |
| ap-northeast-1 (도쿄) | `an1` | DR Region (Secondary) |
| us-east-1 (버지니아) | `ue1` | Observation Region (CloudFront, WAF 등) |

### 1.4 가용영역 코드

| AZ | 코드 | 사용 리전 |
|----|------|----------|
| ap-northeast-2a | `a` | 서울 |
| ap-northeast-2c | `c` | 서울 |
| ap-northeast-1a | `a` | 도쿄 |
| ap-northeast-1c | `c` | 도쿄 |

### 1.5 역할 코드

| 역할 | 코드 | 설명 |
|------|------|------|
| Web Tier | `web` | 프론트엔드 |
| App Tier | `app` | 백엔드 API |
| Public | `pub` | 퍼블릭 서브넷/리소스 |
| Private | `pri` | 프라이빗 서브넷/리소스 |

---

## 2. 태그 정책

### 2.1 필수 태그

| 태그 키 | 설명 | 값 예시 |
|---------|------|---------|
| **Project** | 프로젝트 식별자 | `plcr` |
| **Name** | 리소스의 전체 이름 | `plcr-alb-an2` |
| **Environment** | 환경 및 관리 상태 | `prod` / `dev` / `dr` |

### 2.2 선택 태그

| 태그 키 | 설명 | 값 예시 |
|---------|------|---------|
| **ManagedBy** | 리소스 생성 방식 | `terraform` |
| **Backup** | 백업 설정 여부 | `true` (백업 필요 시) |
| **Tier** | 리소스 계층/역할 | `web` / `app` / `pub` / `pri` |

### 2.3 Environment 값 설명

| 값 | 설명 |
|----|------|
| `prod` | Production (운영 환경) |
| `dev` | Development (개발 환경) |
| `dr` | Disaster Recovery (재해복구 환경) |

---

## 3. 리소스 코드 목록

### 3.1 분석/로깅 서비스

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| Athena | Workgroup (작업 그룹) | `athena` | CloudTrail 로그 분석 |
| CloudTrail | Trail (추적) | `trail` | AWS API 호출 기록 및 S3 저장 (보안 감사) |
| CloudWatch | Alarm | `alarm` | R53 헬스 체크 알람을 EventBridge로 전달 |
| CloudWatch | Log Stream | `lsm` | 로그 스트림 생성 권한 |
| CloudWatch | Metric (EMF) | `metric` | 임베디드 메트릭 포맷 사용 |
| CloudWatch | Dashboard | `cwdash` | 메인 리전 메트릭 대시보드 |

### 3.2 컴퓨팅 서비스

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| EC2 | Instance | `web` / `app` | ASG에 의해 생성되는 VM |
| EC2 | Launch Template | `lt` | 인스턴스 시작 템플릿 (보안그룹, IAM 등 정의) |
| EC2 | Auto Scaling Group | `asg` | Web/App 자동 확장 그룹 |
| EC2 | AMI | `ami` | 배포용 골든 이미지 |
| Lambda | Function | `lambda` | StepFunctions에서 연결되는 DR Failover 진행용 함수 |

### 3.3 로드밸런싱

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| EC2 (ELB) | Load Balancer | `lb` | ALB (Web용), NLB (App용) - 통합 코드 |
| EC2 (ELB) | Target Group | `tg` | ALB용(HTTP 3000), NLB용(TCP 3001) - 통합 코드 |

### 3.4 네트워킹 (VPC)

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| VPC | VPC | `vpc` | 네트워크 격리 공간 |
| VPC | Subnet | `sbn` | Public/Private 서브넷 |
| VPC | Route Table | `rt` | 서브넷과 라우팅 테이블 연결 |
| VPC | Internet Gateway | `igw` | 외부 인터넷 통신 통로 |
| VPC | Security Group | `sg` | 방화벽 규칙 (EC2, ALB용) |
| VPC | VPC Endpoint (Gateway) | `vpce` | DynamoDB 전용 프라이빗 통로 |
| VPC | Elastic IP | `eip` | NAT Gateway용 고정 IP |
| VPC | NAT Gateway | `nat` | Private 서브넷의 아웃바운드 통신 |

### 3.5 데이터베이스/스토리지

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| DynamoDB | Global Table | `gtbl` | 서울↔도쿄 자동 복제 테이블 4개 |
| DynamoDB | Global Secondary Index | `gsi` | 조회 성능 최적화 인덱스 |
| S3 | Bucket | `s3` | CloudTrail, Log 보관 |
| S3 | Glacier | - | CloudTrail, VPC Flow, ALB 로그 장기 보관 시 사용 |

### 3.6 백업

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| Backup | Backup | `backup` | 최신 EC2 AMI 백업하여 DR Failover 시 활용 |
| Backup | Vault | `vault` | 리전별 백업 파일 보관함 |
| Backup | Backup Plan | `bkplan` | 반복적인 백업 예약 |
| Backup | Backup Rule | `bkrule` | 백업 계획 규칙 |
| Backup | Protected Resource | `bkreso` | 백업이 완료된 리소스, 이후 copy로 크로스 리전 가능 |

### 3.7 AI/ML (Bedrock)

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| Bedrock | Foundation Model | `fm` | Anthropic Haiku 4.5, AWS Nova Lite 모델 사용 권한 |
| Bedrock | Inference Profile | `infp` | Cross-Region Inference 설정 |

### 3.8 보안/인증

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| IAM | Role | `role` | EC2, Lambda용 권한 역할 |
| IAM | Policy | `pol` | 인라인 정책 (DynamoDB, Bedrock 등) |
| IAM | Instance Profile | `insp` | EC2에 Role 연결용 프로필 |
| KMS | Customer Managed Keys | `kms` | 보안 강화 / Backup Vault용 KMS 키 |
| Certificate Manager | Certificate | `certi` | ACM 인증서(arn) 참조 |
| Secret Manager | Secret | `srt` | 외부 서비스 사용 시 Access Key 등 민감한 데이터 보호 |
| WAF & Shield | Protection Packs (WebACLs) | `wacl` | 보안 강화(DDoS 차단) / 본사 리전의 CloudFront에 붙음 |

### 3.9 CDN/DNS

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| CloudFront | Distributions | `cfront` | R53 도메인 연결, Main/DR 리전의 ALB ARN origin 그룹화 |
| Route 53 | HealthCheck | `r53` | ALB 상태 헬스체크 → Failover 트리거 기준 |

### 3.10 이벤트/자동화

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| EventBridge | Rule | `evtrl` | Alarm 이벤트 패턴 감지 후 Target으로 전달 |
| EventBridge | Target | `evttg` | Rule에서 지정한 대상 (Lambda, Bus 등) |
| EventBridge | Bus | `evtbus` | 이벤트 수신 및 라우팅 |
| EventBridge | Scheduler | `evtscd` | DR 리전 백업 최신 복사본 확인용 람다 실행 |
| Step Functions | State Machines | `stfn` | DR Failover (관리자 승인을 거친) 자동화 단계별 진행 |

### 3.11 CI/CD

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| CodeCommit | Repositories | `repo` | 빌드하기 위한 코드 저장공간 |
| CodeCommit | Approval Rule Templates | `art` | 승인 규칙 템플릿 |

### 3.12 API/메시징

| 대분류 | 소분류 | 코드 (최대 6자) | 설명 및 사용처 |
|--------|--------|-----------------|----------------|
| API Gateway | HTTP Gateway | `api` | Slack/SNS 승인용 람다 함수에 연결되는 HTTP Gateway |
| SNS | Topic | `topic` | SNS 이메일 전송 시 사용 |
| Systems Manager | Parameter Store | - | StepFunctions에서 NLB DNS 호출할 때 필요한 파라미터 *별도의 리소스 코드는 필요 없음 (정해진 형식 존재) |

---

## 4. 네이밍 예시

### 4.1 서울 리전 (Main)

| 리소스 | 네이밍 예시 |
|--------|-------------|
| VPC | `plcr-vpc-an2` |
| Public Subnet (AZ-a) | `plcr-sbn-pub-an2-a` |
| Private Subnet (AZ-c) | `plcr-sbn-pri-an2-c` |
| ALB | `plcr-alb-an2` |
| Web ASG | `plcr-asg-web-an2` |
| App ASG | `plcr-asg-app-an2` |
| S3 (Web 호스팅) | `plcr-s3-web-an2` |
| CloudFront | `plcr-cfront-an2` |
| Lambda (CORS) | `plcr-lambda-cors-an2` |

### 4.2 도쿄 리전 (DR)

| 리소스 | 네이밍 예시 |
|--------|-------------|
| VPC | `plcr-vpc-an1` |
| Public Subnet (AZ-a) | `plcr-sbn-pub-an1-a` |
| Private Subnet (AZ-c) | `plcr-sbn-pri-an1-c` |
| ALB | `plcr-alb-an1` |
| S3 (Web 호스팅 DR) | `plcr-s3-web-an1` |

### 4.3 DynamoDB Global Tables

| 테이블 | 네이밍 예시 |
|--------|-------------|
| Performances | `plcr-gtbl-performances` |
| Reservations | `plcr-gtbl-reservations` |
| Holdings | `plcr-gtbl-holdings` |
| SeatInventory | `plcr-gtbl-seatinv` |

---

## 5. 태그 예시

```json
{
  "Project": "plcr",
  "Name": "plcr-alb-an2",
  "Environment": "prod",
  "ManagedBy": "terraform",
  "Tier": "web"
}
```

```json
{
  "Project": "plcr",
  "Name": "plcr-asg-app-an1",
  "Environment": "dr",
  "ManagedBy": "terraform",
  "Backup": "true",
  "Tier": "app"
}
```

---

## 6. 코드 작업 시 적용

### config.js 네이밍

```javascript
// public/config.js
window.__PLCR_CONFIG__ = {
  API_URL: "https://api.megaticket.click",
  AWS_REGION: "ap-northeast-2",
  PROJECT: "plcr",
  ENVIRONMENT: "prod"
};
```

### 변수/함수 네이밍

```typescript
// plcr 프리픽스 사용 권장
interface PlcrRuntimeConfig { ... }
function getPlcrConfig() { ... }
const plcrApiUrl = getApiUrl();
```

---

## 참고

- 모든 리소스명은 **소문자** 사용
- 구분자는 **하이픈(-)** 사용
- 리소스 코드는 **최대 6자**
- 태그의 `Project` 값은 항상 `plcr`
