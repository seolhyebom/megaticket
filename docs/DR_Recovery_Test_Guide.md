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

## Step 3: 도쿄 리전 인프라 준비 (Terraform)

> 💡 **Terraform은 개발자 PC나 CI/CD에서 실행**합니다. Golden AMI에 포함되는 것이 아닙니다.

### 3.0 Terraform 코드 예시 (단순 테스트용)

아래 코드를 `terraform/dr-tokyo/` 폴더에 저장하고 실행합니다.

<details>
<summary><b>📁 main.tf (클릭하여 펼치기)</b></summary>

```hcl
# =============================================================================
# DR Tokyo Region - Simple Test Infrastructure
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"  # 도쿄 리전
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------
variable "web_ami_id" {
  description = "Web Golden AMI ID (도쿄 리전에 복사된 AMI)"
  type        = string
}

variable "app_ami_id" {
  description = "App Golden AMI ID (도쿄 리전에 복사된 AMI)"
  type        = string
}

variable "key_pair_name" {
  description = "도쿄 리전 키 페어 이름"
  type        = string
  default     = "dr-tokyo-keypair"
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
resource "aws_vpc" "dr_vpc" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "MegaTicket-DR-VPC"
  }
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "dr_igw" {
  vpc_id = aws_vpc.dr_vpc.id

  tags = {
    Name = "MegaTicket-DR-IGW"
  }
}

# -----------------------------------------------------------------------------
# Subnets
# -----------------------------------------------------------------------------
resource "aws_subnet" "public_1a" {
  vpc_id                  = aws_vpc.dr_vpc.id
  cidr_block              = "10.1.1.0/24"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = true

  tags = {
    Name = "MegaTicket-DR-Public-1a"
  }
}

resource "aws_subnet" "public_1c" {
  vpc_id                  = aws_vpc.dr_vpc.id
  cidr_block              = "10.1.2.0/24"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = true

  tags = {
    Name = "MegaTicket-DR-Public-1c"
  }
}

resource "aws_subnet" "private_1a" {
  vpc_id            = aws_vpc.dr_vpc.id
  cidr_block        = "10.1.10.0/24"
  availability_zone = "ap-northeast-1a"

  tags = {
    Name = "MegaTicket-DR-Private-1a"
  }
}

resource "aws_subnet" "private_1c" {
  vpc_id            = aws_vpc.dr_vpc.id
  cidr_block        = "10.1.11.0/24"
  availability_zone = "ap-northeast-1c"

  tags = {
    Name = "MegaTicket-DR-Private-1c"
  }
}

# -----------------------------------------------------------------------------
# NAT Gateway (테스트용 - 비용 발생 주의!)
# -----------------------------------------------------------------------------
resource "aws_eip" "nat_eip" {
  domain = "vpc"

  tags = {
    Name = "MegaTicket-DR-NAT-EIP"
  }
}

resource "aws_nat_gateway" "dr_nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_1a.id

  tags = {
    Name = "MegaTicket-DR-NAT"
  }

  depends_on = [aws_internet_gateway.dr_igw]
}

# -----------------------------------------------------------------------------
# Route Tables
# -----------------------------------------------------------------------------
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.dr_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dr_igw.id
  }

  tags = {
    Name = "MegaTicket-DR-Public-RT"
  }
}

resource "aws_route_table" "private_rt" {
  vpc_id = aws_vpc.dr_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.dr_nat.id
  }

  tags = {
    Name = "MegaTicket-DR-Private-RT"
  }
}

resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table_association" "public_1c" {
  subnet_id      = aws_subnet.public_1c.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table_association" "private_1a" {
  subnet_id      = aws_subnet.private_1a.id
  route_table_id = aws_route_table.private_rt.id
}

resource "aws_route_table_association" "private_1c" {
  subnet_id      = aws_subnet.private_1c.id
  route_table_id = aws_route_table.private_rt.id
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb_sg" {
  name        = "MegaTicket-DR-ALB-SG"
  description = "ALB Security Group"
  vpc_id      = aws_vpc.dr_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "MegaTicket-DR-ALB-SG"
  }
}

resource "aws_security_group" "web_sg" {
  name        = "MegaTicket-DR-Web-SG"
  description = "Web Instance Security Group"
  vpc_id      = aws_vpc.dr_vpc.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "MegaTicket-DR-Web-SG"
  }
}

resource "aws_security_group" "app_sg" {
  name        = "MegaTicket-DR-App-SG"
  description = "App Instance Security Group"
  vpc_id      = aws_vpc.dr_vpc.id

  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id, aws_security_group.web_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "MegaTicket-DR-App-SG"
  }
}

# -----------------------------------------------------------------------------
# IAM Role (SSM + DynamoDB + Bedrock)
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ec2_role" {
  name = "MegaTicket-DR-EC2-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "dynamodb" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "MegaTicket-DR-EC2-Profile"
  role = aws_iam_role.ec2_role.name
}

# -----------------------------------------------------------------------------
# EC2 Instances (Golden AMI 사용)
# -----------------------------------------------------------------------------
resource "aws_instance" "web" {
  ami                    = var.web_ami_id
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.private_1a.id
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.key_pair_name

  tags = {
    Name = "MegaTicket-DR-Web"
  }
}

resource "aws_instance" "app" {
  ami                    = var.app_ami_id
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.private_1a.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.key_pair_name

  tags = {
    Name = "MegaTicket-DR-App"
  }
}

# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------
resource "aws_lb" "dr_alb" {
  name               = "MegaTicket-DR-ALB"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_1a.id, aws_subnet.public_1c.id]

  tags = {
    Name = "MegaTicket-DR-ALB"
  }
}

resource "aws_lb_target_group" "web_tg" {
  name     = "MegaTicket-DR-Web-TG"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.dr_vpc.id

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
  }
}

resource "aws_lb_target_group" "app_tg" {
  name     = "MegaTicket-DR-App-TG"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.dr_vpc.id

  health_check {
    path                = "/api/health"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
  }
}

resource "aws_lb_target_group_attachment" "web" {
  target_group_arn = aws_lb_target_group.web_tg.arn
  target_id        = aws_instance.web.id
  port             = 3000
}

resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app_tg.arn
  target_id        = aws_instance.app.id
  port             = 3001
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.dr_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_tg.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "alb_dns" {
  value = aws_lb.dr_alb.dns_name
}

output "web_instance_id" {
  value = aws_instance.web.id
}

output "app_instance_id" {
  value = aws_instance.app.id
}

output "app_private_ip" {
  value = aws_instance.app.private_ip
}
```

