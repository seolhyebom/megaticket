# MegaTicket 인프라 테라폼 가이드 - DR 리전 (도쿄)

> **Version**: 1.0  
> **Last Updated**: 2025-12-29  
> **AWS 리전**: ap-northeast-1 (도쿄)  
> **작성자**: 설혜봄 (MSP-Project-Pilot-Light)

---

## 📋 목차

1. [DR 아키텍처 개요](#1-dr-아키텍처-개요)
2. [사전 준비 사항](#2-사전-준비-사항)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [Terraform 코드](#4-terraform-코드)
5. [실행 방법](#5-실행-방법)
6. [Failover 테스트](#6-failover-테스트)
7. [비용 정보](#7-비용-정보)

---

## 1. DR 아키텍처 개요

### 1.1 Pilot Light DR 전략

본 프로젝트는 **Pilot Light** DR 전략을 사용합니다:

- ✅ **DynamoDB Global Table**: Main과 DR 간 자동 데이터 복제
- ✅ **Golden AMI**: 서울에서 도쿄로 복사하여 대기
- ⏸️ **EC2/ASG**: 평상시 중지 상태, 장애 시 즉시 가동
- ✅ **Bedrock Cross-Region**: 리전 변경만으로 동일 모델 사용 가능

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DR Region: ap-northeast-1 (도쿄)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            VPC (10.1.0.0/16)                             │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │              Public Subnets (AZ-a / AZ-c)                        │   │   │
│  │  │   ┌──────────────────────────────────────────────────────────┐  │   │   │
│  │  │   │  Application Load Balancer (ALB)                         │  │   │   │
│  │  │   │  - Route 53 Failover Secondary                           │  │   │   │
│  │  │   └──────────────────────────────────────────────────────────┘  │   │   │
│  │  │   ┌─────────────────┐                                           │   │   │
│  │  │   │   NAT Gateway   │                                           │   │   │
│  │  │   └─────────────────┘                                           │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                    │   │
│  │  ┌─────────────────────────────────▼───────────────────────────────┐   │   │
│  │  │              Private Subnets (AZ-a / AZ-c)                       │   │   │
│  │  │                                                                  │   │   │
│  │  │  ┌───────────────────────┐    ┌───────────────────────────────┐ │   │   │
│  │  │  │   Auto Scaling Group  │    │   Auto Scaling Group          │ │   │   │
│  │  │  │   (Web - Port 3000)   │    │   (App - Port 3001)           │ │   │   │
│  │  │  │   ⏸️ 평시: 0개         │    │   ⏸️ 평시: 0개                 │ │   │   │
│  │  │  │   🔥 DR시: 2개        │    │   🔥 DR시: 2개                │ │   │   │
│  │  │  └───────────────────────┘    └───────────────────────────────┘ │   │   │
│  │  │                                                                  │   │   │
│  │  └──────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                       DynamoDB Global Table Replica                      │   │
│  │                                                                         │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │   │
│  │  │ performances     │  │ reservations     │  │ schedules        │      │   │
│  │  │ (복제본)          │  │ (복제본)          │  │ (복제본)          │      │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘      │   │
│  │  ┌──────────────────┐                                                   │   │
│  │  │ venues           │  ← 서울 리전에서 자동 동기화                        │   │
│  │  │ (복제본)          │                                                   │   │
│  │  └──────────────────┘                                                   │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 평시 vs DR 상태

| 상태 | EC2/ASG | ALB | DynamoDB | Route 53 |
|------|---------|-----|----------|----------|
| **평시** | ⏸️ desired=0 | ✅ 대기 | ✅ 복제 진행 | Secondary (Failover) |
| **DR 활성화** | 🔥 desired=2 | ✅ 활성 | ✅ 읽기/쓰기 | Primary (Failover 발생) |

---

## 2. 사전 준비 사항

### 2.1 서울 리전에서 준비

> ⚠️ **중요**: DR 테라폼을 실행하기 전에 아래 항목이 완료되어야 합니다.

| 항목 | 방법 | 비고 |
|------|------|------|
| **Golden AMI 복사** | AWS 콘솔 → AMI → 복사 → 도쿄 선택 | 5~15분 소요 |
| **DynamoDB Global Table 활성화** | Main 테라폼에서 `enable_dynamodb_global_table = true` | 자동 복제 |

### 2.2 도쿄 리전에서 사전 생성

| 항목 | 값 예시 | 설명 |
|------|---------|------|
| **SSH 키 페어** | `megaticket-tokyo-keypair` | EC2 접속용 (SSM 사용 시 불필요) |
| **복사된 AMI ID** | `ami-dr-web-xxxxx`, `ami-dr-app-xxxxx` | 서울에서 복사된 Golden AMI |

### 2.3 Golden AMI 복사 방법

```bash
# AWS CLI로 AMI 복사 (서울 → 도쿄)
aws ec2 copy-image \
  --region ap-northeast-1 \
  --source-region ap-northeast-2 \
  --source-image-id ami-xxxxxxxxxxxxxxxxx \
  --name "MegaTicket-Web-GoldenAMI-DR" \
  --description "DR Copy from Seoul"

aws ec2 copy-image \
  --region ap-northeast-1 \
  --source-region ap-northeast-2 \
  --source-image-id ami-yyyyyyyyyyyyyyyyy \
  --name "MegaTicket-App-GoldenAMI-DR" \
  --description "DR Copy from Seoul"
```

---

## 3. 디렉토리 구조

```
terraform/
├── main-seoul/
│   └── (Terraform_Main_Seoul.md 참조)
└── dr-tokyo/
    ├── main.tf              # 메인 설정 (Provider, VPC, Subnet)
    ├── variables.tf         # 변수 정의
    ├── terraform.tfvars     # 변수 값 (AMI ID 포함)
    ├── security-groups.tf   # 보안 그룹
    ├── iam.tf               # IAM 역할 및 정책
    ├── ec2.tf               # EC2 Launch Template / ASG
    ├── alb.tf               # Application Load Balancer
    └── outputs.tf           # 출력값
```

> 📌 **DynamoDB 주의**: DR 리전에서는 DynamoDB 테이블을 **생성하지 않습니다**. Main 리전 테라폼에서 Global Table로 자동 복제됩니다.

---

## 4. Terraform 코드

### 4.1 main.tf

```hcl
# =============================================================================
# MegaTicket Infrastructure - DR Region (Tokyo)
# =============================================================================

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
  
  default_tags {
    tags = {
      Project     = "MegaTicket"
      Environment = "${var.environment}-DR"
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
resource "aws_vpc" "dr" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-DR-VPC"
  }
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "dr" {
  vpc_id = aws_vpc.dr.id

  tags = {
    Name = "${var.project_name}-DR-IGW"
  }
}

# -----------------------------------------------------------------------------
# Subnets - Public
# -----------------------------------------------------------------------------
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.dr.id
  cidr_block              = var.public_subnet_a_cidr
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-DR-Public-Subnet-A"
    Type = "Public"
  }
}

resource "aws_subnet" "public_c" {
  vpc_id                  = aws_vpc.dr.id
  cidr_block              = var.public_subnet_c_cidr
  availability_zone       = "${var.aws_region}c"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-DR-Public-Subnet-C"
    Type = "Public"
  }
}

# -----------------------------------------------------------------------------
# Subnets - Private
# -----------------------------------------------------------------------------
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.dr.id
  cidr_block        = var.private_subnet_a_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-DR-Private-Subnet-A"
    Type = "Private"
  }
}

resource "aws_subnet" "private_c" {
  vpc_id            = aws_vpc.dr.id
  cidr_block        = var.private_subnet_c_cidr
  availability_zone = "${var.aws_region}c"

  tags = {
    Name = "${var.project_name}-DR-Private-Subnet-C"
    Type = "Private"
  }
}

# -----------------------------------------------------------------------------
# NAT Gateway (DR 활성화 시에만 트래픽 발생)
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-DR-NAT-EIP"
  }
}

resource "aws_nat_gateway" "dr" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id

  tags = {
    Name = "${var.project_name}-DR-NAT-GW"
  }

  depends_on = [aws_internet_gateway.dr]
}

# -----------------------------------------------------------------------------
# Route Tables
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.dr.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dr.id
  }

  tags = {
    Name = "${var.project_name}-DR-Public-RT"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.dr.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.dr.id
  }

  tags = {
    Name = "${var.project_name}-DR-Private-RT"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_c" {
  subnet_id      = aws_subnet.public_c.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_c" {
  subnet_id      = aws_subnet.private_c.id
  route_table_id = aws_route_table.private.id
}
```

### 4.2 variables.tf

```hcl
# =============================================================================
# Variables - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# 기본 설정
# -----------------------------------------------------------------------------
variable "project_name" {
  description = "프로젝트 이름"
  type        = string
  default     = "MegaTicket"
}

variable "environment" {
  description = "환경"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS 리전 (도쿄)"
  type        = string
  default     = "ap-northeast-1"
}

variable "aws_profile" {
  description = "AWS CLI 프로파일"
  type        = string
  default     = "BedrockDevUser-hyebom"
}

# -----------------------------------------------------------------------------
# VPC 설정 (Main과 다른 CIDR)
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "VPC CIDR 블록"
  type        = string
  default     = "10.1.0.0/16"
}

variable "public_subnet_a_cidr" {
  description = "Public Subnet A CIDR"
  type        = string
  default     = "10.1.1.0/24"
}

variable "public_subnet_c_cidr" {
  description = "Public Subnet C CIDR"
  type        = string
  default     = "10.1.2.0/24"
}

variable "private_subnet_a_cidr" {
  description = "Private Subnet A CIDR"
  type        = string
  default     = "10.1.10.0/24"
}

variable "private_subnet_c_cidr" {
  description = "Private Subnet C CIDR"
  type        = string
  default     = "10.1.11.0/24"
}

# -----------------------------------------------------------------------------
# EC2 설정
# -----------------------------------------------------------------------------
variable "key_pair_name" {
  description = "EC2 SSH 키 페어 이름 (도쿄 리전)"
  type        = string
  default     = "megaticket-tokyo-keypair"
}

variable "web_ami_id" {
  description = "Web Golden AMI ID (도쿄 리전에 복사된 AMI)"
  type        = string
}

variable "app_ami_id" {
  description = "App Golden AMI ID (도쿄 리전에 복사된 AMI)"
  type        = string
}

variable "instance_type" {
  description = "EC2 인스턴스 타입"
  type        = string
  default     = "t2.small"
}

# -----------------------------------------------------------------------------
# Auto Scaling 설정 (Pilot Light - 평시 0, DR 시 확장)
# -----------------------------------------------------------------------------
variable "web_asg_min" {
  description = "Web ASG 최소 인스턴스"
  type        = number
  default     = 0  # 평시 0
}

variable "web_asg_max" {
  description = "Web ASG 최대 인스턴스"
  type        = number
  default     = 3
}

variable "web_asg_desired" {
  description = "Web ASG 희망 인스턴스 (평시 0, DR 시 2)"
  type        = number
  default     = 0  # 평시 0
}

variable "app_asg_min" {
  description = "App ASG 최소 인스턴스"
  type        = number
  default     = 0  # 평시 0
}

variable "app_asg_max" {
  description = "App ASG 최대 인스턴스"
  type        = number
  default     = 3
}

variable "app_asg_desired" {
  description = "App ASG 희망 인스턴스 (평시 0, DR 시 2)"
  type        = number
  default     = 0  # 평시 0
}

# -----------------------------------------------------------------------------
# DynamoDB 설정 (Global Table은 Main에서 관리)
# -----------------------------------------------------------------------------
variable "dynamodb_table_prefix" {
  description = "DynamoDB 테이블 접두사"
  type        = string
  default     = "KDT-Msp4-PLDR"
}

# -----------------------------------------------------------------------------
# 도메인 설정
# -----------------------------------------------------------------------------
variable "domain_name" {
  description = "Route 53 호스팅 영역 도메인"
  type        = string
  default     = "pilotlight-test.click"
}
```

### 4.3 terraform.tfvars (예시)

```hcl
# =============================================================================
# 변수 값 설정 - DR Tokyo
# ⚠️ 이 파일은 .gitignore에 추가!
# =============================================================================

project_name = "MegaTicket"
environment  = "prod"
aws_region   = "ap-northeast-1"  # 도쿄 리전
aws_profile  = "BedrockDevUser-hyebom"

# EC2 AMI (도쿄 리전에 복사된 Golden AMI ID)
web_ami_id = "ami-dr-web-xxxxxxxxx"  # 도쿄 Web AMI
app_ami_id = "ami-dr-app-yyyyyyyyy"  # 도쿄 App AMI

# SSH 키 페어 (도쿄 리전용)
key_pair_name = "megaticket-tokyo-keypair"

# 인스턴스 타입
instance_type = "t2.small"

# Auto Scaling (Pilot Light - 평시 0)
web_asg_min     = 0
web_asg_max     = 3
web_asg_desired = 0  # 평시 0, DR 시 2로 변경

app_asg_min     = 0
app_asg_max     = 3
app_asg_desired = 0  # 평시 0, DR 시 2로 변경

# DynamoDB (Main과 동일한 접두사 사용)
dynamodb_table_prefix = "KDT-Msp4-PLDR"

# 도메인
domain_name = "pilotlight-test.click"
```

### 4.4 security-groups.tf

```hcl
# =============================================================================
# Security Groups - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-DR-ALB-SG"
  description = "Security group for DR ALB"
  vpc_id      = aws_vpc.dr.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
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
    Name = "${var.project_name}-DR-ALB-SG"
  }
}

# -----------------------------------------------------------------------------
# Web Instance Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "web" {
  name        = "${var.project_name}-DR-Web-SG"
  description = "Security group for DR Web instances"
  vpc_id      = aws_vpc.dr.id

  ingress {
    description     = "Web Port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-DR-Web-SG"
  }
}

# -----------------------------------------------------------------------------
# App Instance Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.project_name}-DR-App-SG"
  description = "Security group for DR App instances"
  vpc_id      = aws_vpc.dr.id

  ingress {
    description     = "API Port from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "API Port from Web instances"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-DR-App-SG"
  }
}
```

### 4.5 iam.tf

```hcl
# =============================================================================
# IAM Roles and Policies - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# EC2 IAM Role (SSM + DynamoDB + Bedrock + CloudWatch)
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-DR-EC2-Role"

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

  tags = {
    Name = "${var.project_name}-DR-EC2-Role"
  }
}

# -----------------------------------------------------------------------------
# SSM 관리형 정책 연결
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# -----------------------------------------------------------------------------
# Bedrock 액세스 정책 (인라인)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "bedrock_policy" {
  name = "${var.project_name}-DR-Bedrock-Policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BedrockInvoke"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/anthropic.*",
          "arn:aws:bedrock:*::foundation-model/amazon.*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# DynamoDB 최소 권한 정책 (도쿄 리전 + Global Table)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "dynamodb_policy" {
  name = "${var.project_name}-DR-DynamoDB-MinimalAccess"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBMinimalAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:TransactWriteItems",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.dynamodb_table_prefix}-*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/${var.dynamodb_table_prefix}-*/index/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Logs 정책 (인라인)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "cloudwatch_policy" {
  name = "${var.project_name}-DR-CloudWatch-Policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Instance Profile
# -----------------------------------------------------------------------------
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-DR-EC2-Profile"
  role = aws_iam_role.ec2_role.name
}
```

### 4.6 ec2.tf

```hcl
# =============================================================================
# EC2 Instances with Auto Scaling - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# Launch Template - Web (DR 환경변수 포함)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "web" {
  name_prefix   = "${var.project_name}-DR-Web-LT-"
  image_id      = var.web_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.web.id]

  # User Data - DR 환경변수 설정
  user_data = base64encode(<<-EOF
    #!/bin/bash
    export HOME=/home/ssm-user
    cd $HOME
    
    # DR 리전 환경변수 설정 (도쿄)
    echo 'export AWS_REGION=${var.aws_region}' >> /home/ssm-user/.bashrc
    echo 'export NEXT_PUBLIC_AWS_REGION=${var.aws_region}' >> /home/ssm-user/.bashrc
    echo 'export INTERNAL_API_URL=https://${var.domain_name}' >> /home/ssm-user/.bashrc
    echo 'export DR_RECOVERY_MODE=true' >> /home/ssm-user/.bashrc
    
    # NVM 로드 및 PM2 시작
    source /home/ssm-user/.nvm/nvm.sh
    
    # .env.local 파일 수정 (도쿄 리전으로 변경)
    cd /home/ssm-user/megaticket/apps/web
    if [ -f .env.local ]; then
        sed -i 's/AWS_REGION=ap-northeast-2/AWS_REGION=${var.aws_region}/g' .env.local
        grep -q "NEXT_PUBLIC_AWS_REGION" .env.local || echo "NEXT_PUBLIC_AWS_REGION=${var.aws_region}" >> .env.local
        grep -q "DR_RECOVERY_MODE" .env.local || echo "DR_RECOVERY_MODE=true" >> .env.local
    fi
    
    export AWS_REGION=${var.aws_region}
    export NEXT_PUBLIC_AWS_REGION=${var.aws_region}
    export INTERNAL_API_URL=https://${var.domain_name}
    export DR_RECOVERY_MODE=true
    
    pm2 delete web-frontend 2>/dev/null || true
    pm2 start npm --name "web-frontend" -- start
    pm2 save
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-DR-Web"
      Role = "Web"
      DR   = "true"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Launch Template - App (DR 환경변수 포함)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-DR-App-LT-"
  image_id      = var.app_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # User Data - DR 환경변수 설정
  user_data = base64encode(<<-EOF
    #!/bin/bash
    export HOME=/home/ssm-user
    cd $HOME
    
    # DR 리전 환경변수 설정 (도쿄)
    echo 'export AWS_REGION=${var.aws_region}' >> /home/ssm-user/.bashrc
    echo 'export DR_RECOVERY_MODE=true' >> /home/ssm-user/.bashrc
    
    # NVM 로드 및 PM2 시작
    source /home/ssm-user/.nvm/nvm.sh
    cd /home/ssm-user/megaticket/apps/app
    
    export AWS_REGION=${var.aws_region}
    export DR_RECOVERY_MODE=true
    
    pm2 delete app-backend 2>/dev/null || true
    pm2 start npm --name "app-backend" -- start
    pm2 save
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-DR-App"
      Role = "App"
      DR   = "true"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - Web (Pilot Light: 평시 0)
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "web" {
  name                = "${var.project_name}-DR-Web-ASG"
  min_size            = var.web_asg_min      # 0
  max_size            = var.web_asg_max      # 3
  desired_capacity    = var.web_asg_desired  # 0 (평시), 2 (DR)
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.web.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-DR-Web-ASG"
    propagate_at_launch = true
  }

  tag {
    key                 = "DR"
    value               = "true"
    propagate_at_launch = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - App (Pilot Light: 평시 0)
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-DR-App-ASG"
  min_size            = var.app_asg_min      # 0
  max_size            = var.app_asg_max      # 3
  desired_capacity    = var.app_asg_desired  # 0 (평시), 2 (DR)
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-DR-App-ASG"
    propagate_at_launch = true
  }

  tag {
    key                 = "DR"
    value               = "true"
    propagate_at_launch = true
  }
}
```

### 4.7 alb.tf

```hcl
# =============================================================================
# Application Load Balancer - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# ALB
# -----------------------------------------------------------------------------
resource "aws_lb" "dr" {
  name               = "${var.project_name}-DR-ALB"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_c.id]

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-DR-ALB"
    DR   = "true"
  }
}

# -----------------------------------------------------------------------------
# Target Group - Web
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "web" {
  name     = "${var.project_name}-DR-Web-TG"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.dr.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
    path                = "/"
    matcher             = "200-399"
  }

  tags = {
    Name = "${var.project_name}-DR-Web-TG"
  }
}

# -----------------------------------------------------------------------------
# Target Group - App
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-DR-App-TG"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.dr.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-DR-App-TG"
  }
}

# -----------------------------------------------------------------------------
# HTTP Listener
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.dr.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# -----------------------------------------------------------------------------
# Listener Rule - API 경로 라우팅
# -----------------------------------------------------------------------------
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
```

### 4.8 outputs.tf

```hcl
# =============================================================================
# Outputs - DR Tokyo
# =============================================================================

output "vpc_id" {
  description = "DR VPC ID"
  value       = aws_vpc.dr.id
}

output "alb_dns_name" {
  description = "DR ALB DNS Name"
  value       = aws_lb.dr.dns_name
}

output "alb_zone_id" {
  description = "DR ALB Zone ID (Route 53 Failover용)"
  value       = aws_lb.dr.zone_id
}

output "web_asg_name" {
  description = "Web ASG Name (DR 활성화 시 사용)"
  value       = aws_autoscaling_group.web.name
}

output "app_asg_name" {
  description = "App ASG Name (DR 활성화 시 사용)"
  value       = aws_autoscaling_group.app.name
}

output "dr_activation_commands" {
  description = "DR 활성화 시 실행할 AWS CLI 명령어"
  value = <<-EOF
    # DR 활성화 (ASG desired capacity 변경)
    aws autoscaling set-desired-capacity --auto-scaling-group-name ${aws_autoscaling_group.web.name} --desired-capacity 2 --region ${var.aws_region}
    aws autoscaling set-desired-capacity --auto-scaling-group-name ${aws_autoscaling_group.app.name} --desired-capacity 2 --region ${var.aws_region}
    
    # DR 비활성화 (원복)
    aws autoscaling set-desired-capacity --auto-scaling-group-name ${aws_autoscaling_group.web.name} --desired-capacity 0 --region ${var.aws_region}
    aws autoscaling set-desired-capacity --auto-scaling-group-name ${aws_autoscaling_group.app.name} --desired-capacity 0 --region ${var.aws_region}
  EOF
}
```

---

## 5. 실행 방법

### 5.1 사전 준비 체크리스트

- [ ] 서울에서 Golden AMI 생성 완료
- [ ] 서울 AMI를 도쿄로 복사 완료
- [ ] Main 테라폼에서 DynamoDB Global Table 활성화
- [ ] 도쿄 리전 SSH 키 페어 생성

### 5.2 Terraform 실행

```bash
# 1. 디렉토리 이동
cd terraform/dr-tokyo

# 2. Terraform 초기화
terraform init

# 3. terraform.tfvars 생성 (도쿄 AMI ID 입력!)
# ⚠️ web_ami_id, app_ami_id를 도쿄 리전 AMI로 교체

# 4. 계획 확인
terraform plan

# 5. 인프라 생성
terraform apply

# 6. 출력값 확인
terraform output
```

### 5.3 Route 53 Failover 설정 (수동)

1. **Route 53 콘솔** → 호스팅 영역 선택
2. **Primary Record (서울)**:
   - 레코드 유형: A (Alias)
   - 라우팅 정책: Failover
   - Failover 레코드 유형: Primary
   - 대상: 서울 ALB
   - 헬스 체크: 생성 및 연결
3. **Secondary Record (도쿄)**:
   - 레코드 유형: A (Alias)
   - 라우팅 정책: Failover
   - Failover 레코드 유형: Secondary
   - 대상: 도쿄 ALB

---

## 6. Failover 테스트

### 6.1 DR 활성화 (수동)

```bash
# Web ASG 스케일 업 (0 → 2)
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name MegaTicket-DR-Web-ASG \
  --desired-capacity 2 \
  --region ap-northeast-1

# App ASG 스케일 업 (0 → 2)
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name MegaTicket-DR-App-ASG \
  --desired-capacity 2 \
  --region ap-northeast-1
```

### 6.2 DR 비활성화 (원복)

```bash
# Web ASG 스케일 다운 (2 → 0)
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name MegaTicket-DR-Web-ASG \
  --desired-capacity 0 \
  --region ap-northeast-1

# App ASG 스케일 다운 (2 → 0)
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name MegaTicket-DR-App-ASG \
  --desired-capacity 0 \
  --region ap-northeast-1
```

### 6.3 상태 확인

```bash
# ASG 상태 확인
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names MegaTicket-DR-Web-ASG MegaTicket-DR-App-ASG \
  --region ap-northeast-1 \
  --query 'AutoScalingGroups[*].[AutoScalingGroupName,DesiredCapacity,Instances[*].InstanceId]'

# Target Group 헬스 확인
aws elbv2 describe-target-health \
  --target-group-arn <TG_ARN> \
  --region ap-northeast-1
```

### 6.4 복구 시간 측정 (RTO)

| 단계 | 예상 시간 |
|------|----------|
| ASG 스케일 업 명령 | 즉시 |
| EC2 인스턴스 시작 | 2~3분 |
| PM2 서비스 시작 (User Data) | 30초~1분 |
| Target Group 헬스 체크 통과 | 30초 |
| **총 RTO** | **~5분** |

---

## 7. 비용 정보

### 7.1 평시 비용 (Pilot Light)

| 리소스 | 스펙 | 비용 (USD/월) |
|--------|------|--------------|
| VPC/Subnet | - | $0 |
| NAT Gateway | 대기 | ~$35 |
| ALB | 대기 | ~$18 |
| EC2 | ⏸️ 0개 | **$0** |
| DynamoDB Global Table | 복제 | ~$5-10 (쓰기량) |
| **평시 합계** | | **~$60/월** |

### 7.2 DR 활성화 시 추가 비용

| 리소스 | 스펙 | 추가 비용 (USD/월) |
|--------|------|-------------------|
| EC2 (Web) × 2 | t2.small | ~$35 |
| EC2 (App) × 2 | t2.small | ~$35 |
| **DR 활성화 시 총 비용** | | **~$130/월** |

### 7.3 비용 최적화 팁

1. **평시 EC2 0개 유지**: Pilot Light 전략의 핵심
2. **NAT Gateway 단일화**: 1개 AZ에만 배치
3. **테스트 후 즉시 원복**: DR 테스트 후 ASG를 0으로 복구

---

## 📚 관련 문서

- [Terraform_Main_Seoul.md](./Terraform_Main_Seoul.md) - Main 리전 (서울) 테라폼 가이드
- [DR_Recovery_Test_Guide.md](./DR_Recovery_Test_Guide.md) - DR 복구 상세 가이드
- [DynamoDB_Schema.md](./DynamoDB_Schema.md) - DR 관련 상태 (DR_RESERVED, DR_RECOVERED)
- [Bedrock_Technical_Guide.md](./Bedrock_Technical_Guide.md) - Cross-Region Inference

---

**Last Updated**: 2025-12-29  
**Maintainer**: 설혜봄 (MSP-Project-Pilot-Light)
