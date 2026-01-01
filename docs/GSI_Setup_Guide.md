# GSI(Global Secondary Index) 추가 가이드

> **작업 대상**: `KDT-Msp4-PLDR-reservations` 테이블  
> **목적**: 사용자별 예약 조회 성능 최적화 (Scan → Query)  
> **예상 소요시간**: 2~3분  
> **난이도**: ⭐ (초급)

---

## 📋 사전 준비

- AWS Console 로그인
- DynamoDB 접근 권한 (`dynamodb:UpdateTable`, `dynamodb:CreateIndex`)

---

## 🚀 AWS 콘솔에서 GSI 추가하기

### Step 1: DynamoDB 테이블 이동

1. [AWS Console](https://console.aws.amazon.com) 로그인
2. 상단 검색창에 **DynamoDB** 입력 → 클릭
3. 좌측 메뉴에서 **Tables** 클릭
4. 테이블 목록에서 **`KDT-Msp4-PLDR-reservations`** 클릭

### Step 2: Indexes 탭 이동

1. 테이블 상세 페이지에서 **Indexes** 탭 클릭
2. **Create index** 버튼 클릭

### Step 3: GSI 설정

| 설정 항목 | 입력값 |
|----------|--------|
| **Partition key** | `userId` |
| **Data type** | `String` |
| **Sort key (optional)** | 비워두기 (또는 `createdAt` 입력 시 최신순 정렬 가능) |
| **Index name** | `userId-index` |
| **Attribute projections** | `All` (모든 속성 복사) |

### Step 4: 설정 확인 및 생성

1. 하단의 **Create index** 버튼 클릭
2. 인덱스 생성이 시작됨 (Status: `Creating...`)

---

## ⏳ 생성 대기

- **소요 시간**: 테이블 크기에 따라 **수 초 ~ 수 분**
- **확인 방법**: Indexes 탭에서 Status가 `Active`로 변경되면 완료

```
Status: Creating... → Active ✅
```

> 📝 **참고**: 인덱스 생성 중에도 기존 테이블 사용에는 영향 없음

---

## ✅ 생성 완료 확인

Indexes 탭에서 아래와 같이 표시되면 성공:

| Index Name | Partition Key | Status |
|------------|---------------|--------|
| `userId-index` | `userId (S)` | **Active** |

---

## 🔧 코드 수정 (GSI 생성 후)

GSI가 생성되면 코드에서 Scan → Query로 변경해야 효과가 발생합니다.

### 수정 대상 파일
`apps/app/lib/server/holding-manager.ts`

### Before (현재 코드 - 비효율)

```typescript
// getUserReservations 함수 내
const result = await dynamoDb.send(new ScanCommand({
    TableName: RESERVATIONS_TABLE,
    FilterExpression: "userId = :uid AND (#s = :c1 OR #s = :c2)",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
        ":uid": userId,
        ":c1": "CONFIRMED",
        ":c2": "CANCELLED"
    }
}));
```

### After (GSI 사용 - 효율적)

```typescript
// QueryCommand import 필요
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

// getUserReservations 함수 내
const result = await dynamoDb.send(new QueryCommand({
    TableName: RESERVATIONS_TABLE,
    IndexName: 'userId-index',  // ← GSI 지정
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "#s = :c1 OR #s = :c2 OR #s = :c3 OR #s = :c4",  // V7.16: DR_RESERVED 추가
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
        ":uid": userId,
        ":c1": "CONFIRMED",
        ":c2": "CANCELLED",
        ":c3": "DR_RECOVERED",
        ":c4": "DR_RESERVED"  // V7.16: DR 리전 신규 예약
    }
}));
```

---

## 📊 효과

| 항목 | Before (Scan) | After (Query + GSI) |
|-----|--------------|---------------------|
| RCU 소비 | 전체 레코드 수 비례 | 조회 결과 수 비례 |
| 예: 10,000개 중 5개 조회 | ~1,250 RCU | **~1 RCU** |
| 비용 절감 | - | **~99%** |
| 응답 속도 | O(n) | **O(1)** |

---

## ❓ 트러블슈팅

### Q: 인덱스 생성이 오래 걸려요
- 테이블에 데이터가 많으면 백그라운드 복제에 시간이 걸립니다
- 평균 100만 레코드당 약 10분 소요

### Q: 인덱스가 `Creating` 상태에서 멈춰있어요
- 정상입니다. 새로고침하면서 기다리세요
- 30분 이상 지속되면 AWS Support 문의

### Q: 코드 수정 없이 GSI만 만들면?
- GSI는 생성만 하면 별도 비용 없음 (사용할 때만 RCU 소비)
- 코드에서 Query로 변경해야 실제 효과 발생

---

## 📝 체크리스트

- [ ] AWS 콘솔에서 GSI 생성 완료
- [ ] Status: Active 확인
- [ ] `holding-manager.ts` 코드 수정
- [ ] 로컬 테스트 (`npm run dev`)
- [ ] 배포
