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

# 1. 초기화
terraform init

# 2. 기존 Route 53 레코드 가져오기 (최초 1회 필수)
# [주의] 이 명령은 현재 AWS 콘솔에 레코드가 있는데, 내 테라폼 '상태 파일'에는 없을 때만 실행합니다.
terraform import aws_route53_record.primary[0] Z0853952ATBTQYQZAMXB_pilotlight-test.click_A_seoul-primary

# 3. 변경 사항 적용
terraform apply -auto-approve
```

> [!IMPORTANT]
> **기존 DNS 레코드 관리 (Terraform Import 가이드)**
>
> 본 프로젝트는 기존에 수동으로 생성된 Route 53 레코드(`pilotlight-test.click`)를 포함하고 있습니다. 인프라를 처음부터 깨끗하게 시작하지 않고 기존 자원을 연동하는 경우, 다음의 관리 원칙을 준수해야 합니다.
>
> 1. **Resource Import의 목적**: 
>    - 실제 클라우드 리소스와 테라폼 상태 파일(`terraform.tfstate`) 간의 소유권을 동기화하기 위함입니다.
>    - **"수동으로 만든 게 AWS에 남아있어서"** 하는 일회성 작업입니다.
>
> 2. **인수인계 및 Git 관련 주의사항 (중요!)**:
>    - **Git에 올라가는 것**: `.tf` 코드만 올라갑니다. 실제 리소스의 소유권(등기부등본)인 `.tfstate` 파일은 보통 보안상 Git에 올리지 않습니다.
>    - **다른 사람이 작업할 때**: 다른 사람이 이 코드를 받아 `apply`를 하려는데 AWS에 이미 리소스가 떠 있다면, 그 사람도 자기 로컬 컴퓨터에서 **딱 한 번 `import`**를 해줘야 합니다.
>    - **깔끔한 해결책**: 만약 인수인계 전에 `terraform destroy`를 해서 AWS에서 리소스를 지워버린다면, 다음 사람은 `import` 과정 없이 바로 `apply`만으로 새 인프라를 구축할 수 있습니다.

---

## 🏗️ 전체 네트워크 구조 (Public/Private)

본 프로젝트는 보안을 위해 **Public-Private 분리 구조**를 엄격히 따릅니다.

-   **Public 영역**:
    -   **ALB (External)**: 외부 인터넷 트래픽이 처음 들어오는 관문입니다.
    -   **NAT Gateway**: Private Subnet의 인스턴스들이 인터넷(패키지 설치 등)으로 나갈 때 사용합니다. (EIP 할당됨)
-   **Private 영역**:
    -   **Web Instance (Next.js)**: Public IP가 부여되지 않으며, ALB를 통해서만 접근 가능합니다.
    -   **App Instance (Node.js)**: 웹 서버나 내부 NLB를 통해서만 접근 가능한 가장 깊은 곳에 위치합니다.
    -   **NLB (Internal)**: 서비스 내부 통신(Web → App)을 위해 사용하며, Private Subnet에 위치합니다.

---

## 👥 팀원 공유 및 테스트 시 주의사항

팀원들에게 공유하여 테스트할 때 다음 항목들을 반드시 확인하도록 안내해 주세요.

### 1. 전제 조건 (Prerequisites)
-   **IAM 권한**: `BedrockDevUser-hyebom`과 같은 충분한 권한이 있는 프로필이 필요합니다.
-   **Key Pair**: 서울(`ap-northeast-2`)과 도쿄(`ap-northeast-1`) 리전에 각각 동일한 이름의 키 페어가 생성되어 있어야 합니다. (기본값: `seungwan_seoul`, `seungwan_tokyo`)

### 2. `terraform.tfvars` 커스텀 설정
팀원 각자의 환경에 맞게 다음 변수들을 수정해야 합니다.
-   `aws_profile`: 본인의 AWS CLI 프로필 이름으로 변경
-   `acm_certificate_arn`: 본인의 리전별 인증서 ARN (수동 생성 시)
-   `web_ami_id` / `app_ami_id`: **서울에서 도쿄로 복사한 최신 Golden AMI ID**를 입력해야 합니다. (서울 AMI와 도쿄 AMI ID는 서로 다릅니다!)

### 3. Golden AMI 업데이트 프로세스
1.  서울에서 코드가 수정되면 서울에서 먼저 `apply` 하여 서버를 실행하고, 잘 작동하면 **AMI를 새로 만듭니다.**
2.  새로운 서울 AMI를 **도쿄 리전으로 복사**합니다.
3.  복사된 **도쿄용 AMI ID**를 `tokyo-dr-test/terraform.tfvars`에 업데이트한 후 도쿄에서 `apply` 합니다.

> [!IMPORTANT]
> **API Proxy 패턴** 덕분에 이제 AMI 안의 소스 코드는 수정할 필요가 없습니다! 오직 **AMI ID만 도쿄용으로 잘 복사해서 입력**해 주면 모든 테스트가 끝납니다.

> 3. **운영 시나리오**:
>    - 한 번 등기(Import)를 마친 후에는 테라폼이 주인이므로, 수동으로 콘솔에서 뭔가를 고치지 않는 한 `import`를 다시 할 일은 없습니다.

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


로그 확인: 새 인스턴스가 생성되면 다시 한번 tail -f /var/log/user-data.log

로그 명령어: pm2 logs --err --lines 100