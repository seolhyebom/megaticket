# DR 복구 테스트 가이드 (Golden AMI → 도쿄 리전)

서울 리전의 Web/App 인스턴스를 Golden AMI로 만들고, 도쿄 리전에서 복구하는 테스트 가이드입니다.

---

## 📋 사전 준비 체크리스트

- [ ] 서울 리전 Web/App 인스턴스 정상 동작 확인
- [ ] PM2로 서비스 실행 중 확인 (`pm2 list`)
- [ ] 환경변수 설정 완료 (`INTERNAL_API_URL`, `AWS_REGION`)

---

## Step 1: Golden AMI 생성 (서울 리전)

### 1.1 Web 인스턴스 AMI 생성

1. **EC2 콘솔** → **인스턴스** → Web 인스턴스 선택
2. **작업** → **이미지 및 템플릿** → **이미지 생성**
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 이미지 이름 | `MegaTicket-Web-GoldenAMI-YYYYMMDD` |
   | 이미지 설명 | `Web Frontend with PM2, Node.js 24.12.0` |
   | 재부팅 안 함 | ❌ 체크 해제 (권장: 재부팅하여 일관성 확보) |
4. **이미지 생성** 클릭

### 1.2 App 인스턴스 AMI 생성

1. **EC2 콘솔** → **인스턴스** → App 인스턴스 선택
2. **작업** → **이미지 및 템플릿** → **이미지 생성**
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 이미지 이름 | `MegaTicket-App-GoldenAMI-YYYYMMDD` |
   | 이미지 설명 | `App Backend with PM2, Node.js 24.12.0` |
   | 재부팅 안 함 | ❌ 체크 해제 |
4. **이미지 생성** 클릭

### 1.3 AMI 생성 완료 확인

```
EC2 → AMI → 상태가 "available"이 될 때까지 대기 (5~10분 소요)
```

---

## Step 2: AMI를 도쿄 리전으로 복사

### 2.1 Web AMI 복사

1. **EC2 → AMI** → `MegaTicket-Web-GoldenAMI-YYYYMMDD` 선택
2. **작업** → **AMI 복사**
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 대상 리전 | **아시아 태평양(도쿄) ap-northeast-1** |
   | 이름 | `MegaTicket-Web-GoldenAMI-YYYYMMDD-DR` |
4. **AMI 복사** 클릭

### 2.2 App AMI 복사

1. **EC2 → AMI** → `MegaTicket-App-GoldenAMI-YYYYMMDD` 선택
2. **작업** → **AMI 복사**
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 대상 리전 | **아시아 태평양(도쿄) ap-northeast-1** |
   | 이름 | `MegaTicket-App-GoldenAMI-YYYYMMDD-DR` |
4. **AMI 복사** 클릭

> ⏱️ AMI 복사는 5~15분 소요됩니다.

---

## Step 3: 도쿄 리전 인프라 준비

### 3.1 VPC 및 서브넷 확인

도쿄 리전에 다음이 준비되어 있어야 합니다:
- [ ] VPC (CIDR: 10.1.0.0/16 등)
- [ ] Private Subnet (최소 2개 AZ)
- [ ] Public Subnet (ALB용)
- [ ] NAT Gateway 또는 NAT Instance
- [ ] Internet Gateway

### 3.2 보안 그룹 생성

도쿄 리전에서 보안 그룹을 생성합니다:

**Web 인스턴스용:**
| 유형 | 포트 | 소스 |
|-----|-----|-----|
| HTTP | 3000 | ALB 보안그룹 |
| SSH | 22 | 관리자 IP (또는 SSM 사용) |

**App 인스턴스용:**
| 유형 | 포트 | 소스 |
|-----|-----|-----|
| HTTP | 3001 | ALB 보안그룹 / Web 보안그룹 |
| SSH | 22 | 관리자 IP (또는 SSM 사용) |

---

## Step 4: 도쿄 리전에서 인스턴스 복구

### 4.1 리전 전환

AWS 콘솔 우측 상단 → **도쿄 (ap-northeast-1)** 선택

### 4.2 Web 인스턴스 시작

1. **EC2 → AMI** → `MegaTicket-Web-GoldenAMI-YYYYMMDD-DR` 선택
2. **AMI에서 인스턴스 시작**
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 인스턴스 유형 | t2.micro (또는 원하는 타입) |
   | 키 페어 | 도쿄 리전용 키 페어 |
   | VPC | DR용 VPC |
   | 서브넷 | Private Subnet |
   | 보안 그룹 | Web용 보안그룹 |
   | IAM 역할 | SSM + DynamoDB 권한 |
4. **인스턴스 시작** 클릭