</details>

### 3.1 Terraform 실행 방법

```bash
# 1. 디렉토리 이동
cd terraform/dr-tokyo

# 2. 초기화
terraform init

# 3. 변수 파일 생성 (terraform.tfvars)
# Linux/Mac:
cat << EOF > terraform.tfvars
web_ami_id    = "ami-xxxxxxxxx"
app_ami_id    = "ami-yyyyyyyyy"
key_pair_name = "dr-tokyo-keypair"
EOF

# Windows PowerShell:
Set-Content -Path terraform.tfvars -Value @"
web_ami_id    = "ami-xxxxxxxxx"
app_ami_id    = "ami-yyyyyyyyy"
key_pair_name = "dr-tokyo-keypair"
"@

# 4. 계획 확인
terraform plan

# 5. 인프라 생성
terraform apply

# 6. 테스트 후 정리 (비용 절감!)
terraform destroy
```

### 3.2 수동으로 준비할 경우

Terraform 없이 AWS 콘솔에서 수동으로 준비하려면 다음이 필요합니다:

- [ ] VPC (CIDR: 10.1.0.0/16 등)
- [ ] Private Subnet (최소 2개 AZ)
- [ ] Public Subnet (ALB용)
- [ ] NAT Gateway 또는 NAT Instance
- [ ] Internet Gateway

### 3.3 보안 그룹 생성

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

> 💡 **User Data를 사용하면 인스턴스 접속 없이 환경변수 자동 설정 가능!**

### 4.1 리전 전환

AWS 콘솔 우측 상단 → **도쿄 (ap-northeast-1)** 선택

### 4.2 Web 인스턴스 시작 (User Data 사용)

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

4. **고급 세부 정보** 섹션을 펼치고, **User Data**에 아래 스크립트 입력:

```bash
#!/bin/bash
# DR 리전 환경변수 설정 (도쿄)
export HOME=/home/ssm-user
cd $HOME

# 환경변수 설정 (.bashrc에 추가) - 총 4개
echo 'export AWS_REGION=ap-northeast-1' >> /home/ssm-user/.bashrc
echo 'export NEXT_PUBLIC_AWS_REGION=ap-northeast-1' >> /home/ssm-user/.bashrc
echo 'export INTERNAL_API_URL=https://pilotlight-test.click' >> /home/ssm-user/.bashrc
echo 'export DR_RECOVERY_MODE=true' >> /home/ssm-user/.bashrc

# NVM 및 PM2 환경 로드
source /home/ssm-user/.nvm/nvm.sh

# PM2 권한 수정 (Golden AMI에서 다른 사용자로 설정된 경우 필요)
sudo chown -R ssm-user:ssm-user /home/ssm-user/.pm2 2>/dev/null || true

# .env.local 파일 수정 (도쿄 리전으로 변경)
cd /home/ssm-user/megaticket/apps/web
if [ -f .env.local ]; then
    sed -i 's/AWS_REGION=ap-northeast-2/AWS_REGION=ap-northeast-1/g' .env.local
    grep -q "NEXT_PUBLIC_AWS_REGION" .env.local || echo "NEXT_PUBLIC_AWS_REGION=ap-northeast-1" >> .env.local
fi

# PM2 환경변수 업데이트 및 재시작
export AWS_REGION=ap-northeast-1
export NEXT_PUBLIC_AWS_REGION=ap-northeast-1
export INTERNAL_API_URL=https://pilotlight-test.click
export DR_RECOVERY_MODE=true

# 기존 프로세스 정리 후 새로 시작
pm2 delete web-frontend 2>/dev/null || true
pm2 start npm --name "web-frontend" -- start
pm2 save
```

