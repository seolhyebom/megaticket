# MegaTicket 인프라 테라폼 가이드 - Main 리전 (서울)

> **Version**: 1.0  
> **Last Updated**: 2025-12-29  
> **AWS 리전**: ap-northeast-2 (서울)  
> **작성자**: 설혜봄 (MSP-Project-Pilot-Light)

---

## 📋 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [사전 준비 사항](#2-사전-준비-사항)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [Terraform 코드](#4-terraform-코드)
5. [실행 방법](#5-실행-방법)
6. [비용 정보](#6-비용-정보)

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Main Region: ap-northeast-2 (서울)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            VPC (10.0.0.0/16)                             │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │              Public Subnets (AZ-a / AZ-c)                        │   │   │
│  │  │   ┌──────────────────────────────────────────────────────────┐  │   │   │
│  │  │   │  Application Load Balancer (ALB)                         │  │   │   │
│  │  │   │  - Port 80/443 → Web (3000) / API (3001)                 │  │   │   │
│  │  │   └──────────────────────────────────────────────────────────┘  │   │   │
│  │  │   ┌─────────────────┐                                           │   │   │
│  │  │   │   NAT Gateway   │                                           │   │   │
│  │  │   └─────────────────┘                                           │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                    │                                    │   │
│  │  ┌─────────────────────────────────▼───────────────────────────────┐   │   │
│  │  │              Private Subnets (AZ-a / AZ-c)                       │   │   │
│  │  │                                                                  │   │   │
│  │  │  ┌───────────────────────┐    ┌───────────────────────┐         │   │   │
│  │  │  │   Auto Scaling Group  │    │   Auto Scaling Group  │         │   │   │
│  │  │  │   (Web - Port 3000)   │    │   (App - Port 3001)   │         │   │   │
│  │  │  │   ┌────────┐ ┌─────┐ │    │   ┌────────┐ ┌─────┐  │         │   │   │
│  │  │  │   │ Web EC2│ │Web2 │ │    │   │ App EC2│ │App2 │  │         │   │   │
│  │  │  │   └────────┘ └─────┘ │    │   └────────┘ └─────┘  │         │   │   │
│  │  │  └───────────────────────┘    └───────────────────────┘         │   │   │
│  │  │                                                                  │   │   │
│  │  └──────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    AWS Services (Serverless)                             │   │
│  │                                                                         │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │   │
│  │  │ DynamoDB         │  │ Bedrock          │  │ CloudWatch       │      │   │
│  │  │ Global Tables    │  │ Claude Haiku 4.5 │  │ Logs / Metrics   │      │   │
│  │  │ (4개 테이블)      │  │ Nova Lite        │  │ (EMF)            │      │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘      │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 주요 구성 요소

| 리소스 | 용도 | 비고 |
|--------|------|------|
| **VPC** | 격리된 네트워크 환경 | CIDR: 10.0.0.0/16 |
| **Public Subnet** | ALB, NAT Gateway 배치 | 2개 AZ |
| **Private Subnet** | EC2 인스턴스 배치 | 2개 AZ |
| **ALB** | 트래픽 분산 | Web(3000), App(3001) |
| **EC2 (Web)** | Next.js Frontend | Port 3000 |
| **EC2 (App)** | Next.js API Backend | Port 3001 |
| **DynamoDB** | NoSQL 데이터베이스 | Global Table (도쿄 복제) |
| **Bedrock** | AI 모델 호출 | Claude Haiku 4.5 |

---

## 2. 사전 준비 사항

### 2.1 필수 도구

```bash
# Terraform 설치 확인
terraform --version  # >= 1.0.0

# AWS CLI 설치 및 프로파일 설정
aws configure --profile BedrockDevUser-hyebom
```

### 2.2 AWS 프로파일 설정

```ini
# ~/.aws/config
[profile BedrockDevUser-hyebom]
region = ap-northeast-2
output = json
```

### 2.3 사전 생성 필요 항목

| 항목 | 값 예시 | 설명 |
|------|---------|------|
| **SSH 키 페어** | `megaticket-seoul-keypair` | EC2 접속용 (SSM 사용 시 불필요) |
| **Route 53 호스팅 영역** | `pilotlight-test.click` | 도메인 연결용 |
| **ACM 인증서** | `*.pilotlight-test.click` | HTTPS용 (서울 리전) |

---

## 3. 디렉토리 구조

```
terraform/
├── main-seoul/
│   ├── main.tf              # 메인 설정 (Provider, VPC, Subnet)
│   ├── variables.tf         # 변수 정의
│   ├── terraform.tfvars     # 변수 값 (민감정보 - git 제외)
│   ├── security-groups.tf   # 보안 그룹
│   ├── iam.tf               # IAM 역할 및 정책
│   ├── ec2.tf               # EC2 인스턴스 / ASG
│   ├── alb.tf               # Application Load Balancer
│   ├── dynamodb.tf          # DynamoDB 테이블 (Global Table)
│   └── outputs.tf           # 출력값
└── dr-tokyo/
    └── (DR_Terraform_Tokyo.md 참조)
```

---

## 4. Terraform 코드

### 4.1 main.tf

```hcl
# =============================================================================
# MegaTicket Infrastructure - Main Region (Seoul)
# =============================================================================

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # 원격 상태 저장 (선택 - S3 백엔드 사용 시)
  # backend "s3" {
  #   bucket  = "megaticket-terraform-state"
  #   key     = "main-seoul/terraform.tfstate"
  #   region  = "ap-northeast-2"
  #   encrypt = true
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
  
  default_tags {
    tags = {
      Project     = "MegaTicket"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-VPC"
  }
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-IGW"
  }
}

# -----------------------------------------------------------------------------
# Subnets - Public
# -----------------------------------------------------------------------------
resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_a_cidr
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-Public-Subnet-A"
    Type = "Public"
  }
}

resource "aws_subnet" "public_c" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_c_cidr
  availability_zone       = "${var.aws_region}c"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-Public-Subnet-C"
    Type = "Public"
  }
}

# -----------------------------------------------------------------------------
# Subnets - Private
# -----------------------------------------------------------------------------
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_a_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-Private-Subnet-A"
    Type = "Private"
  }
}

resource "aws_subnet" "private_c" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_c_cidr
  availability_zone = "${var.aws_region}c"

  tags = {
    Name = "${var.project_name}-Private-Subnet-C"
    Type = "Private"
  }
}

# -----------------------------------------------------------------------------
# NAT Gateway (Single - 비용 최적화)
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-NAT-EIP"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id

  tags = {
    Name = "${var.project_name}-NAT-GW"
  }

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# Route Tables
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-Public-RT"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-Private-RT"
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
# Variables
# =============================================================================

# -----------------------------------------------------------------------------
# 기본 설정
# -----------------------------------------------------------------------------
variable "project_name" {
  description = "프로젝트 이름 (리소스 Name 태그 접두사)"
  type        = string
  default     = "MegaTicket"
}

variable "environment" {
  description = "환경 (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS 리전"
  type        = string
  default     = "ap-northeast-2"
}

variable "aws_profile" {
  description = "AWS CLI 프로파일 이름"
  type        = string
  default     = "BedrockDevUser-hyebom"
}

# -----------------------------------------------------------------------------
# VPC 설정
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "VPC CIDR 블록"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_a_cidr" {
  description = "Public Subnet A CIDR"
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_c_cidr" {
  description = "Public Subnet C CIDR"
  type        = string
  default     = "10.0.2.0/24"
}

variable "private_subnet_a_cidr" {
  description = "Private Subnet A CIDR"
  type        = string
  default     = "10.0.10.0/24"
}

variable "private_subnet_c_cidr" {
  description = "Private Subnet C CIDR"
  type        = string
  default     = "10.0.11.0/24"
}

# -----------------------------------------------------------------------------
# EC2 설정
# -----------------------------------------------------------------------------
variable "key_pair_name" {
  description = "EC2 SSH 키 페어 이름"
  type        = string
  default     = "megaticket-seoul-keypair"
}

variable "web_ami_id" {
  description = "Web 인스턴스 AMI ID (Golden AMI)"
  type        = string
}

variable "app_ami_id" {
  description = "App 인스턴스 AMI ID (Golden AMI)"
  type        = string
}

variable "instance_type" {
  description = "EC2 인스턴스 타입"
  type        = string
  default     = "t2.small"
}

# -----------------------------------------------------------------------------
# Auto Scaling 설정
# -----------------------------------------------------------------------------
variable "web_asg_min" {
  description = "Web ASG 최소 인스턴스"
  type        = number
  default     = 1
}

variable "web_asg_max" {
  description = "Web ASG 최대 인스턴스"
  type        = number
  default     = 3
}

variable "web_asg_desired" {
  description = "Web ASG 희망 인스턴스"
  type        = number
  default     = 2
}

variable "app_asg_min" {
  description = "App ASG 최소 인스턴스"
  type        = number
  default     = 1
}

variable "app_asg_max" {
  description = "App ASG 최대 인스턴스"
  type        = number
  default     = 3
}

variable "app_asg_desired" {
  description = "App ASG 희망 인스턴스"
  type        = number
  default     = 2
}

# -----------------------------------------------------------------------------
# DynamoDB 설정
# -----------------------------------------------------------------------------
variable "dynamodb_table_prefix" {
  description = "DynamoDB 테이블 접두사"
  type        = string
  default     = "KDT-Msp4-PLDR"
}

variable "enable_dynamodb_global_table" {
  description = "DynamoDB Global Table 활성화 (DR 리전)"
  type        = bool
  default     = true
}

variable "dr_region" {
  description = "DR 리전 (Global Table 복제 대상)"
  type        = string
  default     = "ap-northeast-1"
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
# 변수 값 설정 (이 파일은 .gitignore에 추가!)
# =============================================================================

project_name = "MegaTicket"
environment  = "prod"
aws_region   = "ap-northeast-2"
aws_profile  = "BedrockDevUser-hyebom"

# EC2 AMI (Golden AMI ID로 교체 필요)
web_ami_id = "ami-xxxxxxxxxxxxxxxxx"  # Web Golden AMI
app_ami_id = "ami-yyyyyyyyyyyyyyyyy"  # App Golden AMI

# SSH 키 페어
key_pair_name = "megaticket-seoul-keypair"

# 인스턴스 타입
instance_type = "t2.small"

# Auto Scaling
web_asg_min     = 1
web_asg_max     = 3
web_asg_desired = 2

app_asg_min     = 1
app_asg_max     = 3
app_asg_desired = 2

# DynamoDB
dynamodb_table_prefix        = "KDT-Msp4-PLDR"
enable_dynamodb_global_table = true
dr_region                    = "ap-northeast-1"

# 도메인
domain_name = "pilotlight-test.click"
```

### 4.4 security-groups.tf

```hcl
# =============================================================================
# Security Groups
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-ALB-SG"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

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
    Name = "${var.project_name}-ALB-SG"
  }
}

# -----------------------------------------------------------------------------
# Web Instance Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "web" {
  name        = "${var.project_name}-Web-SG"
  description = "Security group for Web instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Web Port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # SSM Session Manager용 (SSH 대신 사용)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-Web-SG"
  }
}

# -----------------------------------------------------------------------------
# App Instance Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.project_name}-App-SG"
  description = "Security group for App instances"
  vpc_id      = aws_vpc.main.id

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
    Name = "${var.project_name}-App-SG"
  }
}
```

### 4.5 iam.tf

```hcl
# =============================================================================
# IAM Roles and Policies
# =============================================================================

# -----------------------------------------------------------------------------
# EC2 IAM Role (SSM + DynamoDB + Bedrock + CloudWatch)
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-EC2-Role"

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
    Name = "${var.project_name}-EC2-Role"
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
  name = "${var.project_name}-Bedrock-Policy"
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
# DynamoDB 최소 권한 정책 (인라인)
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "dynamodb_policy" {
  name = "${var.project_name}-DynamoDB-MinimalAccess"
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
  name = "${var.project_name}-CloudWatch-Policy"
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
  name = "${var.project_name}-EC2-Profile"
  role = aws_iam_role.ec2_role.name
}
```

### 4.6 ec2.tf

```hcl
# =============================================================================
# EC2 Instances with Auto Scaling
# =============================================================================

# -----------------------------------------------------------------------------
# Launch Template - Web
# -----------------------------------------------------------------------------
resource "aws_launch_template" "web" {
  name_prefix   = "${var.project_name}-Web-LT-"
  image_id      = var.web_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.web.id]

  # User Data - PM2 서비스 자동 시작
  user_data = base64encode(<<-EOF
    #!/bin/bash
    export HOME=/home/ssm-user
    cd $HOME
    
    # 환경변수 설정
    echo 'export AWS_REGION=${var.aws_region}' >> /home/ssm-user/.bashrc
    echo 'export NEXT_PUBLIC_AWS_REGION=${var.aws_region}' >> /home/ssm-user/.bashrc
    echo 'export INTERNAL_API_URL=https://${var.domain_name}' >> /home/ssm-user/.bashrc
    
    # NVM 로드 및 PM2 시작
    source /home/ssm-user/.nvm/nvm.sh
    cd /home/ssm-user/megaticket/apps/web
    
    export AWS_REGION=${var.aws_region}
    export NEXT_PUBLIC_AWS_REGION=${var.aws_region}
    export INTERNAL_API_URL=https://${var.domain_name}
    
    pm2 delete web-frontend 2>/dev/null || true
    pm2 start npm --name "web-frontend" -- start
    pm2 save
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-Web"
      Role = "Web"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Launch Template - App
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-App-LT-"
  image_id      = var.app_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # User Data - PM2 서비스 자동 시작
  user_data = base64encode(<<-EOF
    #!/bin/bash
    export HOME=/home/ssm-user
    cd $HOME
    
    # 환경변수 설정
    echo 'export AWS_REGION=${var.aws_region}' >> /home/ssm-user/.bashrc
    
    # NVM 로드 및 PM2 시작
    source /home/ssm-user/.nvm/nvm.sh
    cd /home/ssm-user/megaticket/apps/app
    
    export AWS_REGION=${var.aws_region}
    
    pm2 delete app-backend 2>/dev/null || true
    pm2 start npm --name "app-backend" -- start
    pm2 save
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-App"
      Role = "App"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - Web
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "web" {
  name                = "${var.project_name}-Web-ASG"
  min_size            = var.web_asg_min
  max_size            = var.web_asg_max
  desired_capacity    = var.web_asg_desired
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
    value               = "${var.project_name}-Web-ASG"
    propagate_at_launch = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - App
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-App-ASG"
  min_size            = var.app_asg_min
  max_size            = var.app_asg_max
  desired_capacity    = var.app_asg_desired
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
    value               = "${var.project_name}-App-ASG"
    propagate_at_launch = true
  }
}
```

### 4.7 alb.tf

```hcl
# =============================================================================
# Application Load Balancer
# =============================================================================

# -----------------------------------------------------------------------------
# ALB
# -----------------------------------------------------------------------------
resource "aws_lb" "main" {
  name               = "${var.project_name}-ALB"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_c.id]

  enable_deletion_protection = false  # 프로덕션에서는 true 권장

  tags = {
    Name = "${var.project_name}-ALB"
  }
}

# -----------------------------------------------------------------------------
# Target Group - Web
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "web" {
  name     = "${var.project_name}-Web-TG"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

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
    Name = "${var.project_name}-Web-TG"
  }
}

# -----------------------------------------------------------------------------
# Target Group - App
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-App-TG"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

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
    Name = "${var.project_name}-App-TG"
  }
}

# -----------------------------------------------------------------------------
# HTTP Listener (HTTP → HTTPS Redirect 권장)
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
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

# -----------------------------------------------------------------------------
# HTTPS Listener (ACM 인증서 필요)
# -----------------------------------------------------------------------------
# 주석 해제하여 HTTPS 활성화
# resource "aws_lb_listener" "https" {
#   load_balancer_arn = aws_lb.main.arn
#   port              = 443
#   protocol          = "HTTPS"
#   ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
#   certificate_arn   = "arn:aws:acm:${var.aws_region}:ACCOUNT_ID:certificate/CERT_ID"
#
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.web.arn
#   }
# }
```

### 4.8 dynamodb.tf

```hcl
# =============================================================================
# DynamoDB Tables with Global Table Replication
# =============================================================================

# -----------------------------------------------------------------------------
# performances 테이블
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "performances" {
  name         = "${var.dynamodb_table_prefix}-performances"
  billing_mode = "PAY_PER_REQUEST"  # On-Demand 과금
  hash_key     = "performanceId"

  attribute {
    name = "performanceId"
    type = "S"
  }

  # Global Table 복제 설정 (도쿄 리전)
  dynamic "replica" {
    for_each = var.enable_dynamodb_global_table ? [var.dr_region] : []
    content {
      region_name = replica.value
    }
  }

  tags = {
    Name = "${var.dynamodb_table_prefix}-performances"
  }
}

# -----------------------------------------------------------------------------
# reservations 테이블
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "reservations" {
  name         = "${var.dynamodb_table_prefix}-reservations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  # TTL 설정 (HOLDING, CANCELLED 자동 삭제)
  ttl {
    attribute_name = "holdExpiresAt"
    enabled        = true
  }

  # GSI: 사용자별 예약 조회
  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  # Global Table 복제
  dynamic "replica" {
    for_each = var.enable_dynamodb_global_table ? [var.dr_region] : []
    content {
      region_name = replica.value
    }
  }

  tags = {
    Name = "${var.dynamodb_table_prefix}-reservations"
  }
}

# -----------------------------------------------------------------------------
# schedules 테이블
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "schedules" {
  name         = "${var.dynamodb_table_prefix}-schedules"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "scheduleId"

  attribute {
    name = "scheduleId"
    type = "S"
  }

  attribute {
    name = "performanceId"
    type = "S"
  }

  # GSI: 공연별 스케줄 조회
  global_secondary_index {
    name            = "performanceId-index"
    hash_key        = "performanceId"
    projection_type = "ALL"
  }

  # Global Table 복제
  dynamic "replica" {
    for_each = var.enable_dynamodb_global_table ? [var.dr_region] : []
    content {
      region_name = replica.value
    }
  }

  tags = {
    Name = "${var.dynamodb_table_prefix}-schedules"
  }
}

# -----------------------------------------------------------------------------
# venues 테이블
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "venues" {
  name         = "${var.dynamodb_table_prefix}-venues"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "venueId"

  attribute {
    name = "venueId"
    type = "S"
  }

  # Global Table 복제
  dynamic "replica" {
    for_each = var.enable_dynamodb_global_table ? [var.dr_region] : []
    content {
      region_name = replica.value
    }
  }

  tags = {
    Name = "${var.dynamodb_table_prefix}-venues"
  }
}
```

### 4.9 outputs.tf

```hcl
# =============================================================================
# Outputs
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "ALB DNS Name (브라우저 접속 주소)"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB Zone ID (Route 53 Alias 레코드용)"
  value       = aws_lb.main.zone_id
}

output "web_target_group_arn" {
  description = "Web Target Group ARN"
  value       = aws_lb_target_group.web.arn
}

output "app_target_group_arn" {
  description = "App Target Group ARN"
  value       = aws_lb_target_group.app.arn
}

output "dynamodb_table_names" {
  description = "DynamoDB 테이블 이름 목록"
  value = {
    performances = aws_dynamodb_table.performances.name
    reservations = aws_dynamodb_table.reservations.name
    schedules    = aws_dynamodb_table.schedules.name
    venues       = aws_dynamodb_table.venues.name
  }
}

output "ec2_iam_role_arn" {
  description = "EC2 IAM Role ARN"
  value       = aws_iam_role.ec2_role.arn
}

output "private_subnet_ids" {
  description = "Private Subnet IDs (EC2 배치용)"
  value       = [aws_subnet.private_a.id, aws_subnet.private_c.id]
}

output "public_subnet_ids" {
  description = "Public Subnet IDs (ALB 배치용)"
  value       = [aws_subnet.public_a.id, aws_subnet.public_c.id]
}
```

---

## 5. 실행 방법

### 5.1 초기화 및 적용

```bash
# 1. 디렉토리 이동
cd terraform/main-seoul

# 2. Terraform 초기화
terraform init

# 3. terraform.tfvars 파일 생성 (위 예시 참조)
# ⚠️ AMI ID를 실제 Golden AMI ID로 변경!

# 4. 계획 확인 (Dry-run)
terraform plan

# 5. 인프라 생성
terraform apply

# 6. 출력값 확인
terraform output
```

### 5.2 Golden AMI 준비

> ⚠️ **중요**: EC2 Launch Template에서 사용하는 AMI는 PM2, Node.js, 애플리케이션 코드가 설치된 **Golden AMI**여야 합니다.

Golden AMI 생성 방법은 [DR_Recovery_Test_Guide.md](./DR_Recovery_Test_Guide.md) 문서의 Step 1을 참조하세요.

### 5.3 Route 53 연결 (수동)

Terraform 적용 후, Route 53에서 ALB로 트래픽을 라우팅하도록 설정:

1. **Route 53 콘솔** → 호스팅 영역 선택
2. **레코드 생성** → A 레코드 (Alias)
3. **라우팅 대상**: Application Load Balancer → 서울 리전 → ALB 선택

---

## 6. 비용 정보

### 6.1 예상 월간 비용 (서울 리전)

| 리소스 | 스펙 | 예상 비용 (USD/월) |
|--------|------|-------------------|
| EC2 (Web) × 2 | t2.small | ~$35 |
| EC2 (App) × 2 | t2.small | ~$35 |
| ALB | - | ~$18 |
| NAT Gateway | - | ~$35 |
| DynamoDB | On-Demand | ~$5-20 (사용량) |
| Bedrock | Claude Haiku 4.5 | ~$10-50 (사용량) |
| **합계** | | **~$140-200/월** |

### 6.2 비용 최적화 팁

1. **NAT Gateway 단일화**: 2개 AZ에 각각 NAT Gateway 대신 1개만 사용 (이미 적용)
2. **Spot 인스턴스**: 테스트 환경에서는 Spot 인스턴스 활용
3. **DynamoDB On-Demand**: 트래픽 변동이 클 경우 Provisioned보다 유리
4. **프롬프트 캐싱**: Bedrock Claude 모델의 프롬프트 캐싱으로 토큰 비용 90% 절감

---

## 📚 관련 문서

- [Terraform_DR_Tokyo.md](./Terraform_DR_Tokyo.md) - DR 리전 (도쿄) 테라폼 가이드
- [DR_Recovery_Test_Guide.md](./DR_Recovery_Test_Guide.md) - DR 복구 테스트 가이드
- [Instance_Deployment_Guide.md](./Instance_Deployment_Guide.md) - EC2 수동 배포 가이드
- [Bedrock_Technical_Guide.md](./Bedrock_Technical_Guide.md) - Bedrock 기술 가이드
- [DynamoDB_Schema.md](./DynamoDB_Schema.md) - DynamoDB 스키마 문서

---

**Last Updated**: 2025-12-29  
**Maintainer**: 설혜봄 (MSP-Project-Pilot-Light)