### 4.3 App 인스턴스 시작

1. **EC2 → AMI** → `MegaTicket-App-GoldenAMI-YYYYMMDD-DR` 선택
2. **AMI에서 인스턴스 시작**
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 인스턴스 유형 | t2.micro (또는 원하는 타입) |
   | 키 페어 | 도쿄 리전용 키 페어 |
   | VPC | DR용 VPC |
   | 서브넷 | Private Subnet |
   | 보안 그룹 | App용 보안그룹 |
   | IAM 역할 | SSM + Bedrock + DynamoDB 권한 |
4. **인스턴스 시작** 클릭

---

## Step 5: 인스턴스 설정 업데이트

### 5.1 App 인스턴스 접속 (SSM)

```bash
# NVM 활성화
. ~/.nvm/nvm.sh

# 리전 환경변수 업데이트 (도쿄)
export AWS_REGION=ap-northeast-1

# PM2 상태 확인
pm2 list

# 서비스가 실행 중이어야 함 (pm2 startup으로 자동 시작됨)
# 만약 안 떠있다면:
cd ~/megaticket/apps/app
pm2 start npm --name "app-backend" -- start
```

### 5.2 Web 인스턴스 접속 (SSM)

```bash
# NVM 활성화
. ~/.nvm/nvm.sh

# 리전 환경변수 업데이트
export AWS_REGION=ap-northeast-1

# INTERNAL_API_URL 업데이트 (App 인스턴스 Private IP로 변경)
export INTERNAL_API_URL=http://<DR_App_Private_IP>:3001

# 또는 도쿄 ALB가 있다면 도메인 사용
# export INTERNAL_API_URL=https://pilotlight-test.click

# PM2 재시작
pm2 restart web-frontend --update-env
```

---

## Step 6: DR ALB 생성 및 연결 (선택)

### 6.1 Application Load Balancer 생성

1. **EC2 → 로드 밸런서** → **로드 밸런서 생성**
2. **Application Load Balancer** 선택
3. 설정:
   | 항목 | 값 |
   |-----|-----|
   | 이름 | `MegaTicket-DR-ALB` |
   | 체계 | 인터넷 경계 |
   | VPC | DR용 VPC |
   | 서브넷 | Public Subnet (2개 AZ) |

### 6.2 대상 그룹 생성 및 인스턴스 등록

**Web Target Group:**
- 포트: 3000
- 인스턴스: Web 인스턴스 등록

**App Target Group:**
- 포트: 3001
- 인스턴스: App 인스턴스 등록

### 6.3 리스너 규칙 설정

| 우선순위 | 조건 | 대상 그룹 |
|---------|------|----------|
| 1 | `/api*` | App-TG |
| 기본 | 나머지 | Web-TG |

---

## Step 7: 복구 테스트 검증

### 7.1 기본 연결 테스트

```bash
# App 인스턴스에서 헬스체크
curl http://localhost:3001/api/health

# Web 인스턴스에서 App 연결 테스트
curl http://<App_Private_IP>:3001/api/health
```

### 7.2 ALB 통한 접속 테스트

```bash
# ALB DNS로 접속
curl http://<DR_ALB_DNS>/
curl http://<DR_ALB_DNS>/api/health
```

### 7.3 DynamoDB Global Table 확인

```bash
# App 인스턴스에서 데이터 조회 테스트
# (DynamoDB Global Table이 도쿄 리전에도 복제되어 있어야 함)
```

---

## 📊 복구 시간 측정 (RTO)

| 단계 | 예상 시간 |
|-----|----------|
| AMI에서 인스턴스 시작 | 2~3분 |
| 인스턴스 초기화 (PM2 자동 시작) | 1~2분 |
| 환경변수 설정 | 1분 |
| ALB 헬스체크 통과 | 30초~1분 |
| **총 RTO** | **약 5~7분** |

---

## 🧹 테스트 후 정리

테스트 완료 후 비용 절감을 위해 리소스를 정리합니다:

```bash
# 도쿄 리전에서:
1. 인스턴스 종료 (Terminate)
2. ALB 삭제 (테스트용이었다면)
3. 대상 그룹 삭제
4. (선택) 복사한 AMI 등록 취소 및 스냅샷 삭제
```

---

## ⚠️ 주의사항

1. **DynamoDB Global Table**: 도쿄 리전에 복제본이 있어야 데이터 접근 가능
2. **IAM Role**: 도쿄 리전에도 동일한 권한의 IAM Role 필요
3. **키 페어**: 도쿄 리전용 키 페어 별도 생성 필요
4. **환경변수**: `AWS_REGION`을 `ap-northeast-1`로 변경 필수
