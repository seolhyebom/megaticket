# MegaTicket Chatbot - Bedrock 기술 가이드

> **Version**: V8.3 | **Last Updated**: 2026-01-04  
> **작성자**: 설혜봄 (MSP-Project-Pilot-Light)

---

## 📋 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [사용 모델 및 설정](#2-사용-모델-및-설정)
3. ⭐ [크로스 리전 추론 (Cross-Region Inference)](#3-크로스-리전-추론-cross-region-inference)
4. ⭐ [비용 최적화 전략](#4-비용-최적화-전략)
5. ⭐ [프롬프트 캐싱](#5-프롬프트-캐싱)
6. [Fallback 전략](#6-fallback-전략)
7. [스트리밍 처리](#7-스트리밍-처리)
8. ⭐ [CloudWatch 모니터링 (EMF)](#8-cloudwatch-모니터링-emf)
9. ⭐ [인프라 체크리스트](#9-인프라-체크리스트)
10. [참고 자료](#10-참고-자료)
11. ⭐ [할루시네이션 방지 및 사용성 개선](#11-할루시네이션-방지-및-사용성-개선-v83)
12. [좌석 선점 안정성 및 UX 강화 (V8.27)](#12-좌석-선점-안정성-및-ux-강화-v827)
13. [Auto Scaling & Retry Logic Safety (V8.29)](#13-auto-scaling--retry-logic-safety-v829)

### 🏗️ 인프라 관련 섹션 (AWS Best Practice)

| 섹션 | 주요 내용 |
|------|----------|
| ⭐ 3. 크로스 리전 추론 | Global/APAC 프로파일, 라우팅 비용 0원 |
| ⭐ 4. 비용 최적화 전략 | **프롬프트 모듈화 75%↓**, 캐싱 90%, EMF 메트릭 |
| ⭐ 5. 프롬프트 캐싱 | Anthropic Beta 기능, 입력 토큰 90% 절감 |
| ⭐ 8. CloudWatch 모니터링 | EMF 동작 방식, PutMetricData 대체 |
| ⭐ 9. 인프라 체크리스트 | IAM 권한, 환경변수, 완료 상태 |

---

## 1. 아키텍처 개요

### 1.1 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   MegaTicket Chatbot Architecture (V8.1)                        │
│                   Multi-Region (서울 + 도쿄) with Cross-Region Inference         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────┐                                                           │
│  │   Frontend       │     HTTP POST /api/chat                                   │
│  │   (Next.js)      │ ─────────────────────────────────────┐                    │
│  │   Port: 3000     │                                      │                    │
│  └──────────────────┘                                      ▼                    │
│                                                  ┌──────────────────────────┐   │
│                                                  │   API Route (route.ts)   │   │
│                                                  │   - 스트리밍 처리         │   │
│                                                  │   - 도구 실행             │   │
│                                                  │   - Fallback 로직         │   │
│                                                  └──────────────────────────┘   │
│                                                             │                    │
│                              ┌──────────────────────────────┴───────────────┐   │
│                              │                                              │   │
│                              ▼                                              ▼   │
│               ┌────────────────────────────────┐       ┌─────────────────────┐  │
│               │   🌏 Primary Model             │       │   🔄 Fallback       │  │
│               │   ─────────────────────────    │       │   (토큰 소진 시)     │  │
│               │   global.anthropic.claude-     │       │   ─────────────     │  │
│               │   haiku-4-5-20251001-v1:0      │       │   apac.amazon.      │  │
│               │                                │       │   nova-lite-v1:0    │  │
│               │   ✅ 프롬프트 캐싱 지원         │       │   ⏱️ Timeout: 15초  │  │
│               │   ⏱️ Timeout: 10초             │       │                     │  │
│               └────────────────────────────────┘       └─────────────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          🌐 Cross-Region Inference (교차 리전 추론)              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────┐         ┌─────────────────────────┐              │
│   │  🇰🇷 서울 (Main)         │  ◄───►  │  🇯🇵 도쿄 (DR)           │              │
│   │  ap-northeast-2         │         │  ap-northeast-1         │              │
│   ├─────────────────────────┤         ├─────────────────────────┤              │
│   │  Primary:               │         │  Primary:               │              │
│   │  Claude Haiku 4.5       │         │  Claude Haiku 4.5       │              │
│   │  (global.* 프로파일)     │         │  (global.* 프로파일)     │              │
│   │  ✅ Prompt Caching      │         │  ✅ Prompt Caching      │              │
│   ├─────────────────────────┤         ├─────────────────────────┤              │
│   │  Fallback:              │         │  Fallback:              │              │
│   │  Amazon Nova Lite       │         │  Amazon Nova Lite       │              │
│   │  (apac.* 프로파일)       │         │  (apac.* 프로파일)       │              │
│   └─────────────────────────┘         └─────────────────────────┘              │
│                              │         │                                        │
│                              ▼         ▼                                        │
│                    ┌──────────────────────────────────────────┐                 │
│                    │   📊 CloudWatch Logs (EMF)               │                 │
│                    │   Namespace: MegaTicket/Bedrock          │                 │
│                    │   Metrics: Latency, InputTokens,         │                 │
│                    │            OutputTokens, FallbackCount   │                 │
│                    └──────────────────────────────────────────┘                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**핵심 구조:**
- **Primary**: `global.anthropic.claude-haiku-4-5` (교차 리전) → 프롬프트 캐싱 ✅
- **Fallback**: `apac.amazon.nova-lite` (교차 리전) → 토큰 소진/오류 시 자동 전환
- **DR (도쿄)**: 서울과 동일한 모델 구성, 프롬프트 캐싱 지원


### 1.2 주요 파일 구조

```
apps/app/
├── app/api/chat/
│   └── route.ts                     # Chat API 엔드포인트 (스트리밍, Fallback, EMF 로깅)
│
├── lib/
│   ├── bedrock.ts                   # Bedrock 클라이언트 초기화 (BedrockRuntimeClient)
│   ├── bedrock-tools.ts             # 도구 정의(BEDROCK_TOOLS) 및 실행(executeTool) - 11개 도구
│   ├── dynamodb.ts                  # DynamoDB 클라이언트 및 테이블명 상수
│   ├── response-filter.ts           # ACTION_DATA 응답 필터링
│   ├── utils.ts                     # 공통 유틸리티 함수
│   │
│   ├── prompts/                     # ⭐ V8.0 모듈화된 프롬프트 (15개 파일)
│   │   ├── index.ts                 # 프롬프트 모듈 export
│   │   ├── base-prompt.ts           # 공통 규칙 (도구 테이블, 포매팅, 캐스팅 조회 규칙)
│   │   ├── prompt-composer.ts       # 단계별 프롬프트 조립 (BASE + STEP 1개)
│   │   ├── conversation-state.ts    # 대화 상태 관리 (In-memory, 5분 TTL)
│   │   ├── step-greeting.ts         # 인사말 (첫 메시지)
│   │   ├── step-1-performance.ts    # STEP 1: 공연 선택
│   │   ├── step-2-schedule.ts       # STEP 2: 날짜/시간 선택 (기념일 처리)
│   │   ├── step-3-headcount.ts      # STEP 3: 인원 확인
│   │   ├── step-4-grade.ts          # STEP 4: 좌석 등급 선택
│   │   ├── step-5-seats.ts          # STEP 5: 좌석 추천 (할루시네이션 방지)
│   │   ├── step-6-confirm.ts        # STEP 6: 선점 확인 (ACTION_DATA 허용)
│   │   ├── step-7-holding.ts        # STEP 7: 선점 완료 (10분 타이머)
│   │   ├── step-8-reservation.ts    # STEP 8: 예약 완료
│   │   ├── step-9-cancel.ts         # STEP 9: 예약 취소/내 예약 조회
│   │   └── step-info-mode.ts        # INFO_MODE: 정보 모드 (캐스팅/가격/일정 문의)
│   │
│   ├── tools/                       # ⭐ V8.4 도구 구현 모듈화
│   │   ├── get-performance-schedules.ts # 일정 조회
│   │   ├── get-seat-grades.ts       # 좌석 등급 조회
│   │   ├── holding-tools.ts         # 선점/취소 (hold_seats, cancel_hold)
│   │   ├── performance-tools.ts     # 공연 정보 (get_performances 등)
│   │   ├── seat-tools.ts            # 좌석 추천 (get_available_seats)
│   │   └── reservation-tools.ts     # 예약 조회 (get_my_reservations)
│   │
│   ├── server/                      # 서버 사이드 서비스
│   │   ├── holding-manager.ts       # 좌석 선점/예약 관리 (DynamoDB CRUD)
│   │   ├── performance-service.ts   # 공연/공연장/스케줄 조회 (캐싱 포함)
│   │   └── services/                # 추가 서비스 모듈
│   │
│   ├── constants/
│   │   └── bedrock-config.ts        # 모델 ID, Fallback 설정, 타임아웃
│   │
│   ├── utils/
│   │   ├── stream-filter.ts         # 스트림 필터링 (도구 결과 처리)
│   │   ├── price-parser.ts          # 가격 문자열 파싱
│   │   ├── schedule-recommender.ts  # 일정 추천 로직
│   │   └── seat-recommender.ts      # 좌석 추천 로직 (연석 우선)
│   │
│   └── types/
│       └── venue.ts                 # 공연장/좌석 타입 정의
│
└── system-prompt.ts                 # (레거시 백업) 기존 단일 프롬프트 파일
```

### 1.3 데이터 흐름

```
1. 사용자 메시지 전송
   ↓
2. route.ts: 메시지 유효성 검증
   ↓
3. processConverseStream(): Primary 모델 호출
   ↓
4. 도구 호출 감지 시: executeTool() 실행
   ↓
5. 스트리밍 응답 또는 에러 시 Fallback
   ↓
6. EMF 로그 출력 (CloudWatch)
```

---

## 2. 사용 모델 및 설정

### 2.1 모델 구성

```typescript
// 📁 apps/app/lib/constants/bedrock-config.ts

export const BEDROCK_MODELS = {
    PRIMARY: {
        id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
        supportsPromptCaching: true,
    },
    SECONDARY: {
        id: 'apac.amazon.nova-lite-v1:0',
        supportsPromptCaching: false,
    },
};
```

### 2.2 모델 상세 비교

| 구분 | Primary (Claude Haiku 4.5) | Secondary (Nova Lite) |
|------|---------------------------|----------------------|
| **Model ID** | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | `apac.amazon.nova-lite-v1:0` |
| **제공사** | Anthropic | Amazon |
| **Profile** | `global.*` (전 세계) | `apac.*` (아시아-태평양) |
| **프롬프트 캐싱** | ✅ **지원** | ❌ 미지원 |
| **도구 호출** | ✅ 지원 | ✅ 지원 |
| **타임아웃** | 10초 | 15초 (여유 확보) |
| **용도** | 메인 대화 처리 | 장애 시 Fallback |
| **비용** | 상대적으로 높음 | 상대적으로 낮음 |

### 2.3 모델 선택 이유

#### Claude 모델군 비교 (비용 관점)

| 모델 | 입력 토큰 (1M) | 출력 토큰 (1M) | 한국어 품질 | 선택 |
|------|---------------|---------------|------------|------|
| Claude Opus 4 | $15.00 | $75.00 | ⭐⭐⭐⭐⭐ | ❌ 비용 과다 |
| Claude Sonnet 4.5 | $3.00 | $15.00 | ⭐⭐⭐⭐⭐ | ❌ 비용 높음 |
| **Claude Haiku 4.5** | **$0.80** | **$4.00** | ⭐⭐⭐⭐ | ✅ **선택** |
| Claude Haiku 3 | $0.25 | $1.25 | ⭐⭐ | ❌ 한국어 품질 |

> 📌 **Haiku 4.5 선택 이유**: Opus/Sonnet 대비 **80~95% 저렴**하면서도 2025년 10월 출시된 최신 버전으로 **한국어 품질이 크게 개선**됨. Haiku 3 이하 버전은 한국인 대상 서비스에 부적합.

#### Primary: Claude Haiku 4.5

| 선택 이유 | 상세 |
|----------|------|
| **비용 효율** | Opus 대비 95% 저렴, Sonnet 대비 73% 저렴 |
| **한국어 품질** | 2025년 10월 출시, 한국어 대화 톤 자연스러움 |
| **프롬프트 캐싱 지원** | 시스템 프롬프트 ~36KB 캐싱으로 비용 90% 추가 절감 |
| **도구 호출 정확도** | 복잡한 예매 플로우에 안정적인 도구 실행 |
| **Global Profile** | 전 세계 리전 교차 추론으로 가용성 확보 |

#### Secondary: Amazon Nova Lite

| 선택 이유 | 상세 |
|----------|------|
| **비용 효율** | Claude 대비 저렴한 토큰 비용 |
| **APAC 최적화** | 아시아 리전 내 라우팅으로 지연 최소화 |
| **AWS 네이티브** | AWS 생태계 통합 안정성 |
| **Fallback 용도** | Primary 장애 시 서비스 연속성 보장 |

> ⚠️ **Nova Lite 프롬프트 캐싱 미지원 이유**: Amazon Nova 모델군은 현재(2025.12) 프롬프트 캐싱 기능을 제공하지 않습니다. 이는 Anthropic Claude 전용 기능(`anthropic_beta`)이며, Fallback 상황은 빈도가 낮아(정상 시 0%) 캐싱 미지원이 비용에 큰 영향을 주지 않습니다.

### 2.4 추론 설정

```typescript
// 📁 apps/app/app/api/chat/route.ts (Line 88-92)

inferenceConfig: {
    maxTokens: 4096,
    temperature: 0.7,
    topP: 0.9,
}
```

| 파라미터 | 값 | 선택 이유 |
|----------|-----|----------|
| `maxTokens` | 4096 | 좌석 추천 등 긴 응답 허용 |
| `temperature` | 0.7 | 대화 자연스러움 + 일관성 균형 |
| `topP` | 0.9 | 다양한 표현 허용 |

---

## 3. 크로스 리전 추론 (Cross-Region Inference)

### 3.1 개념

크로스 리전 추론은 AWS Bedrock에서 **다른 리전의 모델에 요청을 라우팅**하여 처리량을 높이고 가용성을 확보하는 기능입니다.

> 📝 **AWS 공식 문서**: 교차 리전 추론 사용 시 **추가 라우팅 비용이 없습니다.** 가격은 추론 프로파일을 호출한 리전 기준으로 계산됩니다.

### 3.2 Inference Profile 종류 (2025년 12월 기준)

| Profile 유형 | 접두사 | 라우팅 범위 | 데이터 거주지 | 비용 | 사용 예시 |
|-------------|--------|-------------|--------------|------|----------|
| **Region (기본)** | 없음 | 해당 리전만 | ✅ 보장 | 기본 요금 | 단일 리전 운영 |
| **Geographic** | `us.*`, `eu.*`, `apac.*` | 해당 지역 내 리전 | ✅ 보장 | **기본 요금** | 규정 준수 + 가용성 |
| **Global** | `global.*` | 전 세계 모든 리전 | ❌ 미보장 | **기본 요금** | 최대 처리량 |

> 📌 **비용 최적화 관점**: `global.*` 및 `apac.*` 프로파일 사용 시 **추가 라우팅 비용 없음**. 단일 리전 사용 대비 가용성은 높아지고 비용은 동일하므로, 프로파일 사용이 AWS Best Practice입니다.

> 📝 **AWS Best Practice 적용**: 본 프로젝트는 AWS Well-Architected Framework의 신뢰성 원칙을 따라 교차 리전 추론을 활성화하여 처리량 버스트 및 리전 장애에 대응합니다.

### 3.3 현재 프로젝트 설정

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MegaTicket Cross-Region 설정                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📍 Bedrock Client 리전: ap-northeast-2 (서울)                          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  🌐 Primary: global.anthropic.claude-haiku-4-5-20251001-v1:0      │  │
│  │  ─────────────────────────────────────────────────────────────    │  │
│  │  • Profile: global.* (전 세계 라우팅)                              │  │
│  │  • 라우팅 가능 리전:                                               │  │
│  │    - us-east-1 (버지니아)                                         │  │
│  │    - us-west-2 (오레곤)                                           │  │
│  │    - eu-west-1 (아일랜드)                                         │  │
│  │    - ap-northeast-1 (도쿄)                                        │  │
│  │    - ap-southeast-1 (싱가포르)                                    │  │
│  │  • 토큰 할당량 소진 시: 자동으로 다른 리전 라우팅                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  🌏 Secondary: apac.amazon.nova-lite-v1:0                         │  │
│  │  ─────────────────────────────────────────────────────────────    │  │
│  │  • Profile: apac.* (아시아-태평양 리전 내 라우팅)                   │  │
│  │  • 라우팅 가능 리전:                                               │  │
│  │    - ap-northeast-1 (도쿄)                                        │  │
│  │    - ap-northeast-2 (서울)                                        │  │
│  │    - ap-southeast-1 (싱가포르)                                    │  │
│  │    - ap-southeast-2 (시드니)                                      │  │
│  │  • 데이터 거주지: 아시아-태평양 지역 내 유지                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 교차 리전 라우팅 동작 원리

```
사용자 요청 (ap-northeast-2 서울)
         │
         ▼
┌────────────────────────────┐
│  Bedrock API Endpoint      │
│  (ap-northeast-2)          │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│  Inference Profile 확인    │
│  global.* 또는 apac.*      │
└────────────────────────────┘
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│  서울 리전 용량 확인 │              │  용량 부족 시        │
│  ─────────────────  │              │  ─────────────────  │
│  ✅ 여유 있음       │              │  다른 리전 라우팅    │
│  → 서울에서 처리    │              │  (도쿄, 싱가포르 등) │
└─────────────────────┘              └─────────────────────┘
```

### 3.5 교차 리전 주요 특징

| 특징 | 상세 |
|------|------|
| **추가 비용 없음** | 라우팅 비용 무료, 호출 리전 기준 과금 |
| **자동 라우팅** | 용량 부족 시 자동으로 다른 리전 선택 |
| **AWS 네트워크 내 전송** | 퍼블릭 인터넷 미사용, 전송 중 암호화 |
| **CloudTrail 로깅** | `additionalEventData.inferenceRegion`으로 처리 리전 확인 |
| **수동 리전 활성화 불필요** | 교차 리전 추론에 수동 리전 활성화 필요 없음 |

---

## 4. 비용 최적화 전략

### 4.1 비용 최적화 전체 구조

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         💰 비용 최적화 전략 (5가지)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ⭐ 1️⃣ 프롬프트 모듈화       2️⃣ 프롬프트 캐싱        3️⃣ 모델 계층화              │
│  ────────────────         ───────────────         ───────────────          │
│  단일 724줄 → 15개 파일    시스템 프롬프트 캐싱     Primary/Secondary          │
│  요청당 ~2,700 토큰       입력 토큰 비용 90%↓     구분으로 비용 제어             │
│  **75% 비용 절감**                                                              │
│                                                                                 │
│               4️⃣ 교차리전 추론          5️⃣ EMF 메트릭                          │
│               ───────────────          ───────────────                          │
│               토큰 할당량 분산           PutMetricData API 제거                │
│               추가 비용 없음           로그 기반 메트릭 추출                      │
│                                     API 호출 비용 0원                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 비용 최적화 항목별 상세

| 최적화 항목 | 기능 설명 | 적용 기술 | 절감 효과 | 구현 위치 |
|------------|----------|----------|----------|----------|
| **⭐ 프롬프트 모듈화** | 단일 724줄 파일 → 15개 파일 분할, 현재 단계만 로드 | BASE + STEP 1개 | **75% 절감** (~15K→3.7K토큰) | `prompts/*.ts` |
| **프롬프트 캐싱** | 반복되는 시스템 프롬프트를 서버에 캐싱하여 재처리 방지 | `anthropic_beta: prompt-caching-2024-07-31` | 입력 토큰 **~90% 절감** | `route.ts` L95-99 |
| **모델 계층화** | 고성능 Primary + 저비용 Secondary로 분리, 장애 시 저비용 모델 사용 | Primary(Claude) + Secondary(Nova) | Fallback 시 토큰 비용 절감 | `bedrock-config.ts` |
| **교차 리전 추론** | 여러 리전에 요청 분산하여 Rate Limit 회피, 추가 비용 없음 | `global.*`, `apac.*` 프로파일 | 라우팅 비용 **0원** | Model ID |
| **EMF 메트릭** | 로그에 메트릭 임베드, CloudWatch가 자동 추출 (API 호출 불필요) | Embedded Metric Format | API 호출 비용 **0원** | `route.ts` L197-217 |
| **도구 결과 캐싱** | 정적 데이터(공연 목록 등) 인메모리 캐싱으로 DynamoDB 조회 감소 | 인메모리 캐싱 (7일 TTL) | DB RCU 비용 절감 | `performance-service.ts` |

### 4.3 ⭐ 프롬프트 모듈화 비용 분석 (V8.0+)

#### 동작 원리
```typescript
// prompt-composer.ts - 매 요청마다 2개 파일만 조합
return `
${BASE_PROMPT}           // ← 항상 포함 (~1,800 토큰)
== 현재 예매 컨텍스트 ==
${contextSummary}        // ← 동적 (~100 토큰)
== 현재 단계 규칙 ==
${stepPrompt}            // ← 현재 단계 1개만! (~800 토큰 평균)
`.trim();
```

#### 단계별 토큰 추정

| 단계 | 조합 파일 | 토큰 | 입력 비용 (Haiku) |
|------|----------|------|------------------|
| GREETING | base + greeting | ~2,350 | $0.00188 |
| STEP_1 | base + step-1 | ~2,800 | $0.00224 |
| STEP_5 (최대) | base + step-5 | ~3,300 | $0.00264 |
| **평균** | - | **~2,700** | **$0.00216** |

#### 기존 단일 파일 vs 모듈화 비교

| 항목 | 기존 (system-prompt.ts) | 모듈화 (15개 파일) | 절감 |
|------|------------------------|-------------------|------|
| 요청당 토큰 | ~15,000 | ~2,700 | **82%↓** |
| 1회 예매 (9턴) | ~135,000 | ~24,300 | **82%↓** |
| 1회 예매 비용 | ~$0.15 | ~$0.03 | **80%↓** |

#### 월간 비용 추정 (Claude Haiku 4.5)

| 일일 예매 건수 | 기존 비용/월 | 모듈화 비용/월 | 절감액/월 |
|--------------|------------|--------------|----------|
| 100건/일 | $450 | $90 | **$360** |
| 500건/일 | $2,250 | $450 | **$1,800** |
| 1,000건/일 | $4,500 | $900 | **$3,600** |

> 📌 **핵심**: 15개 파일 전체가 로드되지 않음! 매 요청마다 **BASE + 현재 STEP 1개**만 조합

### 4.4 프롬프트 캐싱 비용 분석

#### 비용 비교 (1,000회 대화 기준)

| 항목 | 캐싱 미적용 | 캐싱 적용 | 절감액 |
|------|------------|----------|--------|
| 시스템 프롬프트 토큰 | 2,700 × 1,000 = 2.7M | 2,700 × 1 = 2.7K | - |
| 캐시 히트 토큰 | - | 0.27M (90% 할인) | - |
| 입력 토큰 비용 | $2.16 | $0.22 | **$1.94 (90%)** |

### 4.4 EMF vs PutMetricData 비용 비교

| 항목 | PutMetricData (기존) | EMF (현재) |
|------|---------------------|-----------|
| **API 호출** | 매 요청마다 HTTP 호출 | ❌ 없음 |
| **네트워크 지연** | 추가 Latency 발생 | ❌ 없음 |
| **비용** | Custom Metric API 비용 | **로그 비용만** |
| **구현 복잡도** | SDK 의존성, try-catch 필요 | `console.log` 한 줄 |
| **에러 핸들링** | 실패 시 별도 처리 필요 | 로그는 항상 성공 |

### 4.5 비용 최적화 체크리스트

| # | 항목 | 상태 | 구현 위치 |
|---|------|------|----------|
| 1 | 프롬프트 캐싱 활성화 | ✅ 완료 | `route.ts` L95-99 |
| 2 | Primary/Secondary 분리 | ✅ 완료 | `bedrock-config.ts` |
| 3 | EMF 메트릭 적용 | ✅ 완료 | `route.ts` L197-217 |
| 4 | 인메모리 캐싱 적용 | ✅ 완료 | `performance-service.ts` |
| 5 | 교차 리전 프로파일 사용 | ✅ 완료 | Model ID |

### 4.6 챗봇 도구 캐싱 적용 현황 (V8.2 기준)

| 도구명 | 데이터 소스 | 캐싱 방식 | 비용 절감 |
|--------|------------|----------|----------|
| `get_performances` | `getAllPerformances` | 7일 캐싱 | 99% 절감 |
| `get_performance_details` | `getPerformance` | 7일 캐싱 | 99% 절감 |
| `get_performance_schedules` | `getPerformanceSchedules` | 7일 캐싱 | **99% 절감 (V8.2)** |
| `get_seat_grades` | `getPerformance` | 7일 캐싱 | 99% 절감 |
| `get_venue_info` | `getVenue` | 7일 캐싱 | 99% 절감 |

> 📌 **효과**: 사용자가 아무리 많이 질문해도, 서버 메모리에 데이터가 있으면 **DB 조회 비용은 0원**입니다.

---

## 5. 프롬프트 캐싱

### 5.1 프롬프트 캐싱 개념

프롬프트 캐싱은 **반복되는 시스템 프롬프트를 서버 측에서 캐싱**하여:
- 입력 토큰 처리 비용 절감
- 첫 토큰까지의 지연 시간 감소

### 5.2 활성화 조건 및 코드

```typescript
// 📁 apps/app/app/api/chat/route.ts (Line 95-99)

if (usedModel === BEDROCK_MODELS.PRIMARY.id && 
    BEDROCK_MODELS.PRIMARY.supportsPromptCaching) {
    commandInput.additionalModelRequestFields = {
        "anthropic_beta": ["prompt-caching-2024-07-31"]
    };
}
```

### 5.3 모델별 지원 현황

| 모델 | 프롬프트 캐싱 | 비고 |
|------|--------------|------|
| Claude Haiku 4.5 (global.*) | ✅ **지원** | Primary로 사용 |
| Claude Sonnet 4.5 | ✅ 지원 | - |
| Claude Sonnet 4 | ✅ 지원 | - |
| Amazon Nova Lite (apac.*) | ❌ 미지원 | Fallback용 |
| Amazon Nova Pro | ❌ 미지원 | - |

### 5.4 캐싱 동작 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      프롬프트 캐싱 동작 흐름                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  첫 번째 요청 (Cache Miss)                                              │
│  ────────────────────────                                               │
│  [시스템 프롬프트: ~9,000 토큰] + [사용자 메시지]                         │
│  → 전체 토큰 처리 → 캐시에 저장                                          │
│  → 비용: 전액 청구                                                      │
│                                                                         │
│  두 번째~ 요청 (Cache Hit)                                              │
│  ─────────────────────────                                              │
│  [캐시된 시스템 프롬프트] + [사용자 메시지]                               │
│  → 캐시 토큰은 90% 할인 적용                                             │
│  → 비용: 10%만 청구                                                     │
│                                                                         │
│  캐시 만료 (TTL: 5분)                                                   │
│  ─────────────────────                                                  │
│  5분 동안 동일 프롬프트 사용 없으면 캐시 삭제                             │
│  → 다음 요청은 다시 Cache Miss                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.5 캐싱 효과

| 메트릭 | 캐싱 미적용 | 캐싱 적용 | 개선율 |
|--------|------------|----------|--------|
| 입력 토큰 비용 | 100% | ~10% | **90% 절감** |
| 첫 토큰 지연 | 기본 | 감소 | **최대 85% 개선** |

---

## 6. Fallback 전략

### 6.1 Fallback 설정

```typescript
// 📁 apps/app/lib/constants/bedrock-config.ts

export const FALLBACK_CONFIG = {
    // 즉시 Fallback (재시도 없음)
    IMMEDIATE_FALLBACK_CODES: [400, 401, 403, 404, 429, 503],

    // 재시도 후 Fallback
    RETRY_CODES: [500, 502, 504],

    PRIMARY_TIMEOUT_MS: 10000,    // 10초
    SECONDARY_TIMEOUT_MS: 15000,  // 15초

    MAX_RETRIES: 2,
    RETRY_DELAY_MS: 1000,
    RETRY_BACKOFF_MULTIPLIER: 1.5,
};
```

### 6.2 Fallback 설정 선택 이유

| 설정 | 값 | 선택 이유 |
|------|-----|----------|
| **즉시 Fallback (429)** | Rate Limit | 재시도해도 동일 결과 예상 |
| **즉시 Fallback (503)** | Service Unavailable | 서비스 자체 문제 |
| **재시도 (500, 502, 504)** | 일시적 오류 | 재시도로 복구 가능성 있음 |
| **Primary 타임아웃 10초** | - | 빠른 Fallback 전환 |
| **Secondary 타임아웃 15초** | - | Fallback에 여유 제공 |
| **최대 재시도 2회** | - | 무한 재시도 방지 |
| **백오프 1.5배** | - | 점진적 대기 시간 증가 |

### 6.3 Fallback 흐름도

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Fallback Flow                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Primary 모델 호출 (Claude Haiku 4.5)                                │
│     │                                                                   │
│     ├─ ✅ 성공 → 스트리밍 응답 → 종료                                   │
│     │                                                                   │
│     └─ ❌ 실패                                                          │
│         │                                                               │
│         ├─ HTTP 400/401/403/404/429/503                                 │
│         │   └─ 🔄 즉시 Fallback → Secondary 호출                        │
│         │                                                               │
│         └─ HTTP 500/502/504                                             │
│             │                                                           │
│             ├─ 1회 재시도 (1초 대기)                                    │
│             │   └─ 성공 → 응답 / 실패 → 계속                            │
│             │                                                           │
│             ├─ 2회 재시도 (1.5초 대기)                                  │
│             │   └─ 성공 → 응답 / 실패 → Fallback                        │
│             │                                                           │
│             └─ 🔄 Fallback → Secondary 호출                             │
│                                                                         │
│  2. Secondary 모델 호출 (Nova Lite)                                     │
│     │                                                                   │
│     ├─ ✅ 성공 → 스트리밍 응답 + isFallback=true                        │
│     │                                                                   │
│     └─ ❌ 실패 → 사용자에게 오류 메시지                                  │
│         "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요."          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 에러 코드별 처리

#### 🔴 즉시 Fallback (재시도 없음)

| HTTP 코드 | 의미 | Bedrock 상황 | 처리 근거 |
|-----------|------|-------------|----------|
| 400 | Bad Request | 잘못된 Model ID | 요청 자체 오류, 재시도 무의미 |
| 401 | Unauthorized | 인증 실패 | 자격증명 문제, 재시도 무의미 |
| 403 | Forbidden | 권한 없음 | IAM 정책 문제, 재시도 무의미 |
| 404 | Not Found | 모델 없음 | 모델 ID 오류, 재시도 무의미 |
| 429 | Too Many Requests | Rate Limit 초과 | 다른 리전으로 즉시 분산 |
| 503 | Service Unavailable | 서비스 중단 | 서비스 자체 문제, 즉시 대체 |

#### 🟡 재시도 후 Fallback (최대 2회 재시도)

| HTTP 코드 | 의미 | Bedrock 상황 | 처리 근거 |
|-----------|------|-------------|----------|
| 500 | Internal Error | Bedrock 내부 오류 | 일시적 오류 가능, 재시도 효과 있음 |
| 502 | Bad Gateway | 프록시 오류 | 네트워크 순간 문제, 재시도 효과 있음 |
| 504 | Gateway Timeout | 타임아웃 | 부하 순간 증가, 재시도 효과 있음 |

### 6.5 Fallback 로깅 (EMF)

```typescript
// 📁 apps/app/app/api/chat/route.ts (Line 276-294)

console.warn(JSON.stringify({
    service: "MegaTicket-Chatbot",
    event: "FallbackTriggered",
    primaryModel: BEDROCK_MODELS.PRIMARY.id,
    fallbackModel: BEDROCK_MODELS.SECONDARY.id,
    Reason: e.name || "Unknown",
    statusCode: statusCode,
    FallbackCount: 1,
    _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{
            Namespace: "MegaTicket/Bedrock",
            Dimensions: [["Reason"]],
            Metrics: [
                { Name: "FallbackCount", Unit: "Count" }
            ]
        }]
    }
}));
```

---

## 7. 스트리밍 처리

### 7.1 ConverseStream API

```typescript
// 📁 apps/app/app/api/chat/route.ts

const response = await bedrockClient.send(
    new ConverseStreamCommand(commandInput)
);

for await (const event of response.stream) {
    // 이벤트 처리
}
```

### 7.2 스트림 이벤트 종류

| 이벤트 | 설명 | 처리 |
|--------|------|------|
| `contentBlockStart` | 텍스트/도구 블록 시작 | 도구 호출 감지 |
| `contentBlockDelta` | 텍스트/입력 청크 | 실시간 스트리밍 |
| `contentBlockStop` | 블록 종료 | 도구 입력 파싱 |
| `messageStop` | 메시지 종료 | stopReason 확인 |
| `metadata` | 토큰 사용량 | EMF 로깅 |

### 7.3 도구 실행 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         도구 실행 흐름                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 스트림에서 toolUse 블록 감지                                         │
│     └─ toolUseId, name, input 수집                                      │
│                                                                         │
│  2. 텍스트 스트리밍 억제 (One Turn = One Response)                       │
│     └─ toolUseDetected = true → 텍스트 출력 안 함                        │
│                                                                         │
│  3. 도구 입력 파싱 (JSON)                                               │
│     └─ 문자열로 축적된 input을 객체로 변환                               │
│                                                                         │
│  4. 도구 실행                                                           │
│     └─ executeTool(name, parsedInput)                                   │
│                                                                         │
│  5. 결과를 toolResult로 메시지에 추가                                    │
│     └─ { toolUseId, content: [{ json: result }], status: "success" }    │
│                                                                         │
│  6. 재귀 호출 (depth + 1)                                               │
│     └─ 최대 깊이: 5 (무한 루프 방지)                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.4 챗봇 vs 웹 역할 분리 (V8.4)

| 기능 | 담당 | 이유 |
|---|---|---|
| 공연/일정/좌석 조회 | **챗봇** | 대화형 안내 |
| 좌석 선점 (hold) | **챗봇** | 가예약 단계까지 지원 |
| 선점 취소 (cancel_hold) | **챗봇** | 선점 상태 해제 지원 |
| 내 예약 조회 | **챗봇** | 단순 조회 (Read-only) |
| **결제 및 예약 확정** | **웹** | PG 연동, 보안, 복잡한 UI 처리 |
| **예약 취소** | **웹** | 환불 규정 안내 및 처리 |

### 7.5 등록된 도구 목록 (7개)

> **Confirm/Cancel 제거됨**: 결제/취소는 웹페이지로 위임되어 `confirm_reservation`, `cancel_reservation` 도구는 제거되었습니다.

| # | 도구명 | 용도 | 캐싱 |
|---|--------|------|------|
| 1 | `get_my_reservations` | 내 예약 조회 (Read only) | ❌ 실시간 |
| 2 | `get_performances` | 공연 목록 | ✅ |
| 3 | `get_performance_details` | 공연 상세 + **cast** | ✅ |
| 4 | `get_performances_schedules` | 일정 목록 + **casting** | ✅ |
| 5 | `get_seat_grades` | 등급/가격 | ✅ |
| 6 | `get_venue_info` | 공연장 정보 | ✅ |
| 7 | `get_available_seats` | 잔여 좌석 | ❌ 실시간 |
| 8 | `hold_seats` | 좌석 선점 (10분) | ❌ 실시간 |
| 9 | `cancel_hold` | 선점 해제 (즉시) | ❌ 실시간 |

---

## 8. CloudWatch 모니터링 (EMF)

> 📄 상세 문서: [cloudwatch-monitoring-guide.md](./cloudwatch-monitoring-guide.md)

### 8.1 기존 방식 문제점 (PutMetricData API)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ❌ 기존 방식: PutMetricData API                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Bedrock 응답 수신                                                   │
│     ↓                                                                   │
│  2. CloudWatchClient 생성 (SDK 의존성)                                  │
│     ↓                                                                   │
│  3. PutMetricData API 호출 ← ⚠️ 추가 HTTP 요청                          │
│     ↓                                                                   │
│  4. 응답 대기 (네트워크 지연)                                            │
│     ↓                                                                   │
│  5. 에러 처리 필요 (try-catch)                                          │
│                                                                         │
│  💰 비용 문제:                                                          │
│  - PutMetricData API 호출당 비용 발생                                   │
│  - 1,000회 대화 × API 호출 = 상당한 비용                                 │
│  - 실패 시 메트릭 손실                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 EMF (Embedded Metric Format) 동작 방식

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ✅ 현재 방식: EMF (Embedded Metric Format)            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Bedrock 응답 수신                                                   │
│     ↓                                                                   │
│  2. console.log()로 EMF JSON 출력 ← ⚡ 즉시 완료                         │
│     ↓                                                                   │
│  3. CloudWatch Logs 에이전트가 자동 수집                                 │
│     ↓                                                                   │
│  4. CloudWatch가 _aws 필드 감지 → 메트릭 자동 생성                       │
│     ↓                                                                   │
│  5. 대시보드에서 확인 가능                                               │
│                                                                         │
│  💰 비용 절감:                                                          │
│  - API 호출 비용: 0원 (로그만 출력)                                      │
│  - 로그 저장 비용만 발생 (매우 저렴)                                     │
│  - 100% 메트릭 수집 보장                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 EMF vs PutMetricData 비교

| 항목 | PutMetricData API (기존) | EMF (현재) |
|------|-------------------------|-----------|
| **API 호출** | 매 요청마다 HTTP 호출 | ❌ 없음 |
| **네트워크 지연** | 추가 Latency 발생 | ❌ 없음 |
| **비용** | Custom Metric API 비용 | **로그 비용만** |
| **구현 복잡도** | SDK 의존성, try-catch 필요 | `console.log` 한 줄 |
| **에러 핸들링** | 실패 시 별도 처리 필요 | 로그는 항상 성공 |
| **메트릭 손실** | API 실패 시 손실 | ❌ 손실 없음 |

> 📌 **비용 절감 효과**: PutMetricData는 요청당 $0.01/1,000 지표 발생. EMF는 로그 기반($0.50/GB)으로 **대량 메트릭 시 비용 90% 이상 절감**.

### 8.4 수집 메트릭

| 메트릭 | 단위 | 설명 | Dimensions |
|--------|------|------|------------|
| `Latency` | Milliseconds | Bedrock 호출 지연 | Model, IsFallback |
| `InputTokens` | Count | 입력 토큰 수 | Model, IsFallback |
| `OutputTokens` | Count | 출력 토큰 수 | Model, IsFallback |
| `TotalTokens` | Count | 총 토큰 수 (Input + Output) | Model, IsFallback |
| `FallbackCount` | Count | Fallback 발생 횟수 | Reason |
| `ToolCallCount` | Count | 도구 호출 횟수 | ToolName |

> 📌 **프롬프트 캐싱 효과 모니터링**: 캐시 히트 시 입력 토큰 비용이 90% 감소하므로 `InputTokens` 감소 추이를 확인

### 8.5 EMF 로그 구조

```json
{
  "service": "MegaTicket-Chatbot",
  "event": "BedrockInvokeSuccess",
  "Model": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "IsFallback": false,
  "Latency": 1234,
  "InputTokens": 500,
  "OutputTokens": 200,
  "_aws": {
    "Timestamp": 1735313554000,
    "CloudWatchMetrics": [{
      "Namespace": "MegaTicket/Bedrock",
      "Dimensions": [["Model"], ["Model", "IsFallback"]],
      "Metrics": [
        { "Name": "Latency", "Unit": "Milliseconds" },
        { "Name": "InputTokens", "Unit": "Count" },
        { "Name": "OutputTokens", "Unit": "Count" }
      ]
    }]
  }
}
```

---

## 9. 인프라 체크리스트

### 9.1 AWS 권한 (IAM)

> 📌 **실제 사용 Role**: `arn:aws:iam::626614672806:role/Bedrock-Chatbot-Role-hyebom`

#### 필요 정책 (2개)

| 정책 | 유형 | 용도 |
|------|------|------|
| **Bedrock 액세스** | 인라인 정책 | 모델 호출, 스트리밍 |
| **DynamoDB 최소 권한** | 인라인 정책 | 예약 데이터 CRUD (8개 액션) |


#### 1. Bedrock + CloudWatch 정책 (인라인)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BedrockInvoke",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": [
                "arn:aws:bedrock:*::foundation-model/anthropic.*",
                "arn:aws:bedrock:*::foundation-model/amazon.*"
            ]
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

#### 2. DynamoDB 최소 권한 정책 (인라인) ✅ 적용됨

> ✅ **최소 권한 원칙 적용 완료** (2025-12-28)  
> 기존 `AmazonDynamoDBFullAccess` → 인라인 정책으로 교체됨

**정책 이름**: `MegaTicket-DynamoDB-MinimalAccess`

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DynamoDBMinimalAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:TransactWriteItems",
                "dynamodb:BatchWriteItem"
            ],
            "Resource": "arn:aws:dynamodb:ap-northeast-2:626614672806:table/KDT-Msp4-PLDR-*"
        }
    ]
}
```

**사용 중인 DynamoDB 액션 (8개):**

| 액션 | 용도 | 설명 |
|------|------|------|
| `GetItem` | 단일 아이템 조회 | PK로 특정 아이템 1개를 조회. 공연/공연장 상세 정보 조회에 사용. |
| `PutItem` | 아이템 생성 | 새 아이템을 테이블에 삽입. 예약 생성 시 사용. |
| `UpdateItem` | 필드 수정 | 기존 아이템의 특정 필드만 업데이트. TTL 갱신, 상태 변경에 사용. |
| `DeleteItem` | 아이템 삭제 | PK로 특정 아이템 1개를 삭제. 예약 취소 이력 삭제에 사용. |
| `Query` | 조건부 조회 | PK + SK 또는 GSI를 이용한 효율적 조회. 사용자별 예약 목록 조회에 사용. |
| `Scan` | 전체 조회 | 테이블 전체를 스캔. 캐싱되는 정적 테이블(공연/공연장)에만 사용. |
| `TransactWriteItems` | 트랜잭션 쓰기 | 여러 테이블에 걸친 원자적 쓰기 작업. 좌석 선점 시 동시성 제어에 필수. |
| `BatchWriteItem` | 대량 쓰기 | 한 번에 최대 25개 아이템 일괄 생성/삭제. 스케줄 대량 생성 스크립트에 사용. |



### 9.2 환경변수 및 DR 설정 (Standardized)

**필수 환경변수 목록** (DR 환경 배포 시 확인):

| 환경변수명 | 설명 | Main (서울) 값 | DR (도쿄) 값 예시 |
|------------|------|----------------|-------------------|
| `AWS_REGION` | AWS 리전 | `ap-northeast-2` | `ap-northeast-1` |
| `DYNAMODB_PERFORMANCES_TABLE` | 공연 테이블 | `KDT-Msp4-PLDR-performances` | `KDT-Msp4-PLDR-performances` (Global Table) |
| `DYNAMODB_VENUES_TABLE` | 공연장 테이블 | `KDT-Msp4-PLDR-venues` | `KDT-Msp4-PLDR-venues` (Global Table) |
| `DYNAMODB_RESERVATIONS_TABLE` | 예약 테이블 | `KDT-Msp4-PLDR-reservations` | `KDT-Msp4-PLDR-reservations` (Global Table) |
| `DYNAMODB_SCHEDULES_TABLE` | 스케줄 테이블 | `KDT-Msp4-PLDR-schedules` | `KDT-Msp4-PLDR-schedules` (Global Table) |
| `DR_RECOVERY_MODE` | 장애 복구 모드 | `false` | `true` (장애 시) |

> 📌 **DR 전략**: DynamoDB Global Table을 사용하므로 테이블명은 동일하게 유지되며, `AWS_REGION` 변경만으로 가장 가까운 리전의 테이블 엔드포인트에 접속합니다.

#### DR_RECOVERY_MODE (`true`) 가 필요한 이유?

*   **기능**: 장애 복구 시 **[유예 기간 (Grace Period)]** 로직이 활성화됩니다.
*   **시나리오**:
    1.  사용자가 **서울 리전**에서 좌석을 **선점(Holding)** 하고 결제 중이었는데, 갑자기 **서울 리전 장애 발생**.
    2.  사용자는 자동으로 **도쿄 리전(DR)**으로 라우팅되어 접속.
    3.  **FALSE인 경우**: 도쿄 리전은 "이 선점 데이터(서울 생성)는 만료되었거나 비정상적이다"라고 판단하여 **예약 거부**.
    4.  **TRUE인 경우**: 아래 로직으로 상태 결정:
        - **DR_RECOVERED**: `holdingCreatedAt < DR_RECOVERY_START_TIME` → Main에서 장애 전 선점한 건 (15분 유예)
        - **DR_RESERVED**: `holdingCreatedAt >= DR_RECOVERY_START_TIME` → DR에서 새로 예약한 건 (영구 보존)
*   **효과**: 장애 상황에서 사용자의 **진행 중인 예약(In-flight Transaction)을 구제**하여 오류 없이 예약을 마무리할 수 있게 해줍니다.

#### Docker 환경 (docker-compose.yml) 매핑 확인

```yaml
environment:
  - AWS_REGION=${AWS_REGION:-ap-northeast-2}
  - DYNAMODB_PERFORMANCES_TABLE=${DYNAMODB_PERFORMANCES_TABLE:-KDT-Msp4-PLDR-performances}
  # ... (기타 테이블 변수 매핑)
```

### 9.3 사용 AWS SDK

| SDK 패키지 | 버전 | 용도 |
|------------|------|------|
| `@aws-sdk/client-bedrock-runtime` | ^3.953.0 | Bedrock 모델 호출, 스트리밍 |
| `@aws-sdk/client-cloudwatch` | ^3.953.0 | CloudWatch 연동 (EMF) |
| `@aws-sdk/client-dynamodb` | ^3.958.0 | DynamoDB 클라이언트 |
| `@aws-sdk/lib-dynamodb` | ^3.958.0 | DynamoDB 문서 클라이언트 |

### 9.4 완료 상태 체크리스트

| # | 항목 | 상태 | 구현 위치 | 비용 효과 |
|---|------|------|----------|----------|
| 1 | Primary 모델 (Claude Haiku 4.5) | ✅ 완료 | `bedrock-config.ts` | 프롬프트 캐싱 지원 |
| 2 | Secondary 모델 (Nova Lite) | ✅ 완료 | `bedrock-config.ts` | 저비용 Fallback |
| 3 | Global 교차리전 프로파일 | ✅ 완료 | Model ID | 라우팅 비용 0원 |
| 4 | APAC 교차리전 프로파일 | ✅ 완료 | Model ID | 아시아 내 라우팅 |
| 5 | 프롬프트 캐싱 활성화 | ✅ 완료 | `route.ts` L95-99 | 입력 토큰 90% 절감 |
| 6 | Fallback 로직 구현 | ✅ 완료 | `route.ts` L265-306 | 서비스 연속성 |
| 7 | EMF 메트릭 구현 | ✅ 완료 | `route.ts` L197-217 | API 호출 비용 0원 |
| 8 | 스트리밍 처리 | ✅ 완료 | `route.ts` L121-182 | 사용자 경험 향상 |
| 9 | 도구 실행 로직 | ✅ 완료 | `route.ts` L219-263 | - |
| 10 | 인메모리 캐싱 | ✅ 완료 | `performance-service.ts` | DB 비용 절감 |
| 11 | DynamoDB 테이블 4개 | ✅ 완료 | `dynamodb.ts` | - |
| 12 | GSI (userId-index) | ✅ 완료 | DynamoDB | Query 최적화 |
| 13 | Global Tables (도쿄 DR) | ✅ 완료 | DynamoDB | 재해 복구 |
| 14 | IAM Role (Bedrock + DynamoDB) | ✅ 완료 | AWS IAM | 최소 권한 원칙 |

---

---

## 11. ⭐ 할루시네이션 방지 및 사용성 개선 (V8.3)

### 11.1 좌석/가격 정보 왜곡 방지
- **문제**: AI가 임의로 좌석 번호("7열 15번")나 가격을 생성하여 제공.
- **해결**:
  - `step-5-seats.ts`: 도구 결과(`recommendedOptions`) 이외의 정보 언급 시 **서비스 장애**로 간주하는 강력한 프롬프트 적용.
  - **Confirm 단계(STEP 6) 추가**: 사용자가 좌석 번호만 말했을 때 즉시 예약을 진행하지 않고, "이 좌석으로 하시겠습니까?"라고 되묻는 안전장치 마련.

### 11.2 시간대(Timezone) 혼란 방지
- **문제**: 서버의 UTC 시간(`expiresAt`)을 AI가 그대로 읽어 "07:00까지 예약하세요"라고 잘못 안내(한국 시간은 16:00).
- **해결**:
  - **Server-Side Formatting**: `holding-manager.ts`에서 KST(한국 시간)로 포맷팅된 `expiresAtText` 필드("16:00")를 반환.
  - **Prompt Enforcement**: AI에게 UTC 시간 계산을 금지하고, 서버가 제공한 텍스트 필드만 사용하도록 강제.

### 11.3 챗봇 DR(재해 복구) 안내 전략
- **시나리오**: 메인 리전(Seoul) 장애로 예약을 완료하지 못한 경우.
- **동작**:
  1. `get_user_reservations` 도구가 `dr_recovered` 상태의 예약을 반환.
  2. `base-prompt.ts`에 정의된 규칙에 따라 AI가 다음 안내 메시지 출력:
     - "⚠️ **[장애 복구]** 선점된 좌석이 임시 보호 중입니다!"
     - "👉 **[내 예약]** 메뉴에서 결제를 완료해주세요!"
  3. 챗봇 내 직접 처리 대신 웹의 안전한 결제 페이지로 유도하여 데이터 정합성 유지.

---

## 10. 참고 자료

### AWS 공식 문서

- [Amazon Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)
- [Amazon Bedrock Inference Profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
- [Amazon Bedrock Prompt Caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)

### 관련 문서

- [Chatbot_Prompt_Guide.md](./Chatbot_Prompt_Guide.md) - 챗봇 프롬프트 가이드
- [cloudwatch-monitoring-guide.md](./cloudwatch-monitoring-guide.md) - CloudWatch 상세 가이드
- [DynamoDB_Schema.md](./DynamoDB_Schema.md) - 데이터베이스 스키마

---

## 🔄 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-01-04 | **V8.4** | 예약 진행 단계별 버튼 UX 최적화 (선점/확정/보기), 좌석 추천 포맷 개선 (Full ID) |
| 2026-01-04 | **V8.3** | 할루시네이션 방지, KST 시간 처리, DR 안내 추가 및 **좌석 ID/가격 누락 방어 로직 구현** |
| 2026-01-04 | V8.1 | 캐스팅 필드(cast/casting) 도구 반환값 추가, 프롬프트 모듈화 비용 분석 상세화 |
| 2026-01-03 | V8.0 | 프롬프트 모듈화 (1개→15개 파일), 75% 토큰 절감 |
| 2025-12-28 | V7.14 | 비용 최적화 섹션 추가, 교차리전 상세화, 체크리스트 추가 |

---

## 12. 좌석 선점 안정성 및 UX 강화 (V8.27)

### 12.1 작업 개요
사용자가 좌석 선점 시도 시 UI(타이머, 버튼)가 표시되지 않거나 데이터 저장 여부가 불확실했던 문제를 해결하기 위해 **3중 안전장치**를 도입했습니다.

### 12.2 주요 변경 사항 (User Perspective)
1.  **시스템 레벨 강제 주입 (Fail-Safe UI Injection)**: 챗봇 AI가 좌석 선점에 성공하고도 실수로 버튼(Action Data)을 생성하지 않을 경우, 시스템(`route.ts`)이 이를 감지하여 **강제로 화면에 타이머와 결제 버튼을 띄웁니다.** (가장 강력한 1차 안전장치)
2.  **DB 무결성 검증 (Verify-After-Write)**: 좌석 선점 시 데이터가 확실히 저장되었는지 "서버 문지기"가 한 번 더 확인합니다. 저장이 확인되지 않으면 자동으로 재시도하여 데이터 유실을 방지합니다.
3.  **결제 링크 백업 (Fallback UI)**: 화면에 버튼이 뜨지 않는 오류가 발생해도, 챗봇 메시지 내의 **[결제 완료하러 가기]** 텍스트 링크를 통해 결제를 진행할 수 있습니다.
4.  **입력값 검증 강화**: AI가 잘못된 좌석 정보(예: "5~6번")를 전달하거나 잘못된 안내를 하지 않도록 입구에서 차단합니다.

### 12.3 개발 및 인프라 상세 (Technical Perspective)

#### 🔧 관련 파일 및 변경 내용
| 파일 | 변경 내용 |
|------|----------|
| `route.ts` | **Fail-Safe Logic**: 선점 성공(`holdingId`) 시 ACTION_DATA 강제 주입 & Tool 검증 수정 |
| `holding-manager.ts` | Verify-After-Write (Strong Consistent Read) 및 재시도(Retry) 로직 추가 |
| `holding-tools.ts` | Fallback Markdown 링크 생성, seatIds 입력값 유효성(Array) 검증 |
| `base-prompt.ts` | DR(재해복구) 안내 멘트 조건 강화 (오발송 수정) |

#### 🏗️ 인프라 영향 분석
- **DynamoDB**: 선점 트랜잭션마다 `GetItem`(ConsistentRead)이 1회 추가 수행됩니다.
    - 영향: Write 요청 1회당 Read Unit(RCU) 1 추가 소비.
    - 비용: On-demand 모드를 사용 중이므로 전체 청구 비용에 미치는 영향은 미미함 (예상 비용 증가율 < 5%).
- **Latency**: 검증 로직 추가로 인해 응답 시간이 수 ms 증가할 수 있으나, 안전성 확보를 위한 필수 비용으로 간주됩니다.

#### 🚨 롤백 방법 (Emergency Rollback)
배포 후 심각한 문제 발생 시 V8.26 버전(직전 커밋)으로 롤백합니다.
```bash
# holding-manager.ts 롤백
git checkout v8.26 -- apps/app/lib/server/holding-manager.ts

# 변경 사항 적용
git commit -m "Revert: V8.27 changes due to critical issue"
git push origin main
```

### 12.4 테스트 결과
1.  **챗봇 응답**: "좌석이 선점되었습니다!" 메시지와 함께 타이머, 결제 버튼 정상 표시.
2.  **UI Fallback**: 버튼 렌더링 실패 시 텍스트 링크로 결제 페이지 이동 가능 확인.
3.  **데이터 무결성**: DynamoDB에 `HOLDING` 상태 및 `expiresAt` 정확하게 저장됨.

---

## 13. Auto Scaling & Retry Logic Safety (V8.29)

### 13.1 Auto Scaling 환경에서의 안전성

> Q. "ASG에서 App/Web 인스턴스가 각각 3개씩 늘어나도 서비스 영향이 없나요?"
>
> **A. 네, 서비스에 전혀 문제 없습니다.** (안심하셔도 됩니다! 🏗️)

그 이유를 기술적으로 명확히 설명해 드릴게요.

#### 1. 🔄 `RETRY_CACHE`는 요청 내에서 완벽하게 동작합니다.

우리가 구현한 **Self-Correction(자동 재시도)** 로직은, AI가 에러를 내면 **"같은 서버의 같은 프로세스 안에서"** 함수를 재귀적으로(`recursion`) 다시 호출하는 방식입니다.

* 즉, AI가 실수를 수습하는 과정(1차 시도 → 실패 → 2차 시도)은 **단 하나의 HTTP 연결 안에서** 순식간에 일어납니다.
* 중간에 ALB를 타고 다른 서버로 튕겨 나갈 일이 없으므로, 현재 접속된 인스턴스의 메모리(`RETRY_CACHE`)를 정확하게 참조합니다.

#### 2. 💺 좌석 선점 데이터는 DynamoDB가 지킵니다.

인스턴스가 3개든 100개든, 좌석 데이터의 원본(Source of Truth)은 **DynamoDB**입니다.

* `holding-manager.ts`에 이미 구현된 **Verify-After-Write**와 **Conditional Update** 로직이 동시성 문제를 해결해 줍니다.
* A서버와 B서버에서 동시에 같은 좌석을 잡으려 해도, DB 레벨에서 정확히 1명만 성공값(`true`)을 받게 됩니다.

#### 3. 🌐 새로운 대화는 리셋되는 것이 맞습니다.

만약 사용자가 브라우저를 새로고침하거나 나중에 다시 접속해서 다른 인스턴스(Server B)에 연결된다면?

* 이때는 `RETRY_CACHE`가 없으므로 카운트가 0으로 시작합니다.
* 이는 버그가 아니라 **올바른 동작**입니다. 새로운 시도에는 새로운 기회(Retry Chance)를 주는 것이 자연스럽기 때문입니다.

**결론:** 인스턴스를 3개씩 늘리셔도 로직은 완벽하게 작동하며, 오히려 가용성이 높아져서 더 튼튼한 서비스가 됩니다! 🚀

---

**Last Updated**: 2026-01-05  
**Maintainer**: 설혜봄 (MSP-Project-Pilot-Light)