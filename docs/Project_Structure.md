# MegaTicket 프로젝트 디렉토리 구조

> **Version**: 1.0  
> **Last Updated**: 2025-12-29  
> **작성자**: 설혜봄 (MSP-Project-Pilot-Light)

---

## 📂 전체 디렉토리 구조

```
bedrock_space/
│
├── .agent/                          # AI 에이전트 설정 (Gemini/Claude 등)
│   ├── rules/                       # 코드 스타일 규칙 정의
│   │   └── python-code-style.md     # Python 코딩 컨벤션
│   └── workflows/                   # 워크플로우 자동화 스크립트
│       └── setup-aws-iam.md         # AWS IAM 설정 워크플로우
│
├── apps/                            # 모노레포 애플리케이션 (Turborepo)
│   │
│   ├── app/                         # 🔧 Backend API (Next.js App Router)
│   │   │                            #    Port: 3001
│   │   ├── app/                     # Next.js App Router 디렉토리
│   │   │   └── api/                 # API 라우트
│   │   │       ├── chat/            # 챗봇 API (Bedrock 연동)
│   │   │       ├── health/          # 헬스체크 엔드포인트
│   │   │       ├── performances/    # 공연 조회 API
│   │   │       ├── reservations/    # 예약 CRUD API
│   │   │       ├── schedules/       # 스케줄 조회 API
│   │   │       ├── seats/           # 좌석 상태 API
│   │   │       └── venues/          # 공연장 조회 API
│   │   │
│   │   ├── lib/                     # 핵심 라이브러리
│   │   │   ├── bedrock.ts           # Bedrock 클라이언트 초기화
│   │   │   ├── bedrock-tools.ts     # 챗봇 도구 정의 (15개)
│   │   │   ├── system-prompt.ts     # AI 시스템 프롬프트 (~724줄)
│   │   │   ├── dynamodb.ts          # DynamoDB 클라이언트
│   │   │   ├── response-filter.ts   # 응답 필터링
│   │   │   ├── reservation-store.ts # 예약 저장소
│   │   │   │
│   │   │   ├── constants/           # 상수 정의
│   │   │   │   └── bedrock-config.ts # 모델 ID, Fallback 설정
│   │   │   │
│   │   │   ├── server/              # 서버 전용 로직
│   │   │   │   ├── performance-service.ts  # 공연 데이터 (캐싱)
│   │   │   │   ├── holding-manager.ts      # 좌석 선점 관리
│   │   │   │   └── reservation-service.ts  # 예약 서비스
│   │   │   │
│   │   │   ├── tools/               # 추가 도구 모듈
│   │   │   ├── types/               # 타입 정의
│   │   │   └── utils/               # 유틸리티 함수
│   │   │
│   │   ├── scripts/                 # DynamoDB 데이터 마이그레이션 스크립트
│   │   │   ├── generate-schedules.mjs       # 스케줄 생성
│   │   │   ├── reset-reservations.mjs       # 예약 초기화
│   │   │   ├── restore-venue-sections.mjs   # 공연장 좌석 복원
│   │   │   ├── sync-all-data.mjs            # 전체 데이터 동기화
│   │   │   └── update-seat-grades.mjs       # 좌석 등급 업데이트
│   │   │
│   │   ├── .env                     # 환경변수 (AWS_REGION 등)
│   │   ├── Dockerfile               # Docker 빌드 설정
│   │   ├── next.config.ts           # Next.js 설정
│   │   ├── package.json             # 의존성 정의
│   │   └── tsconfig.json            # TypeScript 설정
│   │
│   └── web/                         # 🌐 Frontend (Next.js + TailwindCSS)
│       │                            #    Port: 3000
│       ├── app/                     # Next.js App Router 페이지
│       │   ├── page.tsx             # 홈페이지 (공연 목록)
│       │   ├── layout.tsx           # 공통 레이아웃
│       │   ├── globals.css          # 전역 CSS
│       │   ├── chat/                # 챗봇 페이지
│       │   ├── login/               # 로그인 페이지
│       │   ├── signup/              # 회원가입 페이지
│       │   ├── my/                  # 마이페이지 (예약 조회)
│       │   ├── performances/        # 공연 상세 페이지
│       │   └── reservation/         # 좌석 선택/예약 확인 페이지
│       │
│       ├── components/              # 리액트 컴포넌트
│       │   ├── chat-interface.tsx   # 챗봇 UI (스트리밍)
│       │   ├── reservation-card.tsx # 예약 카드 컴포넌트
│       │   ├── site-header.tsx      # 사이트 헤더
│       │   ├── site-footer.tsx      # 사이트 푸터
│       │   ├── region-indicator.tsx # 리전 표시 (DR 감지)
│       │   ├── home-carousel.tsx    # 홈 캐러셀
│       │   ├── time-sale.tsx        # 타임세일 배너
│       │   │
│       │   ├── chat/                # 챗봇 관련 컴포넌트
│       │   ├── seats/               # 좌석 배치도 컴포넌트
│       │   │   ├── SeatMap.tsx      # 좌석 배치도
│       │   │   ├── SeatRow.tsx      # 좌석 열
│       │   │   └── SeatCell.tsx     # 개별 좌석
│       │   └── ui/                  # shadcn/ui 컴포넌트
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── dialog.tsx
│       │       └── ...
│       │
│       ├── contexts/                # React Context
│       │   └── visitor-context.tsx  # 방문자 ID 관리
│       │
│       ├── hooks/                   # 커스텀 훅
│       │   └── use-toast.ts         # Toast 훅
│       │
│       ├── lib/                     # 유틸리티
│       │   └── utils.ts             # 공통 유틸
│       │
│       ├── public/                  # 정적 파일
│       │   └── posters/             # 공연 포스터 이미지
│       │
│       ├── .env.local               # 로컬 환경변수
│       ├── Dockerfile               # Docker 빌드 설정
│       ├── tailwind.config.js       # TailwindCSS 설정
│       ├── next.config.ts           # Next.js 설정
│       └── package.json             # 의존성 정의
│
├── packages/                        # 공유 패키지 (모노레포)
│   ├── shared-types/                # 공유 TypeScript 타입
│   │   └── index.ts                 # Performance, Reservation 등
│   └── shared-utils/                # 공유 유틸리티 함수
│       └── index.ts
│
├── docs/                            # 📚 프로젝트 문서
│   ├── Bedrock_Technical_Guide.md   # Bedrock 기술 가이드 (Cross-Region, 캐싱)
│   ├── Chatbot_Prompt_Guide.md      # 챗봇 프롬프트 가이드 (V7.11)
│   ├── DynamoDB_Schema.md           # DynamoDB 스키마 문서 (4개 테이블)
│   ├── GSI_Setup_Guide.md           # GSI 설정 가이드
│   ├── Instance_Deployment_Guide.md # EC2 수동 배포 가이드
│   ├── DR_Recovery_Test_Guide.md    # DR 복구 테스트 가이드
│   ├── DR_Local_Test_Guide.md       # 로컬 DR 테스트 가이드
│   ├── Terraform_Main_Seoul.md      # 서울 테라폼 가이드
│   ├── Terraform_DR_Tokyo.md        # 도쿄 테라폼 가이드
│   ├── cloudwatch-monitoring-guide.md # CloudWatch 모니터링 (EMF)
│   ├── Project_Structure.md         # 📍 이 문서
│   ├── Guide.md                     # 프로젝트 개요
│   └── USAGE.md                     # 사용법
│
├── .gitignore                       # Git 제외 파일
├── .dockerignore                    # Docker 빌드 제외 파일
├── docker-compose.yml               # Docker Compose (Web + App)
├── package.json                     # 루트 패키지 (Turborepo 설정)
├── package-lock.json                # 의존성 잠금
├── tsconfig.base.json               # 기본 TypeScript 설정
└── turbo.json                       # Turborepo 빌드 설정
```

