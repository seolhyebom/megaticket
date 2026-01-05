# 🎯 Antigravity 작업 지시서: 글로벌 결제 패널 구현

> **버전**: V8.33-rev2  
> **작성일**: 2025-01-05  
> **수정일**: 2025-01-05 (리전 독립성, TTL 데이터 흐름, 다중 좌석 UI 추가)  
> **목적**: 좌석 선점 UI 요소 누락 문제 해결 - 글로벌 사이드 패널 방식

---

## 📋 작업 개요

### 문제 상황
- 좌석 선점(hold_seats) 성공 후 타이머, 결제 버튼, 결제 링크가 표시되지 않음
- 사용자가 추가 질문 시 이전 메시지의 버튼이 사라짐
- `isLast` 조건과 상태 초기화 로직으로 인한 UI 요소 누락

### 해결 방향
메시지 내 버튼 유지 로직 대신, **채팅 영역 오른쪽에 독립적인 "선점 현황" 패널**을 추가하여 문제를 근본적으로 해결

---

## 🌏 리전 독립성 요구사항 (신규)

### 핵심 원칙
**Main 리전(서울, ap-northeast-2)과 DR 리전(도쿄, ap-northeast-1) 어디서든 동일하게 작동해야 함**

### 아키텍처 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                               │
│                              ↓                                      │
│                     Route53 Failover                                │
│                      ↙          ↘                                   │
│            Main (서울)          DR (도쿄)                            │
│                 ↓                    ↓                              │
│           백엔드 API            백엔드 API                           │
│                 ↓                    ↓                              │
│         DynamoDB ←── Global Tables ──→ DynamoDB                     │
│         (선점 데이터)              (선점 데이터 복제)                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 구현 요구사항

| 항목 | 요구사항 | 비고 |
|------|----------|------|
| 데이터 저장 | DynamoDB Global Tables 사용 | 리전 간 자동 복제 |
| API 엔드포인트 | 환경변수로 리전별 분리 | `NEXT_PUBLIC_API_URL` |
| 선점 상태 | 리전 전환 후에도 유지 | holdingId로 조회 |
| 타이머 동기화 | 서버 시간 기준 계산 | 클라이언트 시간 의존 X |

### 확인 필요 사항
- [ ] `activeTimer` 데이터가 DynamoDB Global Tables에서 오는지 확인
- [ ] 리전 전환(Failover) 시 선점 상태가 유지되는지 테스트
- [ ] 양쪽 리전의 백엔드가 동일한 holdingId로 데이터 조회 가능한지 확인

---

## 🔄 TTL 데이터 흐름 (신규)

### 데이터 흐름도

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  DynamoDB   │ ───→ │   백엔드    │ ───→ │ 프론트엔드  │
│             │      │   (API)     │      │  (React)    │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │
       │                    │                    │
   TTL 필드             계산/변환            타이머 표시
   (expiresAt)      (remainingTime)         (MM:SS)
```

### DynamoDB 스키마 (선점 테이블)

```json
{
  "holdingId": "hold_abc123",           // PK
  "oderId": "userId#performanceId",     // SK (복합키)
  "performanceName": "캣츠",
  "performanceDate": "2025-01-15T19:00:00",
  "seats": [                            // 1~4개 좌석 배열
    {
      "seatId": "seat_001",
      "grade": "VIP석",
      "section": "A구역",
      "row": "3",
      "number": "5",
      "price": 150000
    }
  ],
  "totalPrice": 150000,
  "payUrl": "https://pay.megaticket.com/...",
  "createdAt": 1704412800,              // Unix timestamp
  "expiresAt": 1704413400,              // Unix timestamp (생성 + 600초)
  "ttl": 1704413400                     // DynamoDB TTL (자동 삭제용)
}
```

### 백엔드 응답 형식

```typescript
// hold_seats 도구 실행 결과
interface HoldingResponse {
  holdingId: string;
  performanceName: string;
  performanceDate: string;
  seats: SeatInfo[];           // 1~4개 좌석 배열
  totalPrice: number;          // 합산 가격
  payUrl: string;
  expiresAt: number;           // Unix timestamp (서버 시간 기준)
  remainingTime: number;       // 초 단위 (서버에서 계산: expiresAt - now)
}
```

### 프론트엔드 타이머 계산

```typescript
// ❌ 잘못된 방식 - 클라이언트 시간 의존
const remainingTime = expiresAt - Date.now() / 1000;

