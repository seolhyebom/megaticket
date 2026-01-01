# DR 로컬 테스트 가이드

> **목적**: 로컬 환경에서 환경변수만 변경하여 서울 ↔ 도쿄 리전 전환 테스트  
> **대상**: DR_RESERVED, DR_RECOVERED 상태 및 UI 검증

---

## 📋 사전 준비

1. DynamoDB Global Table이 서울(ap-northeast-2)과 도쿄(ap-northeast-1)에 복제되어 있어야 함
2. AWS 자격 증명이 양쪽 리전 모두 접근 가능해야 함

---

## 🔧 환경변수 설정

### 1. 서울 리전 (Main - 정상 상태)

**`apps/web/.env.local`** 또는 터미널에서:

```bash
# 서울 리전 설정 (기본값)
export AWS_REGION=ap-northeast-2
export DR_RECOVERY_MODE=false
export DR_RECOVERY_START_TIME=
export DR_GRACE_PERIOD_MINUTES=15
```

### 2. 도쿄 리전 (DR - 장애 복구 모드)

**`apps/web/.env.local`** 또는 터미널에서:

```bash
# 도쿄 리전 설정 (DR 모드)
export AWS_REGION=ap-northeast-1
export DR_RECOVERY_MODE=true
export DR_RECOVERY_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")  # 현재 시간
export DR_GRACE_PERIOD_MINUTES=15
```

> 💡 **PowerShell**에서는:
> ```powershell
> $env:AWS_REGION = "ap-northeast-1"
> $env:DR_RECOVERY_MODE = "true"
> $env:DR_RECOVERY_START_TIME = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
> $env:DR_GRACE_PERIOD_MINUTES = "15"
> ```

---

## 🧪 테스트 시나리오 (상세 단계별)

### 시나리오 1: DR_RECOVERED 테스트 (Main HOLDING 중 장애 → DR 복구)

---

**STEP 1️⃣ 서울 리전에서 좌석 선점**

```powershell
# 서울 모드로 서버 시작
$env:AWS_REGION="ap-northeast-2"; $env:DR_RECOVERY_MODE="false"; $env:DR_RECOVERY_START_TIME=""; npm run clean; npm install; npm run dev
```

1. 브라우저에서 `http://localhost:3000` 접속
2. 공연 선택 → 좌석 선택 → **좌석 선점** (HOLDING 상태 생성)
3. ⚠️ **예약 확정하지 말고** 1분 타이머가 돌아가는 상태 유지

---

**STEP 2️⃣ 서버 종료 (장애 시뮬레이션)**

```powershell
# 터미널에서 Ctrl+C 로 서버 종료
```

---

**STEP 3️⃣ 도쿄 DR 모드로 서버 재시작**

```powershell
# 도쿄 DR 모드로 서버 시작
$env:AWS_REGION="ap-northeast-1"; $env:DR_RECOVERY_MODE="true"; $env:DR_RECOVERY_START_TIME=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); $env:DR_GRACE_PERIOD_MINUTES="15"; npm run clean; npm install; npm run dev
```

---

**STEP 4️⃣ DR_RECOVERED 상태 확인**

1. 브라우저에서 `http://localhost:3000` 접속
2. 우측 상단 **내 예약** 클릭 (🔔 ping 애니메이션 확인)
3. 예약 카드에서 확인:
   - ⚠️ **복구됨 - 결제 필요** Badge
   - ⏰ "HH:MM까지 결제 가능" 만료 시간
   - [예약 계속하기] [취소하기] 버튼

---

**STEP 5️⃣ 예약 계속하기**

1. [예약 계속하기] 버튼 클릭
2. 예약 상태가 **CONFIRMED**로 변경됨 확인
3. Badge가 ✅ 예약 완료로 변경됨 확인

---

### 시나리오 2: DR_RESERVED 테스트 (DR에서 신규 예약)

---

**STEP 1️⃣ 도쿄 DR 모드로 서버 시작**

```powershell
$env:AWS_REGION="ap-northeast-1"; $env:DR_RECOVERY_MODE="true"; $env:DR_RECOVERY_START_TIME=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); $env:DR_GRACE_PERIOD_MINUTES="15"; npm run clean; npm install; npm run dev
```

---

**STEP 2️⃣ 새 좌석 예약**

1. 브라우저에서 `http://localhost:3000` 접속
2. 공연 선택 → 좌석 선택 → 좌석 선점
3. **예약 확정** 버튼 클릭

---

**STEP 3️⃣ DR_RESERVED 상태 확인**

1. **내 예약** 페이지 이동
2. 예약 카드에서 확인:
   - ✅ **예약 완료 (DR)** Badge
   - TTL 없음 (영구 보존)

---

### 시나리오 3: 15분 만료 테스트

---

**빠른 테스트용**: `DR_GRACE_PERIOD_MINUTES`를 `1`로 설정

```powershell
$env:AWS_REGION="ap-northeast-1"; $env:DR_RECOVERY_MODE="true"; $env:DR_RECOVERY_START_TIME=(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); $env:DR_GRACE_PERIOD_MINUTES="1"; npm run clean; npm install; npm run dev
```

1. 시나리오 1 진행 (DR_RECOVERED 상태까지)
2. **1분 대기**
3. 새로고침 → DR_RECOVERED 카드 사라짐 확인
4. [예약 계속하기] 클릭 시 "만료되었습니다" 메시지 확인

---

## ✅ 검증 체크리스트

| # | 항목 | 확인 |
|---|------|------|
| 1 | DR_RECOVERED 상태에서 ⚠️ Badge 표시 | [ ] |
| 2 | 만료 시간 "HH:MM까지 결제 가능" 표시 | [ ] |
| 3 | [예약 계속하기] 버튼 동작 | [ ] |
| 4 | DR_RESERVED 상태에서 ✅ 예약 완료 (DR) Badge | [ ] |
| 5 | 헤더 알림 아이콘 ping 애니메이션 | [ ] |
| 6 | 15분 만료 후 자동 삭제 확인 | [ ] |

---

## ⚠️ 주의사항

1. **DynamoDB Global Table 복제 지연**: 서울 → 도쿄 복제에 수 초 ~ 수십 초 소요될 수 있음
2. **DR_RECOVERY_START_TIME 설정**: HOLDING 생성 시점보다 **이후**로 설정해야 DR_RECOVERED로 인식됨
3. **캐시 초기화**: 리전 전환 시 브라우저 새로고침 필요

---

**Last Updated**: 2025-12-29  
**Related**: [DynamoDB_Schema.md](./DynamoDB_Schema.md), [DR_Recovery_Test_Guide.md](./DR_Recovery_Test_Guide.md)