5. **인스턴스 시작** 클릭

### 4.3 App 인스턴스 시작 (User Data 사용)

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

4. **고급 세부 정보** 섹션을 펼치고, **User Data**에 아래 스크립트 입력:

```bash
#!/bin/bash
# DR 리전 환경변수 설정 (도쿄)
export HOME=/home/ssm-user
cd $HOME

# 환경변수 설정 (.bashrc에 추가) - 총 2개
echo 'export AWS_REGION=ap-northeast-1' >> /home/ssm-user/.bashrc
echo 'export DR_RECOVERY_MODE=true' >> /home/ssm-user/.bashrc

# NVM 및 PM2 환경 로드
source /home/ssm-user/.nvm/nvm.sh

# PM2 권한 수정 (Golden AMI에서 다른 사용자로 설정된 경우 필요)
sudo chown -R ssm-user:ssm-user /home/ssm-user/.pm2 2>/dev/null || true

# PM2 환경변수 업데이트 및 재시작
cd /home/ssm-user/megaticket/apps/app
export AWS_REGION=ap-northeast-1
export DR_RECOVERY_MODE=true

# 기존 프로세스 정리 후 새로 시작
pm2 delete app-backend 2>/dev/null || true
pm2 start npm --name "app-backend" -- start
pm2 save
```

5. **인스턴스 시작** 클릭

> ⚠️ **주의**: User Data는 **첫 번째 시작 시에만 실행**됩니다. 인스턴스를 Stop → Start 하면 다시 실행되지 않습니다.

---

## Step 5: 인스턴스 설정 업데이트 (선택 - User Data 미사용 시만)

> ✅ **User Data를 사용했다면 이 단계는 건너뛰세요!**
>
> Step 4에서 User Data를 입력했다면 환경변수 설정과 PM2 재시작이 **자동으로 완료**됩니다.
> 아래는 User Data 없이 수동으로 인스턴스를 시작한 경우에만 필요합니다.

### 5.1 App 인스턴스 접속 (SSM) - User Data 미사용 시만

```bash
# NVM 활성화
. ~/.nvm/nvm.sh

# 리전 환경변수 업데이트 (도쿄)
export AWS_REGION=ap-northeast-1
export DR_RECOVERY_MODE=true

# PM2 상태 확인
pm2 list

# 서비스가 실행 중이어야 함 (pm2 startup으로 자동 시작됨)
# 만약 안 떠있다면:
cd ~/megaticket/apps/app
pm2 start npm --name "app-backend" -- start
```

### 5.2 Web 인스턴스 접속 (SSM) - User Data 미사용 시만

```bash
# NVM 활성화
. ~/.nvm/nvm.sh

# 리전 환경변수 업데이트
export AWS_REGION=ap-northeast-1
export INTERNAL_API_URL=https://pilotlight-test.click
export DR_RECOVERY_MODE=true

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
t
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
4. **환경변수**: `AWS_REGION`, `NEXT_PUBLIC_AWS_REGION`을 `ap-northeast-1`로 변경 필수

---

## 🖥️ 로컬 DR 테스트 방법

로컬 개발환경에서 DR 상황을 시뮬레이션하려면 환경변수를 설정합니다.

### PowerShell (Windows)

```powershell
# 환경변수 설정 (도쿄 리전)
$env:AWS_REGION = "ap-northeast-1"
$env:NEXT_PUBLIC_AWS_REGION = "ap-northeast-1"
$env:DR_RECOVERY_MODE = "true"

# 확인
echo "AWS_REGION: $env:AWS_REGION"
echo "NEXT_PUBLIC_AWS_REGION: $env:NEXT_PUBLIC_AWS_REGION"
echo "DR_RECOVERY_MODE: $env:DR_RECOVERY_MODE"

# dev 서버 실행
npm run dev
```

### 서울 리전으로 복귀

```powershell
# 환경변수 초기화
$env:AWS_REGION = "ap-northeast-2"
$env:NEXT_PUBLIC_AWS_REGION = "ap-northeast-2"
Remove-Item Env:DR_RECOVERY_MODE -ErrorAction SilentlyContinue

# 또는 새 터미널 세션 열기
```

> 💡 **참고**: 코드의 기본값이 `ap-northeast-2`(서울)이므로, 환경변수를 설정하지 않으면 자동으로 서울 리전으로 동작합니다.

### 중요: 사전 설정 필수

로컬 DR 테스트가 정상 동작하려면 다음 조건이 충족되어야 합니다:

1. **`turbo.json`에 환경변수 전달 설정**이 되어 있어야 함:
   ```json
   "dev": {
       "cache": false,
       "persistent": true,
       "env": [
           "AWS_REGION",
           "NEXT_PUBLIC_AWS_REGION",
           "DR_RECOVERY_MODE"
       ]
   }
   ```

2. **`.env` 파일에서 `AWS_REGION` 제거**:
   - `apps/app/.env`: `AWS_REGION=ap-northeast-2` 줄 삭제
   - `apps/web/.env.local`: `AWS_REGION=...` 줄 삭제 (있을 경우)

