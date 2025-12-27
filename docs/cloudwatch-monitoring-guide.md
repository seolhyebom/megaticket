# MegaTicket Chatbot - CloudWatch 모니터링 가이드

> **Version**: V7.14 | **Last Updated**: 2025-12-27

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MegaTicket Chatbot (Next.js)                     │
│                                                                         │
│  ┌───────────────────────┐     ┌───────────────────────────────────┐   │
│  │   route.ts            │     │   CloudWatch Integration          │   │
│  │   (API Handler)       │────▶│   (EMF: Embedded Metric Format)   │   │
│  └───────────────────────┘     └───────────────────────────────────┘   │
│           │                                  │                          │
│           ▼                                  ▼                          │
│  ┌───────────────────────┐     ┌───────────────────────────────────┐   │
│  │   Bedrock Runtime     │     │   console.log(JSON)               │   │
│  │   (Claude Models)     │     │   ↓                               │   │
│  └───────────────────────┘     │   CloudWatch Logs                 │   │
│                                │   ↓                               │   │
│                                │   CloudWatch Metrics (Auto)       │   │
│                                └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. EMF (Embedded Metric Format) 방식

### 2.1 EMF란?

EMF는 AWS에서 권장하는 메트릭 수집 방식으로, **로그에 메트릭 정보를 태깅**하여 CloudWatch가 자동으로 추출합니다.

### 2.2 기존 방식 vs EMF 방식

| 항목 | 기존 (`PutMetricData`) | EMF (현재) |
|------|------------------------|------------|
| **API 호출** | 매 요청마다 별도 HTTP 요청 | ❌ 없음 |
| **네트워크 오버헤드** | ✅ 있음 (추가 Latency) | ❌ 없음 |
| **비용** | Custom Metric API 호출 비용 | 로그 수집 비용만 |
| **에러 핸들링** | try-catch 필요 | 불필요 (로그는 항상 성공) |
| **구현 복잡도** | SDK 의존성 필요 | `console.log` 한 줄 |

### 2.3 EMF JSON 구조

```javascript
{
  // ═══════════════════════════════════════
  // 1️⃣ 애플리케이션 컨텍스트 (디버깅용)
  // ═══════════════════════════════════════
  "service": "MegaTicket-Chatbot",
  "event": "BedrockInvokeSuccess",

  // ═══════════════════════════════════════
  // 2️⃣ Dimension 값 (메트릭 분류 기준)
  //    - 반드시 최상위 레벨에 위치
  //    - CloudWatchMetrics.Dimensions 이름과 매칭
  // ═══════════════════════════════════════
  "Model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
  "IsFallback": false,

  // ═══════════════════════════════════════
  // 3️⃣ Metric 값 (측정할 수치)
  //    - 반드시 최상위 레벨에 위치
  //    - CloudWatchMetrics.Metrics 이름과 매칭
  // ═══════════════════════════════════════
  "Latency": 1234,
  "InputTokens": 500,
  "OutputTokens": 200,

  // ═══════════════════════════════════════
  // 4️⃣ _aws 메타데이터 (CloudWatch 파싱용)
  // ═══════════════════════════════════════
  "_aws": {
    "Timestamp": 1735313554000,  // Unix milliseconds
    "CloudWatchMetrics": [{
      "Namespace": "MegaTicket/Bedrock",
      "Dimensions": [
        ["Model"],                    // 단일 Dimension 조합
        ["Model", "IsFallback"]       // 복합 Dimension 조합
      ],
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

## 3. 구현된 메트릭

### 3.1 메트릭 목록

| 메트릭 이름 | 단위 | 설명 | Dimensions |
|------------|------|------|------------|
| `Latency` | Milliseconds | Bedrock 응답 시간 (스트림 완료까지) | Model, IsFallback |
| `InputTokens` | Count | 입력 토큰 수 | Model, IsFallback |
| `OutputTokens` | Count | 출력 토큰 수 | Model, IsFallback |
| `FallbackCount` | Count | Fallback 발생 횟수 | Reason |

### 3.2 Namespace 구조

```
CloudWatch > Metrics > Custom Namespaces > MegaTicket/Bedrock
├── Latency
│   ├── [Model]
│   └── [Model, IsFallback]
├── InputTokens
│   ├── [Model]
│   └── [Model, IsFallback]
├── OutputTokens
│   ├── [Model]
│   └── [Model, IsFallback]
└── FallbackCount
    └── [Reason]