---

## 🛠️ 주요 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 15, React 19, TailwindCSS, shadcn/ui |
| **Backend** | Next.js App Router API Routes |
| **AI** | AWS Bedrock (Claude Haiku 4.5, Nova Lite) |
| **Database** | DynamoDB Global Tables (서울 ↔ 도쿄) |
| **인프라** | Terraform, EC2 Auto Scaling, ALB |
| **모노레포** | Turborepo, pnpm/npm workspaces |
| **배포** | PM2, Docker (선택) |

---

## 🔌 포트 구성

| 서비스 | 포트 | 설명 |
|--------|------|------|
| `apps/web` | 3000 | Frontend (Next.js) |
| `apps/app` | 3001 | Backend API (Next.js API Routes) |

---

## 📄 문서 목록

| 문서 | 설명 |
|------|------|
| `Bedrock_Technical_Guide.md` | Bedrock Cross-Region Inference, 프롬프트 캐싱, Fallback 전략 |
| `Chatbot_Prompt_Guide.md` | AI 챗봇 프롬프트 엔지니어링 가이드 |
| `DynamoDB_Schema.md` | 4개 테이블 스키마, TTL, GSI, Global Table |
| `Terraform_Main_Seoul.md` | 서울 리전 인프라 테라폼 코드 |
| `Terraform_DR_Tokyo.md` | 도쿄 DR 리전 Pilot Light 테라폼 코드 |
| `Instance_Deployment_Guide.md` | EC2 인스턴스 수동 배포 가이드 |
| `DR_Recovery_Test_Guide.md` | DR 복구 테스트 절차 |
| `cloudwatch-monitoring-guide.md` | EMF 기반 메트릭 수집 가이드 |

---

## 🚀 빠른 시작

```bash
# 1. 의존성 설치 (루트에서)
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저 접속
# Frontend: http://localhost:3000
# API: http://localhost:3001/api/health
```

---

**Last Updated**: 2025-12-29  
**Maintainer**: 설혜봄 (MSP-Project-Pilot-Light)