// ✅ 올바른 방식 - 서버에서 받은 remainingTime 사용
const [timeLeft, setTimeLeft] = useState(serverResponse.remainingTime);

useEffect(() => {
  const interval = setInterval(() => {
    setTimeLeft(prev => {
      if (prev <= 0) {
        clearInterval(interval);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

### TTL 10분 규칙
- **하드코딩 금지**: 백엔드에서 `remainingTime` 또는 `expiresAt` 제공
- **Fallback**: 값이 없을 경우 기본값 600초 (10분)
- **DynamoDB TTL**: `expiresAt` 필드로 만료된 레코드 자동 삭제

---

## 👥 다중 좌석 지원 (신규)

### 요구사항
- **최소**: 1석
- **최대**: 4석 (티켓팅 서비스 일반 제한)
- **표시**: 좌석별 개별 정보 + 총 가격 합산

### 다중 좌석 UI 레이아웃

```
┌─────────────────────────────┐
│  🎫 선점 현황 (3석)         │
│  ───────────────────────    │
│  공연: 캣츠                 │
│  일시: 2025.01.15 19:00     │
│                             │
│  📍 선택 좌석:              │
│  ┌─────────────────────┐   │
│  │ 1. VIP석 A구역 3열 5번  │   │
│  │    150,000원            │   │
│  ├─────────────────────┤   │
│  │ 2. VIP석 A구역 3열 6번  │   │
│  │    150,000원            │   │
│  ├─────────────────────┤   │
│  │ 3. VIP석 A구역 3열 7번  │   │
│  │    150,000원            │   │
│  └─────────────────────┘   │
│                             │
│  💰 총 가격: 450,000원      │
│                             │
│  ⏱️ 09:32 남음              │
│  ████████░░ (타이머 바)      │
│                             │
│  [💳 결제하기]              │
│  [❌ 선점 취소]             │
│                             │
│  💡 10분 내 결제 필수       │
│  시간 초과 시 자동 취소     │
└─────────────────────────────┘
```

### 데이터 구조

```typescript
interface SeatInfo {
  seatId: string;
  grade: string;        // VIP석, R석, S석, A석
  section: string;      // A구역, B구역
  row: string;          // 열 번호
  number: string;       // 좌석 번호
  price: number;        // 개별 가격
}

interface ActiveTimer {
  holdingId: string;
  performanceName: string;
  performanceDate?: string;
  seats: SeatInfo[];              // 1~4개 배열
  totalPrice: number;             // seats.reduce((sum, s) => sum + s.price, 0)
  remainingTime: number;          // 초 단위
  payUrl: string;
}
```

---

## 🏗️ 구현 요구사항

### 1. 선점 현황 사이드 패널 (새 컴포넌트)

**위치**: 채팅 영역(`chat-interface.tsx`) 오른쪽 빈 공간

**표시 조건**: `activeTimer`가 존재할 때만 렌더링

**레이아웃 예시 (다중 좌석)**:
```
┌─────────────────────────────┐
│  🎫 선점 현황 (3석)         │
│  ───────────────────────    │
│  공연: 캣츠                 │
│  일시: 2025.01.15 19:00     │
│                             │
│  📍 선택 좌석:              │
│  ┌─────────────────────┐   │
│  │ 1. VIP석 A구역 3열 5번  │   │
│  │    150,000원            │   │
│  ├─────────────────────┤   │
│  │ 2. VIP석 A구역 3열 6번  │   │
│  │    150,000원            │   │
│  ├─────────────────────┤   │
│  │ 3. VIP석 A구역 3열 7번  │   │
│  │    150,000원            │   │
│  └─────────────────────┘   │
│                             │
│  💰 총 가격: 450,000원      │
│                             │
│  ⏱️ 09:32 남음              │
│  ████████░░ (타이머 바)      │
│                             │
│  [💳 결제하기]              │
│  [❌ 선점 취소]             │
│                             │
│  💡 10분 내 결제 필수       │
│  시간 초과 시 자동 취소     │
└─────────────────────────────┘
```

### 2. 패널에 표시할 정보

| 항목 | 데이터 소스 | 비고 |
|------|-------------|------|
| 공연명 | `activeTimer.performanceName` | 필수 |
| 일시 | `activeTimer.performanceDate` | 선택 |
| 좌석 목록 | `activeTimer.seats[]` | 1~4개 배열, 각각 등급+구역+열+번호+가격 |
| 총 가격 | `activeTimer.totalPrice` | 모든 좌석 가격 합산 |
| 남은 시간 | `activeTimer.remainingTime` | 초 단위 (서버에서 계산) |
| 결제 URL | `activeTimer.payUrl` | 버튼 클릭 시 이동 |
| 선점 ID | `activeTimer.holdingId` | 취소 요청 시 필요 |

### 3. 타이머 동작

- **TTL**: 10분 (600초)
- **표시 형식**: `MM:SS` (예: 09:32)
- **시각적 피드백**:
  - 5분 이상: 초록색
  - 3~5분: 주황색
  - 3분 미만: 빨간색 + 깜빡임 애니메이션
- **만료 시**: 패널 자동 숨김 + 토스트 알림 "선점 시간이 만료되었습니다"

### 4. 버튼 동작

**결제하기 버튼**:
- 클릭 시 `activeTimer.payUrl`로 새 탭 열기
- `window.open(payUrl, '_blank')`

**선점 취소 버튼**:
- 확인 다이얼로그 표시: "선점을 취소하시겠습니까?"
- 확인 시 `cancel_holding` API 호출 또는 타이머 초기화
- 패널 숨김 처리

---

## 📁 수정 대상 파일

### 신규 생성

```
apps/web/components/holding-status-panel.tsx  (새 컴포넌트)
```

### 수정 필요

```
apps/web/components/chat-interface.tsx
- 레이아웃 변경: 채팅 영역 + 사이드 패널
- HoldingStatusPanel 컴포넌트 import 및 배치
- activeTimer 상태를 패널에 전달

apps/web/components/chat/ChatMessage.tsx
- 메시지 내 버튼/타이머 렌더링 로직 제거 또는 비활성화
- isLast 조건 관련 코드 정리

apps/app/app/api/chat/route.ts
- 중복 변수 선언 제거 (isHoldingTool 281줄)
```

---

## 🎨 컴포넌트 구조 예시

```tsx
// holding-status-panel.tsx

interface SeatInfo {
  seatId: string;
  grade: string;
  section: string;
  row: string;
  number: string;
  price: number;
}

interface HoldingStatusPanelProps {
  activeTimer: {
    holdingId: string;
    performanceName: string;
    performanceDate?: string;
    seats: SeatInfo[];           // 1~4개 좌석 배열
    totalPrice: number;          // 합산 가격
    remainingTime: number;       // 초 단위 (서버에서 계산된 값)
    payUrl: string;
  } | null;
  onCancel: () => void;
}

export function HoldingStatusPanel({ activeTimer, onCancel }: HoldingStatusPanelProps) {
  if (!activeTimer) return null;
  
  const minutes = Math.floor(activeTimer.remainingTime / 60);
  const seconds = activeTimer.remainingTime % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // 색상 결정 (10분 TTL 기준)
  const getTimerColor = () => {
    if (activeTimer.remainingTime > 300) return 'text-green-500';  // 5분 이상
    if (activeTimer.remainingTime > 180) return 'text-orange-500'; // 3~5분
    return 'text-red-500 animate-pulse';  // 3분 미만
  };

  // 타이머 바 퍼센트 (10분 = 600초 기준)
  const progressPercent = (activeTimer.remainingTime / 600) * 100;
  
  return (
    <div className="w-80 bg-white rounded-lg shadow-lg p-6 border border-orange-200">
      {/* 헤더 */}
      <h3 className="text-lg font-bold text-orange-500 mb-4 flex items-center gap-2">
        🎫 선점 현황 ({activeTimer.seats.length}석)
      </h3>
      
      {/* 공연 정보 */}
      <div className="space-y-1 text-sm text-gray-700 mb-4">
        <p><span className="font-medium">공연:</span> {activeTimer.performanceName}</p>
        {activeTimer.performanceDate && (
          <p><span className="font-medium">일시:</span> {activeTimer.performanceDate}</p>
        )}
      </div>
      
      {/* 좌석 목록 (1~4석) */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">📍 선택 좌석:</p>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {activeTimer.seats.map((seat, index) => (
            <div 
              key={seat.seatId} 
              className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200"
            >
              <div className="font-medium text-gray-800">
                {index + 1}. {seat.grade} {seat.section} {seat.row}열 {seat.number}번
              </div>
              <div className="text-gray-600">
                {seat.price.toLocaleString()}원
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 총 가격 */}
      <div className="bg-orange-50 rounded-lg p-3 mb-4">
        <p className="text-sm text-gray-600">💰 총 가격</p>
        <p className="text-xl font-bold text-orange-600">
          {activeTimer.totalPrice.toLocaleString()}원
        </p>
      </div>
      
      {/* 타이머 */}
      <div className="text-center mb-4">
        <p className={`text-4xl font-mono font-bold ${getTimerColor()}`}>
          ⏱️ {timeDisplay}
        </p>
        <p className="text-xs text-gray-500 mt-1">남은 시간</p>
        {/* 타이머 바 */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full transition-all duration-1000 ${
              activeTimer.remainingTime > 300 ? 'bg-green-500' :
              activeTimer.remainingTime > 180 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      
      {/* 버튼 */}
      <div className="space-y-3">
        <button
          onClick={() => window.open(activeTimer.payUrl, '_blank')}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors"
        >
          💳 결제하기
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          ❌ 선점 취소
        </button>
      </div>
      
      {/* 안내 문구 */}
      <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800">
        💡 <strong>10분 내 결제 필수</strong><br/>
        시간 초과 시 선점이 자동 취소됩니다.
      </div>
    </div>
  );
}
```

---

## ✅ 체크리스트

### Phase 1: 컴포넌트 생성
- [ ] `holding-status-panel.tsx` 신규 생성
- [ ] 타이머 색상 변경 로직 구현
- [ ] 타이머 바 (progress bar) 구현
- [ ] 결제/취소 버튼 동작 구현
- [ ] 다중 좌석 목록 렌더링 구현 (1~4석)

### Phase 2: 레이아웃 통합
- [ ] `chat-interface.tsx` 레이아웃 수정 (flex로 채팅 + 패널 배치)
- [ ] `activeTimer` 상태를 패널에 props로 전달
- [ ] 선점 없을 때 패널 영역 숨김 또는 빈 상태 표시

### Phase 3: 기존 코드 정리
- [ ] `ChatMessage.tsx`에서 메시지 내 버튼/타이머 로직 제거 또는 주석 처리
- [ ] `route.ts`의 중복 변수 선언 제거 (281줄 `isHoldingTool`)
- [ ] `response-filter.ts` 사용 여부 최종 확인 후 제거 검토

### Phase 4: 테스트 - 기본 기능
- [ ] 빌드 성공 확인 (`npm run build`)
- [ ] 선점 요청 → 패널 표시 확인
- [ ] 타이머 카운트다운 동작 확인
- [ ] 타이머 바 애니메이션 확인
- [ ] 결제 버튼 클릭 → 새 탭 열림 확인
- [ ] 취소 버튼 클릭 → 패널 숨김 확인
- [ ] 시간 초과 → 자동 숨김 + 알림 확인
- [ ] 사용자 추가 질문 시에도 패널 유지 확인

### Phase 5: 테스트 - 다중 좌석
- [ ] 1석 선점 → 정상 표시
- [ ] 2석 선점 → 목록 + 합산 가격 확인
- [ ] 3석 선점 → 목록 + 합산 가격 확인
- [ ] 4석 선점 → 목록 + 합산 가격 확인
- [ ] 4석 초과 시 에러 처리 확인

### Phase 6: 테스트 - 리전 독립성
- [ ] Main 리전(서울)에서 선점 → 패널 정상 동작
- [ ] DR 리전(도쿄)에서 선점 → 패널 정상 동작
- [ ] TTL 값이 DB에서 올바르게 전달되는지 확인
- [ ] 서버 시간 기준 타이머 계산 확인 (클라이언트 시간 의존 X)

---

## ⚠️ 주의사항

1. **기존 메시지 내 버튼 로직은 제거하되, 백엔드의 ACTION_DATA 주입 로직은 유지**
   - 향후 다른 용도로 사용할 수 있음
   - 프론트엔드에서 파싱만 하지 않으면 됨

2. **TTL 10분 하드코딩 금지**
   - 백엔드에서 내려주는 `expiresAt` 또는 `ttl` 값 사용
   - 없으면 기본값 600초로 fallback

3. **반응형은 일단 고려하지 않음**
   - 데스크톱 우선 구현
   - 모바일은 추후 별도 처리

---

## ❓ Antigravity 확인 필요 사항 (중요)

### ⚠️ 이 지시서의 범위

이 지시서는 **UI 표시 문제만 해결**합니다.

| 문제 | 이 지시서로 해결? |
|------|------------------|
| 선점 성공 후 버튼/타이머가 안 보임 | ✅ 해결 |
| 추가 질문 시 버튼이 사라짐 | ✅ 해결 |
| 챗봇이 좌석을 잘못 선점함 | ❌ **미해결** |
| AI 할루시네이션 (없는 좌석 선점) | ❌ **미해결** |
| DB에서 실시간 좌석 조회 오류 | ❌ **미해결** |

### 🔍 Antigravity에게 확인할 질문

**작업 시작 전에 아래 질문에 답변해주세요:**

> 현재 챗봇이 좌석 선점을 잘 못하는 구체적인 오류가 뭐야?
> 
> 1. **AI가 없는 좌석을 선점하려고 함 (할루시네이션)?**
>    - 예: 사용자가 "A구역 3열" 요청 → AI가 존재하지 않는 "B구역 5열" 선점 시도
> 
> 2. **DB에서 좌석 정보를 못 가져옴?**
>    - 예: DynamoDB 쿼리 실패, 좌석 테이블 조회 오류
> 
> 3. **hold_seats 도구 자체가 실패함?**
>    - 예: 도구 실행 에러, 파라미터 검증 실패
> 
> 4. **선점은 성공하는데 UI에 안 보임?**
>    - 예: 백엔드 성공 → 프론트엔드 버튼/타이머 미표시

**답변 결과에 따른 조치:**
- **4번이면**: 이 지시서대로 진행
- **1~3번이면**: 별도 작업 필요 (백엔드/AI 로직 수정)
- **복합적이면**: 이 지시서 + 추가 작업 병행

---

## 📚 참고

- 현재 `activeTimer` 상태 구조 확인 필요
- DynamoDB TTL과 프론트엔드 타이머 동기화 방식 검토
- 네트워크 지연으로 인한 타이머 오차 처리 고려

---

**작성자**: Claude (설혜봄 요청)  
**검토 필요**: Antigravity