```

---

## 4. 코드 구현

### 4.1 성공 로그 (`BedrockInvokeSuccess`)

**위치**: `apps/app/app/api/chat/route.ts` (라인 195-217)

```typescript
// [V7.14] EMF: Token Usage Capture
let usage = { inputTokens: 0, outputTokens: 0 };

for await (const event of response.stream) {
  // ... 스트림 처리 ...
  
  // metadata 이벤트에서 usage 추출
  if (event.metadata?.usage) {
    usage = {
      inputTokens: event.metadata.usage.inputTokens ?? 0,
      outputTokens: event.metadata.usage.outputTokens ?? 0
    };
  }
}

// EMF 형식 로그 출력
const latencyMs = Date.now() - startTime;
console.log(JSON.stringify({
  service: "MegaTicket-Chatbot",
  event: "BedrockInvokeSuccess",
  Model: usedModel,
  IsFallback: isFallback,
  Latency: latencyMs,
  InputTokens: usage.inputTokens,
  OutputTokens: usage.outputTokens,
  _aws: {
    Timestamp: Date.now(),
    CloudWatchMetrics: [{
      Namespace: "MegaTicket/Bedrock",
      Dimensions: [["Model"], ["Model", "IsFallback"]],
      Metrics: [
        { Name: "Latency", Unit: "Milliseconds" },
        { Name: "InputTokens", Unit: "Count" },
        { Name: "OutputTokens", Unit: "Count" }
      ]
    }]
  }
}));
```

### 4.2 Fallback 로그 (`FallbackTriggered`)

**위치**: `apps/app/app/api/chat/route.ts` (라인 274-294)

```typescript
if (isValidFallbackTrigger) {
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
  
  // Secondary 모델로 전환
  await processConverseStream(..., BEDROCK_MODELS.SECONDARY.id, ...);
}
```

---

## 5. 비용 최적화

### 5.1 비용 비교

| 비용 항목 | 기존 (PutMetricData) | EMF (현재) | 절감 |
|----------|---------------------|------------|------|
| API 호출 비용 | $0.01/1,000 metrics | **$0** | **100%** |
| 로그 수집 비용 | 없음 | $0.50/GB | 유지 |
| 로그 저장 비용 | 없음 (메트릭만) | $0.03/GB/월 | 유지 |

> **핵심**: EMF는 로그에 메트릭 정보를 포함하므로, 별도 API 호출 없이 CloudWatch가 자동으로 메트릭 추출

### 5.2 예상 월 비용 (1,000req/day 기준)

```
기존 방식:
- PutMetricData: 1,000 × 30 × $0.01/1,000 = $0.30/월
- (+ 네트워크 Latency로 인한 UX 저하)

EMF 방식:
- 로그 크기: ~500 bytes/req
- 월 로그량: 500 × 1,000 × 30 = 15MB
- 로그 수집: 15MB × $0.50/GB = $0.0075/월
- 로그 저장: 15MB × $0.03/GB = $0.00045/월
- 합계: ~$0.01/월

👉 약 97% 비용 절감 + 응답 속도 개선
```

### 5.3 추가 비용 최적화 방안

#### ✅ Log Retention 설정: **7일**
- AWS Console > CloudWatch > Log Groups > (애플리케이션 로그 그룹)
- `Actions` → `Edit retention setting` → **7 days**
- 7일 이상 된 로그는 자동 삭제되어 저장 비용 절감

#### ✅ V7.14에서 제거된 불필요 로그

| 파일 | 제거된 로그 패턴 | 설명 |
|------|-----------------|------|
| `performance-service.ts` | `[STATIC] [PERF] [Cache HIT]` | 캐시 히트 알림 |
| `performance-service.ts` | `[STATIC] [PERF] [Cache MISS]` | 캐시 미스 알림 |
| `performance-service.ts` | `[STATIC] [PERF] [Cache EXPIRED]` | 캐시 만료 알림 |
| `holding-manager.ts` | `[REALTIME] Expired holding allowed for reuse` | 만료 홀딩 재사용 알림 |
| `holding-manager.ts` | `[REALTIME] Expired holding ignored` | 만료 홀딩 무시 알림 |
| `holding-manager.ts` | `[HOLDING] createHolding called` | 홀딩 생성 호출 알림 |

> 이 로그들은 인프라 상태 확인용으로, AI 서비스 모니터링에는 불필요하여 제거됨

#### 📌 Metric Filter (선택)
필요시 로그에서 추가 메트릭 추출 가능

---

## 6. AWS 인프라 관점

### 6.1 데이터 플로우

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Next.js App    │      │  CloudWatch Logs │      │CloudWatch Metrics│
│                  │      │                  │      │                  │
│  console.log()   │─────▶│  Log Group       │─────▶│  Custom Metrics  │
│  (EMF JSON)      │      │  /aws/eb/...     │      │  MegaTicket/     │
│                  │      │                  │      │  Bedrock         │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                               │                           │
                               ▼                           ▼
                          Log Insights               CloudWatch Alarms
                          (쿼리/분석)                 (임계치 알림)
```

