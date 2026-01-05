# DR 테스트용 Terraform 실행 가이드

> **Version**: 1.2  
> **Last Updated**: 2026-01-05  
> **작성자**: 설혜봄 (MSP-Project-Pilot-Light)

---

## 📋 개요

서울 리전과 도쿄 리전에 DR 테스트용 Terraform 인프라를 구성하여 Pilot Light DR 전략을 테스트합니다.

| 항목 | 서울 (seoul-test) | 도쿄 (tokyo-dr-test) |
|------|-------------------|----------------------|
| **VPC CIDR** | 10.100.0.0/16 | 10.1.0.0/16 |
| **Public Subnet** | /26 (64 IPs) | /26 (64 IPs) |
| **Private Subnet** | /20 (4096 IPs) | /20 (4096 IPs) |
| **AWS Profile** | default | default |
| **인스턴스 타입** | t2.medium | t2.medium |
| **AMI** | Amazon Linux 2023 | GoldenAMI (서울에서 복사) |
| **인스턴스 수** | Web 1, App 1 | Web 1, App 1 |
| **ALB** | ✅ (HTTPS) | ✅ (HTTP) |
| **NLB** | ✅ | ✅ |
| **Auto Scaling** | min=1, max=1, desired=1 | min=1, max=1, desired=1 |
| **VPC Endpoint** | DynamoDB (Gateway) | DynamoDB (Gateway) |

---

## 📁 디렉토리 구조

```
terraform/
├── seoul-test/              # 서울 리전 (GoldenAMI 생성용)
│   ├── main.tf              # VPC, Subnets, NAT Gateway, Route Tables, VPC Endpoint
│   ├── variables.tf         # 변수 정의
│   ├── security-groups.tf   # ALB, Web, App 보안 그룹
│   ├── iam.tf               # IAM 역할 (SSM, Bedrock, DynamoDB, CloudWatch)
│   ├── ec2.tf               # Launch Template + Auto Scaling (user_data 자동화)
│   ├── alb.tf               # Application Load Balancer
│   ├── nlb.tf               # Network Load Balancer
│   ├── outputs.tf           # 출력값
│   └── terraform.tfvars.example
│
└── tokyo-dr-test/           # 도쿄 리전 (GoldenAMI 사용)
    ├── main.tf              # VPC, Subnets, NAT Gateway
    ├── variables.tf         # 변수 정의 (GoldenAMI ID 필수)
    ├── security-groups.tf   # 보안 그룹
    ├── iam.tf               # IAM 역할
    ├── ec2.tf               # GoldenAMI 사용, 환경변수 변경만 수행
    ├── alb.tf               # ALB
    ├── nlb.tf               # NLB
    ├── outputs.tf           # 출력값
    └── terraform.tfvars.example
```

---

## 🚀 실행 방법

### Step 1: 서울 리전 인프라 배포

```bash
cd terraform/seoul-test

# terraform.tfvars.example을 복사
cp terraform.tfvars.example terraform.tfvars

# 기본값이 이미 설정되어 있음:
# - base_ami_id: ami-0b818a04bc9c2133c (Amazon Linux 2023)
# - key_pair_name: seungwan_seoul

terraform init
terraform plan
terraform apply
```

### Step 2: 서비스 동작 확인

```bash
# ALB DNS로 접속
curl http://<ALB_DNS_NAME>/

# API 헬스체크
curl http://<ALB_DNS_NAME>/api/health
```

### Step 3: GoldenAMI 생성

1. **EC2 콘솔** → **인스턴스** → Web 인스턴스 선택
2. **작업** → **이미지 및 템플릿** → **이미지 생성**
3. 이미지 이름: `MegaTicket-Web-GoldenAMI-YYYYMMDD`
4. App 인스턴스도 동일하게 진행: `MegaTicket-App-GoldenAMI-YYYYMMDD`

### Step 4: AMI를 도쿄로 복사

1. **EC2** → **AMI** → 생성된 AMI 선택
2. **작업** → **AMI 복사**
3. **대상 리전**: `ap-northeast-1 (도쿄)`
4. 복사 완료 후 도쿄 리전에서 AMI ID 확인

### Step 5: 도쿄 리전 DR 테스트

```bash
cd terraform/tokyo-dr-test

# terraform.tfvars.example을 복사
cp terraform.tfvars.example terraform.tfvars

# ⚠️ 아래 값만 도쿄에 복사된 AMI ID로 수정
# - web_ami_id: 도쿄에 복사된 Web AMI ID
# - app_ami_id: 도쿄에 복사된 App AMI ID
# - key_pair_name: seungwan_tokyo (기본값 설정됨)

terraform init
terraform plan
terraform apply
```

### Step 6: DR 서비스 동작 확인

