# DR 테스트용 Terraform 실행 가이드

> **Version**: 1.3
> **Last Updated**: 2026-01-05
> **작성자**: 설혜봄 (MSP-Project-Pilot-Light)

---

## 📋 개요

서울 리전(Primary)과 도쿄 리전(DR)에 Pilot Light 인프라를 구축하고 운영하기 위한 가이드입니다.
서울/도쿄 환경은 Terraform으로 완전히 분리되어 관리됩니다.

| 항목 | 서울 (seoul-test) | 도쿄 (tokyo-dr-test) |
|------|-------------------|----------------------|
| **역할** | **Primary (Active)** | **DR (Standby)** |
| **VPC CIDR** | 10.100.0.0/16 | 10.1.0.0/16 |
| **Public Subnet** | ALB, NAT Gateway | ALB, NAT Gateway |
| **Private Subnet** | Web, App, **Internal NLB** | Web, App, **Internal NLB** |
| **AMI** | Amazon Linux 2023 | **GoldenAMI** (from Seoul) |
| **Web-App 통신** | **Internal NLB (TCP 3001)** | **Internal NLB (TCP 3001)** |
| **User Data** | 전체 빌드 및 설치 | 환경변수 주입 + PM2 재시작 |

---

## 🔁 **운영 워크플로우 (Operational Workflow)**

### 1. 평소 운영 (Daily Operations)
필요할 때 `terraform apply` (생성/수정) 또는 `terraform destroy` (삭제)만 하시면 됩니다.
서울 폴더(`seoul-test`)와 도쿄 폴더(`tokyo-dr-test`)가 완전히 독립되어 있어서, 서로 영향 없이 자유롭게 생성하고 삭제할 수 있습니다.

### 2. 새 버전 배포 및 AMI 업데이트 (Release Process)
새로운 기능이 개발되어 배포해야 할 때의 절차입니다.

1.  **서울 리전 개발 완료**: 서울에서 기능을 개발하고 테스트를 마칩니다.
2.  **Golden AMI 생성**: 서울 Web/App 인스턴스로 새로운 Golden AMI를 생성합니다. (예: `ami-0abc...`)
3.  **AMI 복사**: 생성된 AMI를 도쿄 리전(`ap-northeast-1`)으로 복사합니다.
4.  **Terraform 수정**:
    - 도쿄 Terraform 폴더(`tokyo-dr-test`)의 `variables.tf` (또는 `terraform.tfvars`)에서 `web_ami_id`, `app_ami_id`를 새로운 AMI ID로 변경합니다.
5.  **배포**:
    - `terraform apply` 실행! 🚀
    - 도쿄 Auto Scaling Group(ASG)이 자동으로 감지하여 **새 AMI로 인스턴스를 교체**합니다.
    - User Data가 자동으로 실행되어 도쿄 환경(`ap-northeast-1`)에 맞는 설정을 입히고 서비스를 시작합니다.

---

## 🚀 실행 가이드

### Step 1: 서울 리전 배포

```bash
cd terraform/seoul-test
terraform init
terraform apply
```

서울 리전은 `Amazon Linux 2023` 기본 이미지를 사용하여 부팅 시 모든 패키지를 설치하고 빌드합니다. (약 10~15분 소요)

### Step 2: Golden AMI 생성 및 복사

1.  **이미지 생성**: 서울 Web/App 인스턴스 우클릭 → 이미지 생성.
2.  **이미지 복사**: 생성된 이미지를 **도쿄 리전(`ap-northeast-1`)**으로 복사.

### Step 3: 도쿄 DR 리전 배포

```bash
cd terraform/tokyo-dr-test

# terraform.tfvars 파일 수정 (AMI ID 입력)
# web_ami_id = "ami-0123456789abcdef0" (도쿄로 복사된 ID)
# app_ami_id = "ami-0123456789abcdef1" (도쿄로 복사된 ID)

terraform init
terraform apply
```

도쿄 리전은 Golden AMI를 사용하므로 배포 속도가 빠릅니다. (약 3~5분 소요)

---

## 🔧 주요 구성 상세

### 1. Internal NLB (서울/도쿄 공통)
보안을 위해 Web에서 App으로의 통신은 **Private Subnet에 위치한 Internal NLB**를 통해 이루어집니다.
- **Port**: TCP 3001
- **Cross-Zone Load Balancing**: Enabled

### 2. User Data 및 PM2 설정
Golden AMI 사용 시 기존 환경변수가 PM2 프로세스에 캐싱되는 문제를 방지하기 위해, User Data에서 **강제 환경변수 갱신** 옵션을 사용합니다.

```bash
# 도쿄 User Data 예시
# .env.local 생성 (AWS_REGION=ap-northeast-1)
...
# PM2 재시작 (환경변수 캐시 무시 및 갱신)
pm2 restart all --update-env
```

---

## 🔥 트러블슈팅 (Troubleshooting)

### 1. 도쿄 리전 접속 시 서울로 리다이렉트됨 (307 Loop)
- **증상**: 도쿄 ALB로 접속했는데 URL이 `/?region=ap-northeast-2`로 바뀌며 접속 불가.
- **원인**: Golden AMI의 PM2가 서울 리전 정보(`ap-northeast-2`)를 기억하고 있어서 발생.
- **해결**: User Data 스크립트에서 `pm2 restart all --update-env` 명령어를 사용하여 환경변수를 강제 업데이트해야 함. (현재 코드에 반영됨)

### 2. Terraform State 불일치
- **증상**: `couldn't find resource` 등의 에러 발생.
- **해결**: AWS 콘솔에서 리소스를 임의로 삭제하지 말고, 반드시 `terraform destroy`를 사용하세요. 만약 꼬였다면 `terraform refresh` 또는 `terraform state rm` 명령어로 상태를 정리해야 합니다.

### 3. Failover/Failback 동작
- **Failover**: 서울 리전 중단 시 약 1분 후 도쿄 리전으로 DNS 자동 전환.
- **Failback**: 서울 리전 복구 시 **서울이 Primary이므로 무조건 서울로 복귀**.
- **주의**: 서울이 죽은 상태에서 도쿄를 끄면 서비스 전면 중단됨. 서울을 보고 싶다면 도쿄를 끄는 게 아니라 서울을 살려야 함.
