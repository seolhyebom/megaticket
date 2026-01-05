# MegaTicket DynamoDB Schema Documentation

> **문서 버전**: V7.18  
> **최종 수정**: 2026-01-01  
> **작성자**: Antigravity (AI 어시스턴트)  
> **AWS 리전**: ap-northeast-2 (기본값, `AWS_REGION` 환경변수로 변경 가능)  
> **테이블 접두사**: `KDT-Msp4-PLDR-*` (기본값, `DYNAMODB_*_TABLE` 환경변수로 변경 가능)  
> **데이터 출처**: AWS DynamoDB 실제 Scan 조회 결과 기반 (2026-01-01)

---

## 📋 목차

1. [테이블 개요](#-테이블-개요)
2. [performances 테이블](#-performances-테이블)
3. [reservations 테이블](#-reservations-테이블)
4. [schedules 테이블](#-schedules-테이블)
5. [venues 테이블](#-venues-테이블)
6. [테이블 간 관계](#-테이블-간-관계)
7. [키 생성 함수](#-키-생성-함수)
8. ⭐ [TTL (Time To Live) 상세](#-ttl-time-to-live-상세)
9. [환경변수](#️-환경변수)
10. [데이터 타입 범례](#-데이터-타입-범례)
11. [코드와 DB 필드명 차이](#️-코드와-db-필드명-차이)
12. [주요 쿼리 패턴](#-주요-쿼리-패턴)
13. [개선 완료 사항](#-개선-완료-사항)
14. ⭐ [인메모리 캐싱 전략](#-인메모리-캐싱-전략)
15. [DR_RECOVERED 상태 상세](#-dr_recovered-상태-상세)
16. ⭐ [GSI (Global Secondary Index) 인프라 설정](#-gsi-global-secondary-index-인프라-설정)
17. ⭐ [비정규화 (Denormalization) 전략](#-비정규화-denormalization-전략)
18. ⭐ [Global Tables (DR 복제) 설정 현황](#-global-tables-dr-복제-설정-현황)
19. ⭐ [인프라 체크리스트](#-인프라-체크리스트-2025-12-28-완료)

### 🏗️ 인프라 관련 섹션 (AWS Best Practice)

| 섹션 | 주요 내용 |
|------|----------|
| ⭐ 8. TTL 상세 | 자동 삭제 설정, holdExpiresAt 10분 (V7.22) |
| ⭐ 14. 인메모리 캐싱 | 7일 TTL, RCU 99%+ 절감 |
| ⭐ 16. GSI 인프라 설정 | userId-index, 비용 최적화 |
| ⭐ 17. 비정규화 전략 | JOIN 없이 단일 쿼리, 읽기 비용 절감 |
| ⭐ 18. Global Tables | 도쿄 DR 복제, 자동 동기화 |
| ⭐ 19. 인프라 체크리스트 | 완료 상태 확인 |
| 📌 20. Performances GSI | status-index, Scan→Query 최적화 |
| 📌 21. 마이그레이션 가이드 | status 필드 추가 스크립트 |

---

## 📋 테이블 개요

| 테이블명 | 파티션 키 | 정렬 키 | TTL 필드 | 용도 |
|---------|----------|--------|---------|------|
| KDT-Msp4-PLDR-performances | performanceId (S) | - | - | 공연 마스터 데이터 |
| KDT-Msp4-PLDR-reservations | PK (S) | SK (S) | ttl, holdExpiresAt | 좌석 선점/예약 트랜잭션 |
| KDT-Msp4-PLDR-schedules | scheduleId (S) | - | - | 공연 회차 정보 |
| KDT-Msp4-PLDR-venues | venueId (S) | - | - | 공연장 마스터 데이터 |

---

## 📦 performances 테이블

### 목적
공연의 **마스터 데이터**를 저장하는 테이블.  
- 공연 제목, 설명, 공연 기간, 포스터 이미지 등 공연 기본 정보
- **좌석 등급별 가격 정보** (`seatGrades`) - 챗봇 가격 조회의 SSOT
- **출연진 정보** (`cast`) - 역할별 배우 목록
- **OP석 판매 여부** (`hasOPSeats`) - 공연별 OP석 존재 여부 결정

### 주요 사용처
- 챗봇: `get_performances`, `get_performance_details`, `get_seat_grades` 도구
- 프론트엔드: 공연 목록 페이지, 공연 상세 페이지

### 키 구조
- **Partition Key**: `performanceId` (String)

### 실제 DB 필드 (Scan 조회 결과)

| 필드명 | DynamoDB 타입 | 실제 예시값 | 설명 |
|-------|--------------|------------|------|
| `performanceId` | S | `perf-kinky-1` | 공연 고유 ID **(PK)** |
| `title` | S | `킹키부츠` | 공연 제목 |
| `description` | S | `신디 로퍼 작곡의 감동적인 브로맨스...` | 공연 설명 |
| `venue` | S | (venues.name 참조 비정규화) | 공연장명 |
| `venueId` | S | `charlotte-theater` | 공연장 ID (FK → venues) |
| `posterUrl` | S | `/posters/kinky.jpg` | 포스터 이미지 경로 |
| `dateRange` | S | `2026.02.10 ~ 2026.04.30` | 공연 기간 |
| `price` | S | `OP석 170,000원 / R석 140,000원...` | 가격 안내 텍스트 (UI 표시용) |
| `hasOPSeats` | BOOL | `true` | OP석 판매 여부 |
| `seatGrades` | L (List) | (아래 참조) | 좌석 등급/가격 배열 **(SSOT)** |
| `seatColors` | M (Map) | `{"VIP": "#FF0000", "R": "#FFA500"...}` | 좌석 배치도 색상 |
| `cast` | M (Map) | (아래 참조) | 출연진 정보 (역할별 배우) |
| `createdAt` | S | `2025-12-23T01:47:07.861Z` | 생성일시 (ISO 8601) |
| `status` | S | `ACTIVE` | 공연 상태 (GSI 파티션 키) - V7.17 추가 |

### seatGrades 필드 구조 (DB 실제 데이터)

> ⚠️ **SSOT**: 챗봇에서 좌석 등급/가격 정보를 응답할 때 이 데이터를 직접 사용해야 함. 하드코딩 금지!

```json
{
  "seatGrades": [
    {
      "grade": "VIP",
      "price": 170000,
      "color": "#FF0000",
      "description": "1층 정중앙 앞쪽, 최고의 시야"
    },
    {
      "grade": "R",
      "price": 140000,
      "color": "#FFA500"
    },
    {
      "grade": "S",
      "price": 110000,
      "color": "#1E90FF"
    },
    {
      "grade": "A",
      "price": 80000,
      "color": "#32CD32"
    },
    {
      "grade": "OP",
      "price": 170000,
      "color": "#9E37D1"
    }
  ]
}
```

### cast 필드 구조 (DB 실제 데이터)

> ⚠️ **타입**: Map (M) - 역할명(key)에 배우명 배열(value) 구조

```json
{
  "cast": {
    "charlie": ["김호영", "신재범", "이재환"],
    "lola": ["서경수", "강홍석", "백형훈"],
    "lauren": ["한재아", "허윤슬"],
    "don": ["심재현", "신승환", "김동현"],
    "nicola": ["이루원", "유주연"]
  }
}
```

---

## 📦 reservations 테이블

### 목적
**좌석 선점(Holding)과 예약(Reservation)의 트랜잭션 상태**를 관리하는 핵심 테이블.
- **좌석 1개 = 레코드 1개** 구조 (N명 예약 시 N개 레코드 생성)
- 선점 시 10분 TTL 설정 (V7.22: 60초 → 600초), 시간 초과 시 DynamoDB TTL로 자동 삭제
- 예약 취소 시 7일간 보존 후 자동 삭제 (사용자 이력 조회용)
- **DR_RECOVERED**: Main 리전에서 HOLDING 중 장애 발생 → DR 리전에서 15분 유예로 복구
- **DR_RESERVED**: DR 리전에서 새로 예약한 건 (영구 보존)

### 주요 사용처
- 챗봇: `hold_seats`, `confirm_reservation`, `cancel_reservation`, `get_user_reservations`
- 좌석 배치도: `getSeatStatusMap()` - 판매된/선점중/예매가능 좌석 표시
- 관리자: 예약 현황 조회

### 키 구조
- **Partition Key**: `PK` (String) - 형식: `PERF#{performanceId}#{date}#{time}`
- **Sort Key**: `SK` (String) - 형식: `SEAT#{seatId}`

> 📝 **키 설계 의도**: 동일 회차(공연+날짜+시간)의 모든 좌석을 한 번의 Query로 조회 가능

### TTL (Time To Live) 설정

| 상태 | TTL 필드 | 만료 시간 | 동작 |
|-----|---------|----------|------|
| **HOLDING** | `holdExpiresAt` | **10분** | 만료 시 DynamoDB 자동 삭제 (좌석 해제) |
| **DR_RECOVERED** | `ttl` | **15분** | Main에서 HOLDING 중 장애 → DR에서 복구, 15분 후 자동 삭제 |
| **CANCELLED** | `ttl` | **7일** | 취소 후 7일간 보존 (사용자 이력), 이후 자동 삭제 |
| **CONFIRMED** | - | 없음 | 영구 보존 - Main(서울) 리전 예약 |
| **DR_RESERVED** | - | 없음 | 영구 보존 - DR(도쿄) 리전 예약 |

> ⚠️ **TTL 환경변수**: `CANCELLED_RETENTION_DAYS=7` (기본값 7일)

### 실제 DB 필드 (Scan 조회 결과)

| 필드명 | DynamoDB 타입 | 실제 예시값 | 설명 |
|-------|--------------|------------|------|
| `PK` | S | `PERF#perf-phantom-1#2026-03-05#19:30` | 파티션 키 |
| `SK` | S | `SEAT#1층-B-7-6` | 정렬 키 |
| `status` | S | `CONFIRMED` | 상태값 (아래 상태 흐름 참조) |
| `holdingId` | S | `6a7a-fd9f-4452-9e3b-89dc90f8aeaf` | 선점 ID (UUID, HOLDING 시 생성) |
| `reservationId` | S | `770e-xxxx-xxxx-xxxx` | 예약 ID (UUID, CONFIRMED 시 생성) |
| `userId` | S | `visitor-abc123` | 사용자 식별자 (visitorId) |
| `performanceId` | S | `perf-phantom-1` | 공연 ID |
| `performanceTitle` | S | `오페라의 유령` | 공연명 (비정규화, CONFIRMED 시 저장) |
| `venue` | S | `샤롯데씨어터` | 공연장명 (비정규화) |
| `posterUrl` | S | `/posters/opera.png` | 포스터 URL (비정규화) |
| `date` | S | `2026-03-05` | 공연 날짜 (YYYY-MM-DD) |
| `time` | S | `19:30` | 공연 시간 (HH:MM) |
| `seatId` | S | `1층-B-5-8` | 좌석 ID |
| `seatNumber` | N | `8` | 좌석 번호 |
| `rowId` | S | `5` | 열 ID (숫자 또는 "OP") |
| `grade` | S | `VIP` | 좌석 등급 |
| `price` | N | `170000` | 좌석 가격 (원) |
| `createdAt` | S | `2025-12-28T05:10:00.000Z` | 생성 시간 (ISO 8601) |
| `expiresAt` | S | `2025-12-28T05:11:00.000Z` | 만료 시간 (HOLDING용, ISO 8601) |
| `confirmedAt` | S | `2025-12-28T05:10:30.000Z` | 예약 확정 시간 |
| `cancelledAt` | S | `2025-12-28T06:00:00.000Z` | 취소 시간 |
| `holdExpiresAt` | N | `1735365060` | **TTL 필드** (Unix timestamp, HOLDING 10분) |
| `ttl` | N | `1735969860` | **TTL 필드** (Unix timestamp, CANCELLED 7일) |
| `sourceRegion` | S | `ap-northeast-2` | 예약 생성 리전 (아래 상세 설명 참조) |

### sourceRegion 필드 상세

> ⚠️ **주의**: 이 필드는 **V7.16 이후 새로 생성되는 예약**에만 저장됩니다. 기존 예약에는 없습니다.

| 값 | 의미 | 환경 |
|----|------|------|
| `ap-northeast-2` | 서울 리전에서 생성된 예약 | Main (정상 운영) |
| `ap-northeast-1` | 도쿄 리전에서 생성된 예약 | DR (장애 복구) |

**용도**: DR 복구 후 "이 예약이 어느 리전에서 생성되었는지" 추적하여 운영팀이 Main/DR 예약을 구분할 수 있습니다.

### 비정규화 필드 설명

> 📝 **비정규화(Denormalization)**: DynamoDB는 JOIN이 불가능하므로, 자주 함께 조회되는 데이터를 복사하여 저장합니다.

| 비정규화 필드 | 원본 테이블 | 저장 시점 | 목적 |
|--------------|-------------|----------|------|
| `performanceTitle` | performances.title | CONFIRMED 시 | 마이페이지에서 공연명 즉시 표시 |
| `venue` | venues.name | CONFIRMED 시 | 마이페이지에서 공연장명 즉시 표시 |
| `posterUrl` | performances.posterUrl | CONFIRMED 시 | 마이페이지에서 포스터 즉시 표시 |

**장점**: 예약 목록 조회 시 **단일 Query**로 완전한 데이터 획득 (performances, venues 추가 조회 불필요)

**단점**: 원본 데이터 변경 시 동기화 필요 (공연 정보는 거의 변경되지 않으므로 무시 가능)

### 상태 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                        좌석 예약 플로우                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [좌석 선택] (hold_seats 호출)                                   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ HOLDING │  ← holdExpiresAt = 현재시간 + 10분                  │
│  └────┬────┘                                                    │
│       │                                                         │
│       ├───── 10분 경과 ────→ [DynamoDB TTL 자동 삭제] (좌석 해제) │
│       │                                                         │
│       │ confirm_reservation 호출                                │
│       ▼                                                         │
│  ┌───────────┐                                                  │
│  │ CONFIRMED │  ← 영구 보존 (취소 전까지)                         │
│  └─────┬─────┘                                                  │
│        │                                                        │
│        │ cancel_reservation 호출                                │
│        ▼                                                        │
│  ┌───────────┐                                                  │
│  │ CANCELLED │  ← ttl = 현재시간 + 7일                           │
│  └─────┬─────┘                                                  │
│        │                                                        │
│        └───── 7일 경과 ────→ [DynamoDB TTL 자동 삭제]             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│               DR 리전 신규 예약 플로우 (도쿄)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Main 장애 발생] → [DR 리전으로 Failover]                        │
│       │               DR_RECOVERY_MODE=true                     │
│       ▼                                                         │
│  [새 좌석 선택] (hold_seats 호출)                                 │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ HOLDING │  ← holdExpiresAt = 현재시간 + 10분                  │
│  └────┬────┘                                                    │
│       │ confirm_reservation 호출                                │
│       ▼                                                         │
│  ┌─────────────┐                                                │
│  │ DR_RESERVED │  ← DR 리전에서 새로 예약한 건 (영구 보존)         │
│  └─────────────┘                                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│           장애 복구 플로우 (Main에서 HOLDING 중 장애)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Main에서 HOLDING 중] → [장애 발생!] → [DR 리전으로 Failover]     │
│       │                    DR_RECOVERY_MODE=true                │
│       │                    DR_RECOVERY_START_TIME=장애시점       │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ HOLDING │  (10분 타이머 만료됨, 정상이면 삭제됐을 건)            │
│  └────┬────┘                                                    │
│       │ 사용자가 DR 리전에서 confirm_reservation 호출             │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │ DR_RECOVERED │  ← ttl = 현재시간 + 15분 (복구 유예기간)        │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ├───── 15분 경과 ────→ [자동 삭제] (좌석 해제)            │
│         │                                                       │
│         │ 사용자가 결제 완료 (confirm_reservation 재호출)         │
│         ▼                                                       │
│  ┌───────────┐                                                  │
│  │ CONFIRMED │  ← 정상 예약 완료                                 │
│  └───────────┘                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 레코드 예시

```json
{
  "PK": "PERF#perf-kinky-1#2026-02-10#19:30",
  "SK": "SEAT#1층-B-7-14",
  "status": "CONFIRMED",
  "holdingId": "550e8400-e29b-41d4-a716-446655440000",
  "reservationId": "660e8400-e29b-41d4-a716-446655440001",
  "userId": "visitor-abc123",
  "performanceId": "perf-kinky-1",
  "performanceTitle": "킹키부츠",
  "venue": "샤롯데씨어터",
  "posterUrl": "/posters/kinky.jpg",
  "date": "2026-02-10",
  "time": "19:30",
  "seatId": "1층-B-7-14",
  "seatNumber": 14,
  "rowId": "7",
  "grade": "VIP",
  "price": 170000,
  "createdAt": "2025-12-28T05:10:00.000Z",
  "confirmedAt": "2025-12-28T05:10:30.000Z"
}
```

---

## 📦 schedules 테이블

### 목적
공연의 **회차(스케줄) 정보**를 저장하는 테이블.
- 날짜/시간별 공연 회차 관리
- 회차별 잔여 좌석 수 (`availableSeats`) 관리
- 회차별 캐스팅 정보 (`casting`) - 특정 회차에 출연하는 배우

### 주요 사용처
- 챗봇: `get_performance_schedules` 도구 - 날짜/시간 선택
- 프론트엔드: 공연 상세 페이지 캘린더

### 키 구조
- **Partition Key**: `scheduleId` (String)
- **GSI (Global Secondary Index)**: `performanceId-index` (PK: `performanceId`) - 공연별 회차 목록 조회용

### scheduleId 형식

```
{performanceId}-{YYYY-MM-DD}-{HH:MM}

예시:
- perf-kinky-1-2026-04-24-19:30   (킹키부츠 2026년 4월 24일 19:30)
- perf-phantom-1-2026-03-05-14:30 (오페라의유령 2026년 3월 5일 14:30)
```

### 실제 DB 필드 (Scan 조회 결과)

| 필드명 | DynamoDB 타입 | 실제 예시값 | 설명 |
|-------|--------------|------------|------|
| `scheduleId` | S | `perf-kinky-1-2026-04-24-19:30` | 회차 고유 ID **(PK)** |
| `performanceId` | S | `perf-kinky-1` | 공연 ID (FK → performances) |
| `date` | S | `2026-04-24` | 공연 날짜 (YYYY-MM-DD) |
| `time` | S | `19:30` | 공연 시간 (HH:MM) |
| `datetime` | S | `2026-04-24T19:30` | 날짜+시간 결합 (조회 편의) |
| `dayOfWeek` | S | `금` | 요일 (월/화/수/목/금/토/일) |
| `totalSeats` | N | `1210` | 총 좌석 수 |
| `availableSeats` | N | `1210` | 잔여 좌석 수 |
| `status` | S | `AVAILABLE` | 상태 (AVAILABLE/SOLDOUT/CANCELLED) |
| `casting` | M (Map) | (아래 참조) | **회차별 캐스팅 정보** |
| `createdAt` | S | `2025-12-25T17:34:24.780143Z` | 생성일시 |

### casting 필드 구조 (DB 실제 데이터)

> ⚠️ **필드명**: `casting` (Map 타입) - `cast` 아님!  
> performances 테이블의 `cast`와 구조는 동일하나 필드명이 다름

```json
{
  "casting": {
    "charlie": ["김호영", "신재범", "이재환"],
    "lola": ["서경수", "강홍석", "백형훈"],
    "lauren": ["한재아", "허윤슬"],
    "don": ["심재현", "신승환", "김동현"],
    "nicola": ["이루원", "유주연"]
  }
}
```

### 레코드 예시

```json
{
  "scheduleId": "perf-kinky-1-2026-04-24-19:30",
  "performanceId": "perf-kinky-1",
  "date": "2026-04-24",
  "time": "19:30",
  "datetime": "2026-04-24T19:30",
  "dayOfWeek": "금",
  "totalSeats": 1210,
  "availableSeats": 1210,
  "status": "AVAILABLE",
  "casting": { ... },
  "createdAt": "2025-12-25T17:34:24.780143Z"
}
```

---

## 📦 venues 테이블

### 목적
**공연장 마스터 데이터**를 저장하는 테이블.
- 공연장 이름, 주소, 유형 등 기본 정보
- **좌석 배치 구조** (`sections`) - 구역/열/좌석 배치도 정의
- 총 좌석 수, 층별 좌석 수 등 통계 정보

### 주요 사용처
- 챗봇: `get_venue_info` 도구 - 공연장 정보 조회
- 프론트엔드: 좌석 배치도 렌더링 (`SeatMap` 컴포넌트)

### 키 구조
- **Partition Key**: `venueId` (String)

### 실제 DB 필드 (Scan 조회 결과)

| 필드명 | DynamoDB 타입 | 실제 예시값 | 설명 |
|-------|--------------|------------|------|
| `venueId` | S | `charlotte-theater` | 공연장 고유 ID **(PK)** |
| `name` | S | `샤롯데씨어터` | 공연장 이름 |
| `address` | S | `서울 송파구 올림픽로 240` | 주소 |
| `venueType` | S | `theater` | 공연장 유형 |
| `totalSeats` | N | `1210` | 총 좌석 수 |
| `floor1Seats` | N | `690` | 1층 좌석 수 |
| `floor2Seats` | N | `520` | 2층 좌석 수 |
| `sections` | L (List) | (아래 참조) | 구역별 좌석 배치 |
| `sectionConfig` | M (Map) | (아래 참조) | **좌석 추천 스코어링 설정 (SSOT)** (V8.21) |

### sections 필드 구조 (DB 실제 데이터)

```json
{
  "sections": [
    {
      "sectionId": "A",
      "floor": "1층",
      "rows": [
        {
          "rowId": "13",
          "grade": "A",
          "length": 12,
          "seats": [
            {"seatId": "1층-A-13-1", "seatNumber": 1, "status": "available"},
            {"seatId": "1층-A-13-2", "seatNumber": 2, "status": "available"}
          ]
        }
      ]
    },
    {
      "sectionId": "B",
      "floor": "1층",
      "rows": [
        {
          "rowId": "OP",
          "grade": "OP",
          "length": 12,
          "seats": [...]
        },
        {
          "rowId": "1",
          "grade": "VIP",
          "length": 24,
          "seats": [...]
        }
      ]
    }
  ]
}
```

---

## 🔗 테이블 간 관계

```
┌───────────────────┐         ┌───────────────────┐
│   performances    │         │      venues       │
├───────────────────┤         ├───────────────────┤
│ performanceId(PK) │         │   venueId (PK)    │
│     title         │         │     name          │
│   venueId ────────┼────────▶│   address         │
│  seatGrades(SSOT) │         │   sections        │
│     cast          │         │   totalSeats      │
│  hasOPSeats       │         └───────────────────┘
└────────┬──────────┘
         │
         │ 1:N (performanceId로 연결)
         ▼
┌───────────────────┐
│    schedules      │
├───────────────────┤
│ scheduleId (PK)   │
│ performanceId(FK) │
│    date, time     │
│  availableSeats   │
│    casting        │
└────────┬──────────┘
         │
         │ (date+time → reservations.PK의 일부)
         ▼
┌───────────────────────────────────────────┐
│              reservations                 │
├───────────────────────────────────────────┤
│ PK: PERF#{performanceId}#{date}#{time}    │
│ SK: SEAT#{seatId}                         │
├───────────────────────────────────────────┤
│ status, userId, holdingId, reservationId  │
│ performanceTitle, venue, posterUrl ◀──────┼── 비정규화 (CONFIRMED 시)
│ holdExpiresAt(TTL), ttl(TTL)              │
└───────────────────────────────────────────┘
```

---

## 🔑 키 생성 함수

### PK (Partition Key) 생성

```typescript
/**
 * reservations 테이블의 Partition Key 생성
 * 동일 회차의 모든 좌석을 한 번에 Query하기 위한 설계
 */
function createPK(performanceId: string, date: string, time: string): string {
    return `PERF#${performanceId}#${date}#${time}`;
}

// 예시
createPK("perf-kinky-1", "2026-02-10", "19:30")
// 결과: "PERF#perf-kinky-1#2026-02-10#19:30"
```

### SK (Sort Key) 생성

```typescript
/**
 * reservations 테이블의 Sort Key 생성
 */
function createSK(seatId: string): string {
    return `SEAT#${seatId}`;
}

// 예시
createSK("1층-B-7-14")
// 결과: "SEAT#1층-B-7-14"
```

### seatId 형식

```
{floor}-{section}-{row}-{seatNumber}

예시:
- 1층-B-7-14  → 1층 B구역 7열 14번
- 1층-B-OP-5 → 1층 B구역 OP열 5번 (오케스트라 피트석)
- 2층-A-3-8  → 2층 A구역 3열 8번
```

---

## ⏰ TTL (Time To Live) 상세

DynamoDB TTL 기능을 활용한 자동 레코드 삭제.

### TTL 필드 및 설정

| 상태 | TTL 필드 | 값 형식 | 만료 시간 | 용도 |
|-----|---------|--------|----------|------|
| HOLDING | `holdExpiresAt` | Unix timestamp (초) | **60초** | 좌석 선점 자동 해제 |
### 1. TTL 동작 구조 (App vs DB)

DynamoDB의 TTL(Time To Live) 기능은 **데이터 삭제 시점을 보장하지 않습니다** (만료 후 실제 삭제까지 수분이 걸릴 수 있음). 따라서 즉각적인 만료 처리가 필요한 기능(좌석 선점 등)은 **Application 레벨의 로직**이 주도하고, DynamoDB TTL은 **데이터 정리(Garbage Collection)** 용도로 사용합니다.

| 구분 | Application Level (즉시 만료) | DynamoDB Native TTL (지연 삭제) |
|-----|------------------------------|--------------------------------|
| **기준 필드** | `expiresAt` (ISO 8601 문자열) | `holdExpiresAt` 또는 `ttl` (Unix Timestamp) |
| **작동 방식** | 조회 시점(`getItem`)에 현재 시간과 비교하여 만료 여부 판단 | 백그라운드 프로세스가 스캔하여 만료된 항목 삭제 |
| **장점** | 밀리초 단위의 정확한 만료 처리 가능 | 별도 삭제 로직 없이 스토리지 비용 절감 |
| **적용 대상** | 좌석 선점(Holding) 유효성 검사 | 만료된 선점 데이터 삭제, 취소된 예약 이력 삭제 |

### 2. 상태별 TTL 설정 현황

| 상태 | 필드명 | 만료 시간 | 처리 방식 |
|-----|-------|----------|----------|
| **HOLDING** | `expiresAt` | 60초 | **App 처리**: `getHolding` 호출 시 만료됐으면 `false` 반환 |
| | `holdExpiresAt`| 60초 | **DB 처리**: 백그라운드에서 자동 삭제 (청소) |
| **CANCELLED** | `ttl` | 7일 | **DB 처리**: 7일 후 자동 삭제 (이력 보관 기간 종료) |
| **DR_RECOVERED** | `expiresAt` | 15분 | **App 처리**: 복구 유예 시간 체크 |

### 3. DB 자동 삭제 여부 요약

| 상태 | DB 처리 방식 |
|-----|-------------|
| **HOLDING** | ✅ **60초 후 자동 삭제** |
| **CANCELLED** | ✅ **7일 후 자동 삭제** |
| **DR_RECOVERED** | ✅ **15분 후 자동 삭제** |
| **CONFIRMED** | ❌ **삭제 안 함** (영구 보존) |
| **DR_RESERVED** | ❌ **삭제 안 함** (영구 보존) |

### 4. TTL 계산 예시

```typescript
// HOLDING (10분)
const now = new Date();
const holdExpiresAt = Math.floor(now.getTime() / 1000) + 60;

// CANCELLED (7일)
const retentionDays = parseInt(process.env.CANCELLED_RETENTION_DAYS || '7');
const ttl = Math.floor(now.getTime() / 1000) + (retentionDays * 86400);

// DR_RECOVERED (15분)
const gracePeriodMinutes = parseInt(process.env.DR_GRACE_PERIOD_MINUTES || '30');
const ttl = Math.floor(now.getTime() / 1000) + (gracePeriodMinutes * 60);
```

### TTL 동작 방식

1. DynamoDB가 백그라운드에서 TTL 만료 레코드 스캔
2. 만료된 레코드 자동 삭제 (수초 ~ 수분 내)
3. 삭제 지연 가능성 있음 → 코드에서 `expiresAt` 필드로 추가 검증 필요

```typescript
// 코드에서 만료 체크 예시 (holding-manager.ts)
const expiresAt = item.expiresAt;
if (expiresAt && expiresAt < now) {
    // 만료됨 - available로 처리
    statusMap[seatId] = 'available';
}
```

---

## ⚙️ 환경변수

```bash
# ═══════════════════════════════════════════════════════════════
# DynamoDB 테이블명
# 코드에서는 process.env.DYNAMODB_XXXX_TABLE || "기본값" 형태로 로드됩니다.
# DR 환경 등에서 테이블명을 변경해야 할 경우 아래 변수를 설정하세요.
# ═══════════════════════════════════════════════════════════════
DYNAMODB_PERFORMANCES_TABLE=KDT-Msp4-PLDR-performances
DYNAMODB_RESERVATIONS_TABLE=KDT-Msp4-PLDR-reservations
DYNAMODB_SCHEDULES_TABLE=KDT-Msp4-PLDR-schedules
DYNAMODB_VENUES_TABLE=KDT-Msp4-PLDR-venues

# ═══════════════════════════════════════════════════════════════
# AWS 설정
# ═══════════════════════════════════════════════════════════════
AWS_REGION=ap-northeast-2

# ═══════════════════════════════════════════════════════════════
# TTL 설정
# ═══════════════════════════════════════════════════════════════
# HOLDING: 60초 (코드 하드코딩, holding-manager.ts Line 77)
# CANCELLED: 아래 환경변수로 설정 (기본값 7일)
CANCELLED_RETENTION_DAYS=7

# ═══════════════════════════════════════════════════════════════
# 캐시 설정 (performance-service.ts)
# ═══════════════════════════════════════════════════════════════
CACHE_TTL_MS=604800000   # 7일 = 604,800,000ms

# ═══════════════════════════════════════════════════════════════
# Disaster Recovery (장애 복구) 설정
# ═══════════════════════════════════════════════════════════════
DR_RECOVERY_MODE=false              # 장애 복구 모드 활성화 여부
DR_RECOVERY_START_TIME=             # 복구 시작 시간 (ISO 8601)
DR_GRACE_PERIOD_MINUTES=30          # 복구 유예 기간 (기본 30분)
```

---

## 📊 데이터 타입 범례

| DynamoDB 타입 | 약어 | TypeScript 타입 | 설명 |
|--------------|-----|----------------|------|
| String | S | string | 문자열 |
| Number | N | number | 숫자 |
| Boolean | BOOL | boolean | true/false |
| List | L | any[] | 배열 `[...]` |
| Map | M | Record<string, any> | 객체 `{...}` |

---

## ⚠️ 코드와 DB 필드명 차이

| 테이블 | DB 필드명 | 코드 변수명 | 비고 |
|-------|----------|------------|------|
| schedules | `casting` | `casting` 또는 `cast` | 코드에서 fallback 처리 (`casting || cast`) |
| performances | `cast` | `cast` | 일치 |

---

## 📝 주요 쿼리 패턴

### 1. 특정 회차의 모든 좌석 상태 조회

```typescript
// PK로 Query → 해당 회차의 모든 좌석
const result = await dynamoDb.send(new QueryCommand({
    TableName: RESERVATIONS_TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
        ":pk": "PERF#perf-kinky-1#2026-02-10#19:30"
    }
}));
```

### 2. 사용자별 예약 조회

```typescript
// GSI 사용 (userId-index)
const result = await dynamoDb.send(new QueryCommand({
    TableName: RESERVATIONS_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "#s = :c1 OR #s = :c2 OR #s = :c3 OR #s = :c4",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
        ":uid": "visitor-abc123",
        ":c1": "CONFIRMED",
        ":c2": "CANCELLED",
        ":c3": "DR_RECOVERED",
        ":c4": "DR_RESERVED"
    }
}));
```

### 3. 공연별 스케줄 조회

```typescript
// GSI 사용 (performanceId-index)
const result = await dynamoDb.send(new QueryCommand({
    TableName: SCHEDULES_TABLE,
    IndexName: "performanceId-index",
    KeyConditionExpression: "performanceId = :pid",
    ExpressionAttributeValues: {
        ":pid": "perf-kinky-1"
    }
}));
```

---

## 🔧 개선 완료 사항

1. ✅ **scheduleId 형식 통일**: 코드 주석을 DB 실제 형식(`perf-kinky-1-2026-02-10-19:30`)으로 수정 완료

---

## 💾 비용 최적화 및 캐싱 전략 (Cost Optimization Strategy)

### 개념: 인메모리 캐싱이란?

**인메모리 캐싱(In-Memory Caching)**은 자주 사용되는 데이터를 디스크(DB)가 아닌 **서버의 메모리(RAM)**에 임시 저장하는 기술입니다.
- **목적**: DB 조회 횟수를 줄여 **비용을 절감**하고, **응답 속도**를 획기적으로 개선
- **특징**: 서버가 재시작되면 메모리가 비워지므로 캐시 데이터도 사라짐 (휘발성) -> 데이터의 영구 저장이 아닌 **조회 최적화** 용도

### 설계 원칙

**원칙 1: 인메모리 캐싱으로 DB 비용 절감**

| 대안 | 장점 | 단점 | 선택 |
|-----|-----|-----|------|
| **인메모리 캐시** | 구현 단순, 비용 0원, 빠름 | 서버 재시작 시 초기화 | ✅ 채택 |
| ElastiCache (Redis) | 분산 캐시 | 추가 비용, 관리 복잡 | ❌ |
| DynamoDB DAX | 완전관리형 | 비용 높음 (~$50/월) | ❌ |

**원칙 2: 캐시 대상 명확히 분리**

```
정적 데이터 (캐싱 O):
├── 공연 정보 → 변경 시 사전 공지, 서버 재시작으로 갱신
├── 좌석 등급/가격 → 공연 시작 전 확정, 변경 거의 없음
└── 일정 정보 → 확정 후 변경 드묾

실시간 데이터 (캐싱 X):
├── 예약 상태 → 다른 사용자와 동시 예약 시 정합성 필수
├── 좌석 선점 → 60초 타이머, 실시간 상태 반영 필수
└── 잔여 좌석 → 초 단위로 변경 가능

### 3. 적용 대상 상세 (TTL: 7일)

| 분류 | 함수/데이터 | 캐싱 여부 | 비고 |
|-----|------------|----------|------|
| **공연** | `getPerformance(id)` | ✅ 적용 | 상세 정보, 캐스팅, 날짜 |
| **공연 목록** | `getAllPerformances()` | ✅ 적용 | 메인 페이지 목록 |
| **공연장** | `getVenue(id)` | ✅ 적용 | 좌석 배치도, 주소, 총 좌석 수 |
| **스케줄** | `getPerformanceSchedules(id)`| ✅ 적용 | 날짜별 회차 정보 (**V8.2**: 정렬된 상태로 캐싱하여 순서 보장) |
| **스케줄 상세**| `getSchedule(id)` | ✅ 적용 | 특정 회차 기본 정보 |
| **좌석 등급** | `getSeatGrades` | ✅ 적용 | `getPerformance` 캐시 데이터를 재사용하여 비용 절감 |
```

### 캐싱 적용 함수

| 함수 | 캐시 키 패턴 | 캐시 TTL | 비고 |
|-----|------------|---------|------|
| `getPerformance()` | `perf:{performanceId}` | 7일 | seatGrades, gradeMapping, hasOPSeats 포함 |
| `getAllPerformances()` | `perfs:all` | 7일 | 전체 공연 목록 |
| `getPerformanceSchedules()` | `schedules:{performanceId}` | 7일 | 일정 목록 |
| `getSchedule()` | `schedule:{scheduleId}` | 7일 | 개별 일정 |
| `getVenue()` | `venue:{venueId}` | 7일 | 공연장 정보 + sections (SSOT) |

### 캐싱 미적용 대상 (실시간 필수)

| 함수 | 이유 |
|-----|------|
| `getReservations()` | 예약 상태 실시간 반영 |
| `getUserReservations()` | 사용자별 예약 실시간 조회 |
| `getHoldings()` | 10분 선점 타이머 |
| `getAvailableSeats()` | 잔여 좌석 실시간 계산 |
| 모든 쓰기 작업 | DB 직접 반영 필수 |

### 캐시 TTL 설정

```typescript
// performance-service.ts
private defaultTTL = parseInt(process.env.CACHE_TTL_MS || '604800000'); // 7일 (밀리초)
```

> 📝 **설계 의도**: 실제 캐시 수명은 배포/재시작 주기(1~3일)에 맞춰 초기화됨 → 별도 캐시 무효화 API 불필요

### 예상 효과

| 항목 | Before | After |
|-----|--------|-------|
| 대화당 DB 조회 | 5~10회 | 첫 대화만 3~4회, 이후 0회 |
| DynamoDB 읽기 비용 | 100% | ~10~20% |
| 응답 속도 | DB 지연 포함 | 캐시 HIT 시 즉시 |

---

## 🔄 DR 관련 상태 상세 (DR_RESERVED / DR_RECOVERED)

### 예약 상태 전체 목록

| 상태 | 설명 | UI 표시 | 좌석 배치도 | TTL |
|-----|------|---------|----------|-----|
| `HOLDING` | 좌석 선점 중 | "선점 중 - 10분 내 결제 필요" | 황색 (선점) | 10분 |
| `CONFIRMED` | **Main(서울)** 리전 예약 확정 | "✅ 예약 확정" | 회색 X (예약됨) | 없음 |
| `DR_RESERVED` | **DR(도쿄)** 리전에서 처리된 모든 예약 | "✅ 예약 확정 (DR)" | 회색 X (예약됨) | 없음 |
| `DR_RECOVERED` | Main에서 HOLDING 중 장애 → DR에서 복구 대기 | "⚠️ 복구됨 - 결제 진행 필요" | 황색 (선점) | 15분 |
| `CANCELLED` | 취소됨 (Soft Delete) | 조회 결과에서 제외 | - | 7일 |

### DR_RESERVED vs DR_RECOVERED 차이

| 상태 | 시나리오 | 결제 완료 | 좌석 배치도 | 사용자 액션 |
|-----|---------|----------|----------|------------|
| `CONFIRMED` | **Main(서울)** 리전에서 예약 완료 | ✅ 완료 | 회색 X | 없음 |
| `DR_RESERVED` | **DR(도쿄)** 리전에서 처리된 모든 예약 | ✅ 완료 | 회색 X | 없음 |
| `DR_RECOVERED` | Main에서 **HOLDING 중 장애** → DR에서 복구 대기 | ❌ 대기 | 황색 (선점) | [예약 계속하기] 또는 [취소하기] |

### DR_RECOVERED가 필요한 이유

```
정상 흐름 (Main 리전 - 서울):
  HOLDING (10분) → 결제 → CONFIRMED  ← Main 리전 전용

DR 리전 신규 예약 (도쿄):
  HOLDING (10분) → 결제 → DR_RESERVED  ← DR 리전 예약

장애 복구 (Main에서 HOLDING 중 장애) - V7.22:
  [Main] HOLDING 중 → 장애 발생! → [DR 리전으로 Failover]
                          ↓
              10분 선점 타이머 만료됨 (정상이면 삭제)
              하지만 장애 상황이므로 사용자 보호 필요
                          ↓
  [DR] 사용자가 "내 예약" 페이지 접속
                          ↓
              HOLDING → DR_RECOVERED (15분 유예) 로 표시
              "15분 안에 결제를 완료해주세요"
                          ↓
  [DR] 사용자가 "예약 계속하기" 클릭 → 결제
                          ↓
              DR_RECOVERED → DR_RESERVED  ← V7.22: CONFIRMED → DR_RESERVED
```

### 환경변수 설정 (DR 모드)

| 환경변수 | 설명 | 예시값 |
|---------|------|-------|
| `DR_RECOVERY_MODE` | DR 복구 모드 활성화 | `true` |
| `DR_RECOVERY_START_TIME` | 장애 발생 시점 (ISO 8601) | `2025-12-29T13:00:00Z` |
| `DR_GRACE_PERIOD_MINUTES` | 복구 유예 기간 (분) | `30` |

> 📝 **구분 로직 (V7.22)**:
> - Main(서울)에서 결제 완료 → `CONFIRMED`
> - DR(도쿄)에서 처리된 모든 예약 → `DR_RESERVED` (신규 예약 + 복구된 예약 모두)
> - `sourceRegion`으로 Main/DR 리전 구분

---

## 💰 GSI (Global Secondary Index) 인프라 설정

### GSI 필요 여부 분석

| 테이블 | 현재 쿼리 방식 | GSI 필요? |
|--------|---------------|-----------| 
| `reservations` | Query + GSI | ✅ **3개 GSI 추가 완료** |
| `performances` | PK Query (performanceId) | ❌ 불필요 |
| `schedules` | GSI 이미 존재 (`performanceId-index`) | ❌ 불필요 |
| `venues` | PK Query (venueId) | ❌ 불필요 |

---

### ✅ reservations 테이블 GSI 현황 (2025-12-28)

```
┌─────────────────────────────────────────────────────────────┐
│                 reservations 테이블 키 구조                   │
├─────────────────────────────────────────────────────────────┤
│  PK (Partition Key): PERF#{performanceId}#{date}#{time}     │
│  SK (Sort Key):      SEAT#{seatId}                          │
├─────────────────────────────────────────────────────────────┤
│  holdingId:       일반 필드 (UUID) ← PK 아님!               │
│  reservationId:   일반 필드 (UUID) ← PK 아님!               │
│  userId:          일반 필드        ← GSI로 조회             │
└─────────────────────────────────────────────────────────────┘
```

**핵심**: `holdingId`, `reservationId`, `userId` 모두 **PK/SK가 아닌 일반 필드**이므로 GSI 없이는 **Scan만 가능**

---

### 📌 GSI 1: `userId-index`

```
테이블: KDT-Msp4-PLDR-reservations
├── 인덱스 이름: userId-index
├── 파티션 키: userId (String)
├── 정렬 키: (없음)
├── 속성 프로젝션: All
└── 상태: Active ✅
```

#### 왜 필요한가?

```
┌─────────────────────────────────────────────────────────────┐
│               userId-index 사용 케이스                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 챗봇: "내 예약 보여줘"        → userId로 조회            │
│  🖥️ 마이페이지 접속할 때마다      → userId로 조회            │
│  📧 알림 발송 시 (공연 전날)      → 전체 예약 조회           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**대상 함수**: `getUserReservations()`

---

### 📌 GSI 2: `holdingId-index`

```
테이블: KDT-Msp4-PLDR-reservations
├── 인덱스 이름: holdingId-index
├── 파티션 키: holdingId (String)
├── 정렬 키: (없음)
├── 속성 프로젝션: All
└── 상태: Active ✅
```

#### 왜 필요한가?

```
┌─────────────────────────────────────────────────────────────┐
│               holdingId-index 사용 케이스                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔄 선점 확인 (10분 타이머)       → holdingId로 조회         │
│  ✅ 예약 확정 처리                → holdingId로 조회         │
│  ❌ 선점 취소 처리                → holdingId로 조회         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**대상 함수**: `getHolding()`, `releaseHolding()`, `confirmReservation()`

---

### 📌 GSI 3: `reservationId-index`

```
테이블: KDT-Msp4-PLDR-reservations
├── 인덱스 이름: reservationId-index
├── 파티션 키: reservationId (String)
├── 정렬 키: (없음)
├── 속성 프로젝션: All
└── 상태: Active ✅
```

#### 왜 필요한가?

```
┌─────────────────────────────────────────────────────────────┐
│               reservationId-index 사용 케이스                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ 예약 취소 처리                → reservationId로 조회     │
│  🗑️ 취소 이력 삭제               → reservationId로 조회     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**대상 함수**: `cancelReservation()`, `deleteReservation()`

---

### ✅ AWS Best Practice 부합 여부

AWS DynamoDB 공식 Best Practice에서 권장하는 패턴:

> **"다른 access pattern이 필요하면 GSI를 사용하라"**

**MegaTicket 케이스**:
- 기본 조회: `PK`로 회차별 좌석 조회 (PK 사용)
- 추가 패턴 1: `userId`로 사용자 예약 목록 조회 ← GSI 적합
- 추가 패턴 2: `holdingId`로 선점 정보 조회 ← GSI 적합
- 추가 패턴 3: `reservationId`로 예약 정보 조회 ← GSI 적합

---

### 📊 Scan vs Query with GSI 비교

| 항목 | Scan (이전) | Query + GSI (현재) |
|------|------------|-------------------|
| **RCU 소비** | 전체 테이블 스캔 (~1,250 RCU) | 조회 결과만 (~1 RCU) |
| **비용** | 데이터 증가 시 비례 증가 | 일정 유지 |
| **응답 속도** | O(n) - 느림 | O(1) - 빠름 |
| **확장성** | 데이터 많아지면 문제 | 문제없음 |
| **10,000 레코드 중 1건 조회** | ~1,250 RCU | **~1 RCU (99% 절감)** |

---

### 💡 WORM 패턴 (Write Once, Read Many)

**"데이터는 한 번 쓰고, 여러 번 읽는다"**

이건 거의 모든 서비스에서 공통입니다:

| 서비스 | 쓰기 | 읽기 |
|--------|------|------|
| 티켓팅 | 예약 1회 | 조회 5~10회 |
| 쇼핑몰 | 주문 1회 | 배송조회 10회+ |
| SNS | 글 작성 1회 | 조회수 1000회+ |
| 은행 | 이체 1회 | 잔액조회 10회+ |

#### 사용자 행동 패턴

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 A의 여정                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ "내 예약 확인해줘"           → 조회 1회                  │
│  2️⃣ (다음날) "예약 잘 됐나?"     → 조회 1회                  │
│  3️⃣ (공연 전날) "몇 시지?"       → 조회 1회                  │
│  4️⃣ (공연 당일) "좌석 번호?"     → 조회 1회                  │
│  ─────────────────────────────────────────                  │
│  예약 1건에 조회 4회 이상!                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 💰 비용 효율성 분석

| 항목 | 변화 | 설명 |
|------|------|------|
| **읽기 비용** | ⬇️ 대폭 절감 | Scan → Query (99% 절감) |
| **쓰기 비용** | ⬆️ 소폭 증가 | GSI 복제 시 추가 WCU 발생 |
| **저장 비용** | ⬆️ 소폭 증가 | GSI에 데이터 복제됨 |

#### 비용 계산 예시

```
쓰기 비용 증가: +20~30% (1회 × 1.3 = 1.3)
읽기 비용 절감: -99%    (10회 × 0.01 = 0.1)
                ─────────────────────
총 비용:        1.3 + 0.1 = 1.4 (이전: 1 + 10 = 11)
                → 약 87% 절감!
```

> 💡 **결론**: 읽기가 쓰기보다 많은 예약 조회 패턴에서는 **전체적으로 비용 절감**

> 📝 **Pilot Light 관점**: DR 리전에서도 동일 GSI 구성 필요 (DynamoDB Global Tables 사용 시 자동 복제)

---

### ✅ 코드 수정 완료 (V7.15)

`holding-manager.ts`에서 모든 Scan → Query 변경 완료:

| 함수 | 변경 전 | 변경 후 | GSI |
|------|--------|--------|-----|
| `getUserReservations()` | Scan | Query | `userId-index` |
| `getHolding()` | Scan | Query | `holdingId-index` |
| `releaseHolding()` | Scan | Query | `holdingId-index` |
| `confirmReservation()` | Scan | Query | `holdingId-index` |
| `cancelReservation()` | Scan | Query | `reservationId-index` |
| `deleteReservation()` | Scan | Query | `reservationId-index` |

```typescript
// V7.15 적용 예시 - confirmReservation()
const result = await dynamoDb.send(new QueryCommand({
    TableName: RESERVATIONS_TABLE,
    IndexName: 'holdingId-index',  // ← GSI 사용
    KeyConditionExpression: "holdingId = :hid",
    FilterExpression: "#s = :s1 OR #s = :s2",
    ...
}));
```

---

### 🔄 좌석 실시간 조회 전략 (V7.15)

#### Polling 비활성화로 비용 절감

**파일**: `apps/web/components/seats/seat-map.tsx`

| 항목 | 이전 | 변경 후 (V7.15) |
|------|------|-----------------|
| 3초 자동 Polling | ✅ 활성화 | ❌ **주석 처리** |
| 새로고침 버튼 | ✅ 동작 | ✅ 동작 |
| `REFRESH_SEAT_MAP` 이벤트 | ✅ 동작 | ✅ 동작 |

#### 현재 갱신 방법

1. **수동**: 우측 상단 `새로고침` 버튼 클릭
2. **자동**: 선점/예약 완료 후 `REFRESH_SEAT_MAP` 이벤트 발생 시

#### 비용 비교

```
3초 Polling (이전):
├── 사용자 1명 × 10분 접속 = 200회 조회
├── 200 × 1 RCU = 200 RCU
└── 동시 접속 100명 = 20,000 RCU / 10분

버튼 클릭 (현재):
├── 사용자 1명 × 평균 3회 클릭 = 3회 조회
├── 3 × 1 RCU = 3 RCU
└── 동시 접속 100명 = 300 RCU / 10분

💰 절감률: 98.5%
```

#### 테스트 시 다시 활성화

```typescript
// seat-map.tsx Line 136-141
// V7.15: 3초 자동 Polling 비활성화 (DB 비용 절감)
// 테스트 시 아래 주석 해제하여 사용 가능
/*                          ← 삭제
const interval = setInterval(() => {
    fetchVenueData(true);
}, 3000);
*/                          ← 삭제
```

---

## 📦 비정규화 (Denormalization) 전략

### 비정규화란?

**정규화 (Normalization)**:
- 데이터 중복 제거, 테이블 분리
- 조회 시 JOIN 필요 → **DynamoDB에서는 JOIN 불가능**

**비정규화 (Denormalization)**:
- 의도적으로 데이터를 복사/중복 저장
- 단일 쿼리로 필요한 모든 데이터 획득 → **DynamoDB 최적화 패턴**

### 왜 비정규화가 필요한가?

```
❌ RDB 방식 (JOIN 필요):
┌─────────────┐     ┌─────────────┐
│ reservations │────▶│ performances │  → 2번 조회 필요
│ performanceId│     │    title     │
└─────────────┘     └─────────────┘

✅ DynamoDB 방식 (비정규화):
┌─────────────────────────────────┐
│         reservations            │
│ performanceId + performanceTitle │  → 1번 조회로 완료
│         (복사해서 저장)           │
└─────────────────────────────────┘
```

### 비정규화 적용 현황

| 테이블 | 비정규화 필드 | 원본 테이블 | 복사 시점 | 목적 |
|-------|-------------|------------|----------|------|
| **reservations** | `performanceTitle` | performances.title | CONFIRMED 시 | 예약 조회 시 JOIN 없이 공연명 표시 |
| **reservations** | `venue` | venues.name | CONFIRMED 시 | 예약 조회 시 공연장명 표시 |
| **reservations** | `posterUrl` | performances.posterUrl | CONFIRMED 시 | 예약 목록에서 포스터 표시 |

| **performances** | `venue` (이름) | venues.name | 공연 등록 시 | 공연 상세에서 공연장명 표시 |

### 비정규화의 Trade-off

| 장점 | 단점 |
|------|------|
| ✅ 조회 성능 향상 (1번 쿼리) | ⚠️ 스토리지 비용 증가 |
| ✅ RCU 비용 절감 | ⚠️ 원본 변경 시 동기화 필요 |
| ✅ 코드 단순화 (JOIN 불필요) | ⚠️ 데이터 일관성 관리 |

### 비용 최적화 관점

```
읽기 1회 비용: 0.25 RCU (4KB)
쓰기 1회 비용: 1.0 WCU (1KB)

예약 조회 시나리오 (10,000회/일):
- JOIN 방식: 2번 읽기 × 10,000 = 20,000 RCU
- 비정규화: 1번 읽기 × 10,000 = 10,000 RCU → 50% 절감

원본 변경 시나리오 (10회/일):
- 추가 쓰기: 10회 × 관련 레코드 → 미미한 비용

결론: 읽기 >> 쓰기 패턴에서 비정규화가 유리
```

### 데이터 일관성 관리

| 시나리오 | 처리 방식 |
|---------|----------|
| 공연명 변경 | 매우 드묾 (사전 공지 후 변경) → 수동 마이그레이션 |
| 공연장명 변경 | 거의 없음 → 문제 시 수동 처리 |
| 포스터 변경 | 드묾 → confirmedAt 이후 예약은 수동 업데이트 |

> 📝 **설계 원칙**: 변경 빈도가 낮은 데이터만 비정규화 + 읽기 빈도가 높은 조회 최적화

### 인프라 관점 요약

```
┌─────────────────────────────────────────────────────────────┐
│                 DynamoDB 최적화 3대 원칙                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ GSI: 다른 access pattern에 대응                          │
│     └── userId-index 추가 → 사용자별 조회 최적화              │
│                                                             │
│  2️⃣ 비정규화: JOIN 없이 단일 쿼리 완료                        │
│     └── performanceTitle, venue 등 reservations에 복사       │
│                                                             │
│  3️⃣ 인메모리 캐싱: 정적 데이터 DB 조회 최소화                  │
│     └── performances, schedules, venues 캐싱 (7일 TTL)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 인메모리 캐싱 상세 (7일 TTL)

#### 적용 이유

```
┌─────────────────────────────────────────────────────────────┐
│                  ❌ 캐싱 미적용 시 문제점                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  챗봇 대화 1회 시:                                           │
│  - get_performances: 1 RCU                                  │
│  - get_seat_grades: 1 RCU                                   │
│  - get_schedules: 1 RCU                                     │
│  - get_venue_info: 1 RCU                                    │
│  ────────────────────────────                               │
│  합계: 4+ RCU/대화                                          │
│                                                             │
│  💰 일 1,000회 대화 시:                                      │
│  - 4,000+ RCU 소모                                          │
│  - 월간 120,000+ RCU                                        │
│  - 불필요한 비용 발생!                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ✅ 인메모리 캐싱 적용 시                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  정적 데이터 특성:                                           │
│  - 공연 정보: 거의 변경 안 됨                                 │
│  - 공연장 정보: 거의 변경 안 됨                               │
│  - 좌석 등급/가격: 공연 기간 중 고정                          │
│                                                             │
│  캐싱 전략:                                                  │
│  - TTL 7일 설정 → 일주일간 메모리에 유지                      │
│  - 첫 요청 시 DB 조회 → 캐시 저장                            │
│  - 이후 요청은 메모리에서 즉시 응답                           │
│                                                             │
│  💰 비용 절감:                                               │
│  - RCU 99%+ 절감 (정적 데이터)                               │
│  - 응답 속도 향상 (DB 왕복 제거)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 캐싱 대상 테이블

| 테이블 | 캐싱 여부 | TTL | 이유 |
|--------|----------|-----|------|
| `performances` | ✅ 캐싱 | 7일 | 공연 정보 거의 변경 안 됨 |
| `schedules` | ✅ 캐싱 | 7일 | 스케줄 고정 (추가만 있음) |
| `venues` | ✅ 캐싱 | 7일 | 공연장 정보 변경 없음 |
| `reservations` | ❌ 실시간 | - | 좌석 상태 실시간 변경 |

#### 구현 위치

```typescript
// 📁 apps/app/lib/server/performance-service.ts

const performanceCache = new Map<string, { data: Performance; timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일

function getCachedPerformance(id: string): Performance | null {
    const cached = performanceCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;  // 캐시 히트 → DB 조회 없음
    }
    return null;  // 캐시 미스 → DB 조회 필요
}
```

---

## 🌏 Global Tables (DR 복제) 설정 현황

### 복제 리전 구성

| Main 리전 | DR 리전 | 상태 |
|----------|---------|------|
| `ap-northeast-2` (서울) | `ap-northeast-1` (도쿄) | ✅ **ACTIVE** |

### 복제 대상 테이블

| 테이블명 | 복제 상태 | GSI 복제 |
|---------|----------|----------|
| `KDT-Msp4-PLDR-performances` | ✅ 자동 복제 | - |
| `KDT-Msp4-PLDR-reservations` | ✅ 자동 복제 | `userId-index`, `holdingId-index`, `reservationId-index` 자동 포함 |
| `KDT-Msp4-PLDR-schedules` | ✅ 자동 복제 | `performanceId-index` 자동 포함 |
| `KDT-Msp4-PLDR-venues` | ✅ 자동 복제 | - |

> 📝 **Global Tables 특징**: GSI는 별도 설정 없이 자동 복제됩니다.

---

## ✅ 인프라 체크리스트 (2025-12-28 V7.15 완료)

| 항목 | 상태 | 비고 |
|-----|------|------|
| `userId-index` GSI (reservations) | ✅ 활성 + 코드 적용 완료 | getUserReservations() |
| `holdingId-index` GSI (reservations) | ✅ 활성 + 코드 적용 완료 | getHolding(), releaseHolding(), confirmReservation() |
| `reservationId-index` GSI (reservations) | ✅ 활성 + 코드 적용 완료 | cancelReservation(), deleteReservation() |
| `performanceId-index` GSI (schedules) | ✅ 이미 사용 중 | - |
| Global Tables (도쿄 DR) | ✅ ACTIVE | 모든 GSI 자동 복제 |
| 인메모리 캐싱 | ✅ 적용됨 | 7일 TTL |
| 비정규화 전략 | ✅ 적용됨 | reservations에 공연 정보 복사 |

> 🎉 **DB 관련 인프라/코드 작업 모두 완료! (V7.15)**


## 20. 결제 및 환불 정책 (Payment & Refund)

- **결제**: 
eservations 테이블의 상태(status)가 CONFIRMED로 변경되면 결제가 완료된 것으로 간주합니다.
- **환불**: 공연 시작 3일 전까지 100% 환불 가능하며, 이후에는 기간에 따라 수수료가 차등 부과됩니다.
- **포인트**: 결제 금액의 1%가 포인트로 적립됩니다. (추후 구현 예정)

---

## 📌 Performances GSI 최적화 (V7.17)

### 개요

`getAllPerformances()` 함수가 **전체 테이블 Scan**을 사용하고 있어 데이터가 증가할수록 성능 저하와 비용 증가가 발생합니다. 이를 해결하기 위해 `status-index` GSI를 추가했습니다.

### 왜 status-index GSI가 필요한가?

```
┌─────────────────────────────────────────────────────────────┐
│                   문제점: 전체 테이블 Scan                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  현재 getAllPerformances() 코드:                             │
│                                                             │
│    const result = await dynamoDb.send(new ScanCommand({     │
│        TableName: PERFORMANCES_TABLE                        │
│    }));                                                     │
│                                                             │
│  문제점:                                                     │
│  - 테이블 전체를 스캔하므로 RCU 비용이 데이터량에 비례        │
│  - 100개 공연 → 100 RCU, 1000개 공연 → 1000 RCU              │
│  - 응답 시간도 데이터량에 비례하여 증가                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   해결책: status-index GSI                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  최적화된 getAllPerformances() 코드 (향후 적용):              │
│                                                             │
│    const result = await dynamoDb.send(new QueryCommand({    │
│        TableName: PERFORMANCES_TABLE,                       │
│        IndexName: 'status-index',                           │
│        KeyConditionExpression: 'status = :s',               │
│        ExpressionAttributeValues: { ':s': 'ACTIVE' }        │
│    }));                                                     │
│                                                             │
│  장점:                                                       │
│  - 조회 조건에 맞는 항목만 읽으므로 RCU 절감                  │
│  - 응답 시간 일정 유지                                      │
│  - 비활성 공연(INACTIVE, DELETED 등)을 자연스럽게 필터링     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 왜 status="ACTIVE" 속성을 추가해야 하는가?

> ⚠️ **핵심 포인트**: DynamoDB GSI는 **해당 속성이 존재하는 항목**만 인덱싱합니다.

```
┌─────────────────────────────────────────────────────────────┐
│               GSI의 Sparse Index 특성                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DynamoDB GSI 동작 원리:                                     │
│  - GSI 파티션 키로 지정된 속성이 **없는** 항목은             │
│    해당 GSI에 포함되지 않음 (Sparse Index)                   │
│                                                             │
│  문제 시나리오:                                               │
│  ┌─────────────────────┐     ┌─────────────────────┐        │
│  │ 기존 공연 데이터      │     │ status-index GSI    │        │
│  ├─────────────────────┤     ├─────────────────────┤        │
│  │ perf-kinky-1        │     │ (비어있음)           │        │
│  │ - title: 킹키부츠    │     │                     │        │
│  │ - status: ❌ 없음    │ ──▶ │ GSI에 포함 안 됨!   │        │
│  └─────────────────────┘     └─────────────────────┘        │
│                                                             │
│  해결:                                                       │
│  ┌─────────────────────┐     ┌─────────────────────┐        │
│  │ 마이그레이션 후       │     │ status-index GSI    │        │
│  ├─────────────────────┤     ├─────────────────────┤        │
│  │ perf-kinky-1        │     │ status: ACTIVE      │        │
│  │ - title: 킹키부츠    │     │ └── perf-kinky-1   │        │
│  │ - status: ACTIVE ✅  │ ──▶ │ └── perf-phantom-1 │        │
│  └─────────────────────┘     └─────────────────────┘        │
│                                                             │
│  → 마이그레이션으로 status 필드 추가 필수!                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### status-index GSI 스펙

| 항목 | 값 |
|-----|-----|
| **인덱스 이름** | `status-index` |
| **파티션 키** | `status` (String) |
| **정렬 키** | 없음 |
| **프로젝션** | ALL (모든 속성 복제) |
| **테이블** | `KDT-Msp4-PLDR-performances` |

### status 필드 값 정의

| 값 | 설명 | 사용 시점 |
|-----|------|----------|
| `ACTIVE` | 현재 판매 중인 공연 | 공연 목록에 표시 |
| `INACTIVE` | 판매 중지된 공연 (예정) | 공연 목록에서 숨김 |
| `DELETED` | 삭제된 공연 (예정) | Soft Delete 처리 |

> 📝 **현재 상태**: V7.17에서는 `ACTIVE` 상태만 사용합니다. 향후 공연 관리 기능 확장 시 `INACTIVE`, `DELETED` 상태를 활용할 수 있습니다.

### 비용 최적화 효과

```
┌─────────────────────────────────────────────────────────────┐
│                    비용 비교 (예시)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  가정: 공연 100개, 각 1KB                                    │
│                                                             │
│  Scan 방식 (현재):                                           │
│  - 100개 × 0.5 RCU = 50 RCU/조회                            │
│  - 일 1,000회 조회 = 50,000 RCU                             │
│                                                             │
│  Query + GSI 방식 (최적화 후):                               │
│  - 활성 공연 100개 조회 = ~25 RCU/조회                      │
│  - 일 1,000회 조회 = 25,000 RCU                             │
│                                                             │
│  💰 절감률: 약 50% (데이터 증가 시 차이 더 커짐)              │
│                                                             │
│  추가 장점:                                                  │
│  - 비활성 공연 필터링 시 더 큰 절감                          │
│  - 활성 90개, 비활성 10개 → Scan은 100개, Query는 90개만     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📌 마이그레이션 가이드: status 필드 추가

### 마이그레이션 스크립트

`scripts/migrate-performances-status.mjs` 스크립트를 사용하여 기존 데이터에 `status: "ACTIVE"` 속성을 추가합니다.

### 사용법

```bash
# 1. 드라이런 (실제 변경 없이 변경 대상 확인)
node scripts/migrate-performances-status.mjs

# 2. 실제 마이그레이션 실행
node scripts/migrate-performances-status.mjs --execute

# 3. 롤백 (status 속성 제거) - 드라이런
node scripts/migrate-performances-status.mjs --rollback

# 4. 롤백 실행
node scripts/migrate-performances-status.mjs --rollback --execute
```

### 환경변수

| 변수명 | 기본값 | 설명 |
|-------|-------|-----|
| `AWS_PROFILE` | `BedrockDevUser-hyebom` | AWS 프로필명 |
| `AWS_REGION` | `ap-northeast-2` | AWS 리전 |
| `DYNAMODB_PERFORMANCES_TABLE` | `KDT-Msp4-PLDR-performances` | 테이블명 |

### 마이그레이션 체크리스트

- [ ] AWS 콘솔에서 `status-index` GSI 생성 확인
- [ ] 드라이런으로 변경 대상 확인 (`node scripts/migrate-performances-status.mjs`)
- [ ] 마이그레이션 실행 (`node scripts/migrate-performances-status.mjs --execute`)
- [ ] AWS 콘솔에서 GSI 데이터 확인
- [ ] (선택) `getAllPerformances()` 코드 Query로 변경

### 롤백 방법

문제 발생 시 `--rollback --execute` 플래그로 `status` 속성을 제거할 수 있습니다.

```bash
node scripts/migrate-performances-status.mjs --rollback --execute
```

### sectionConfig 필드 구조 (V8.21 추가)

>  **목적**: AI 좌석 추천 알고리즘을 위한 **Score Configuration Metadata**.
> 코드에 하드코딩된 로직을 DB로 이관하여, 공연장별/구역별 명당 기준을 동적으로 관리함.

```json
{
  "sectionConfig": {
    "1층": {
      "A": { "min": 1, "max": 12, "centerType": "high" },
      "B": {
        "min": 13, "max": 26,
        "centerType": "middle",
        "idealCenter": 19.5,
        "idealRange": { "start": 18, "end": 21 },
        "specialRows": {
          "OP": {
            "min": 1, "max": 12,
            "centerType": "middle",
            "idealCenter": 6.5,
            "idealRange": { "start": 5, "end": 8 }
          }
        }
      },
      "C": { "min": 27, "max": 38, "centerType": "low" }
    },
    "2층": { ... }
  }
}
```

| 필드 | 설명 |
|-----|-----|
| `centerType` | 명당 위치 기준 (`high`: 번호 클수록, `low`: 작을수록, `middle`: 중간일수록) |
| `idealCenter` | `middle` 타입일 때 정확한 이상적 중앙 번호 (예: 19.5) |
| `idealRange` | `middle` 타입일 때 최고점수를 부여할 번호 범위 (예: 18~21번) |
| `specialRows` | 특정 열(예: OP석)에만 적용되는 예외 설정 |