### 6.2 자동 메트릭 추출 원리

1. 애플리케이션이 `console.log(JSON.stringify(emfObject))`로 로그 출력
2. CloudWatch Logs Agent가 로그 수집
3. CloudWatch가 `_aws` 필드 감지
4. `CloudWatchMetrics` 스펙에 따라 자동 메트릭 생성
5. 지정된 Namespace에 Dimensions와 함께 저장

### 6.3 IAM 권한 요구사항

EMF 방식은 **추가 IAM 권한이 필요 없습니다**:

```json
// 기존에 필요했던 권한 (제거됨)
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData"  // ← EMF에서는 불필요
  ],
  "Resource": "*"
}

// EMF에서 필요한 권한 (애플리케이션 로깅용, 기본 포함)
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "arn:aws:logs:*:*:log-group:/aws/elasticbeanstalk/*"
}
```

---

## 7. 모니터링 대시보드 구성 예시

### 7.1 CloudWatch Dashboard 위젯

```yaml
Dashboard: MegaTicket-Bedrock-Monitoring
Widgets:
  - Title: "Average Latency by Model"
    Type: Line
    Metric: MegaTicket/Bedrock:Latency
    Stat: Average
    Period: 300
    
  - Title: "Token Usage (Input/Output)"
    Type: Stacked Area
    Metrics:
      - MegaTicket/Bedrock:InputTokens (Sum)
      - MegaTicket/Bedrock:OutputTokens (Sum)
    
  - Title: "Fallback Rate"
    Type: Number
    Metric: MegaTicket/Bedrock:FallbackCount
    Stat: Sum
    Period: 3600
```

### 7.2 알람 설정 예시

```yaml
Alarms:
  - Name: "High Fallback Rate"
    Metric: MegaTicket/Bedrock:FallbackCount
    Threshold: 10
    Period: 300
    EvaluationPeriods: 2
    Action: SNS Topic (DevOps Alert)
    
  - Name: "High Latency"
    Metric: MegaTicket/Bedrock:Latency
    Threshold: 10000  # 10초
    Period: 60
    Action: SNS Topic (DevOps Alert)
```

---

## 8. 로그 분석 (CloudWatch Logs Insights)

### 8.1 유용한 쿼리

```sql
-- 평균 Latency 및 토큰 사용량 (시간별)
fields @timestamp, Latency, InputTokens, OutputTokens, Model
| filter event = "BedrockInvokeSuccess"
| stats avg(Latency) as AvgLatency, 
        sum(InputTokens) as TotalInput, 
        sum(OutputTokens) as TotalOutput 
  by bin(1h)
```

```sql
-- Fallback 발생 현황
fields @timestamp, Reason, primaryModel, fallbackModel, statusCode
| filter event = "FallbackTriggered"
| stats count() as FallbackCount by Reason
| sort FallbackCount desc
```

```sql
-- 모델별 비용 추정 (Claude 기준)
fields @timestamp, Model, InputTokens, OutputTokens
| filter event = "BedrockInvokeSuccess"
| stats sum(InputTokens) * 0.000003 + sum(OutputTokens) * 0.000015 as EstimatedCost by Model
```

---

## 9. 트러블슈팅

### 9.1 메트릭이 생성되지 않는 경우

| 증상 | 원인 | 해결 |
|------|------|------|
| CloudWatch에 메트릭 없음 | `_aws` 필드 오타 | JSON 구조 검증 |
| Dimension 값 누락 | 최상위 필드 누락 | 필드명과 Dimensions 이름 일치 확인 |
| 로그는 있는데 메트릭 없음 | Timestamp 형식 오류 | Unix ms 사용 확인 |

### 9.2 로컬 테스트

로컬에서는 CloudWatch 연동 없이 터미널에서 로그만 확인 가능:

```bash
npm run dev
# 챗봇 대화 후 터미널 출력 확인
# 아래 필드 포함 여부 체크:
# - InputTokens, OutputTokens
# - _aws.CloudWatchMetrics
```

---

## 10. 참고 자료

- [AWS EMF 공식 문서](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html)
- [EMF Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Manual.html)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