```bash
# DR ALB DNS로 접속
curl http://<DR_ALB_DNS_NAME>/

# API 헬스체크
curl http://<DR_ALB_DNS_NAME>/api/health

# SSM으로 인스턴스 접속하여 확인
pm2 list
echo $AWS_REGION          # ap-northeast-1 확인
echo $DR_RECOVERY_MODE    # true 확인
```

### Step 7: 테스트 후 정리

```bash
# 도쿄 리전 먼저 정리
cd terraform/tokyo-dr-test
terraform destroy

# 서울 리전 정리
cd terraform/seoul-test
terraform destroy
```

---

## 🔧 user_data 자동화 내용 (서울 리전)

서울 리전 인스턴스는 부팅 시 다음 스크립트가 자동 실행됩니다:

1. **Git 설치** (`dnf install git -y`)
2. **NVM 설치** (v0.39.7)
3. **Node.js 설치** (v24.12.0)
4. **PM2 전역 설치** (`npm install -g pm2`)
5. **소스코드 복제** (`git clone https://github.com/seolhyebom/megaticket.git`)
6. **의존성 설치** (`npm install`)
7. **빌드** (`npm run build:web` 또는 `npm run build:app`)
8. **PM2 서비스 시작** (`pm2 start npm --name "web-frontend" -- start`)
9. **PM2 startup 설정** (재부팅 시 자동 시작)

> ⏱️ 인스턴스 부팅 후 서비스 시작까지 약 **10~15분** 소요됩니다.

---

## 🔧 user_data 자동화 내용 (도쿄 리전)

도쿄 리전은 GoldenAMI를 사용하므로 환경변수 변경만 수행합니다:

1. **AWS_REGION** → `ap-northeast-1`
2. **DR_RECOVERY_MODE** → `true`
3. **PM2 재시작** (환경변수 적용)

> ⏱️ 인스턴스 부팅 후 서비스 시작까지 약 **3~5분** 소요됩니다.

---

## ⚠️ 주의사항

> [!CAUTION]
> **NAT Gateway는 시간당 과금됩니다!**  
> 테스트 완료 후 반드시 `terraform destroy`를 실행하세요.

> [!NOTE]
> **DB는 이미 생성되어 있습니다.**  
> Terraform에 DynamoDB 리소스가 포함되지 않았습니다. Global Table로 자동 복제됩니다.

> [!TIP]
> **user_data 로그 확인:**  
> SSM으로 인스턴스 접속 후 `cat /var/log/user-data.log`로 스크립트 실행 로그를 확인할 수 있습니다.

---

## 📊 비용 정보 (예상)

| 리소스 | 시간당 비용 | 비고 |
|--------|------------|------|
| EC2 t2.medium × 2 | $0.0584 × 2 | Web + App |
| NAT Gateway | $0.045 | + 데이터 전송 비용 |
| ALB | $0.0225 | + LCU 비용 |
| NLB | $0.0225 | + LCU 비용 |
| VPC Endpoint (DynamoDB) | **무료** | Gateway 타입 |

> 💰 **테스트 1시간 예상 비용**: 약 $0.20 ~ $0.30 (리전당)

---

## 🔥 트러블슈팅

### State 불일치 (Drift) 오류

AWS 콘솔에서 리소스를 수동 삭제한 경우, Terraform state와 실제 AWS 상태가 불일치하여 에러가 발생할 수 있습니다.

```
Error: waiting for Auto Scaling Group (MegaTicket-App-ASG) drain: couldn't find resource
```

**해결 방법:**

```bash
# 1. 수동 삭제된 리소스를 state에서 제거
terraform state rm aws_autoscaling_group.app
terraform state rm aws_autoscaling_group.web

# 2. 전체 state 초기화 (모든 리소스를 수동 삭제한 경우)
rm terraform.tfstate terraform.tfstate.backup

# 3. refresh 후 다시 destroy
terraform destroy -refresh=true
```

> [!TIP]
> **수동 삭제 대신 Terraform으로 관리하세요.**  
> AWS 콘솔에서 직접 삭제하면 state 불일치가 발생합니다.

### VPC CIDR 충돌

기존 VPC와 CIDR이 겹치는 경우 에러가 발생합니다.

```bash
# 현재 설정 확인
cat terraform.tfvars | grep cidr
```

**서울 리전은 `10.100.0.0/16`을 사용합니다** (기존 10.0.0.0/16 VPC와 충돌 방지)

### IAM 권한 오류

```
Error: iam:CreateRole - AccessDenied
```

**해결:** `terraform.tfvars`의 `aws_profile`을 권한이 있는 프로필로 변경

```hcl
aws_profile = "default"  # 충분한 권한이 있는 프로필 사용
```
