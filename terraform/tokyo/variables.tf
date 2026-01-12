# =============================================================================
# Variables - Tokyo DR Region (V3.0 PLCR)
# =============================================================================

# -----------------------------------------------------------------------------
# 기본 설정
# -----------------------------------------------------------------------------
variable "project_name" {
  description = "프로젝트 이름 (PLCR 네이밍)"
  type        = string
  default     = "plcr"
}

variable "region_code" {
  description = "리전 코드 (an2=서울, an1=도쿄)"
  type        = string
  default     = "an1"
}

variable "environment" {
  description = "환경 (prod/dev/dr)"
  type        = string
  default     = "dr"
}

variable "aws_region" {
  description = "AWS 리전 (도쿄)"
  type        = string
  default     = "ap-northeast-1"
}

variable "aws_profile" {
  description = "AWS CLI 프로파일 이름"
  type        = string
  default     = "default"
}

# -----------------------------------------------------------------------------
# VPC 설정 (V3.0 CIDR: 10.0.1.0/24)
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "VPC CIDR 블록"
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_a_cidr" {
  description = "Public Subnet A CIDR (ALB, NAT용)"
  type        = string
  default     = "10.0.1.0/27"
}

variable "public_subnet_c_cidr" {
  description = "Public Subnet C CIDR (ALB, NAT용)"
  type        = string
  default     = "10.0.1.32/27"
}

variable "private_subnet_a_cidr" {
  description = "Private Subnet A CIDR (App EC2용)"
  type        = string
  default     = "10.0.1.64/26"
}

variable "private_subnet_c_cidr" {
  description = "Private Subnet C CIDR (App EC2용)"
  type        = string
  default     = "10.0.1.128/26"
}

# -----------------------------------------------------------------------------
# EC2 설정
# -----------------------------------------------------------------------------
variable "key_pair_name" {
  description = "EC2 SSH 키 페어 이름 (도쿄 리전)"
  type        = string
  default     = "seungwan_tokyo"
}

variable "instance_type" {
  description = "EC2 인스턴스 타입"
  type        = string
  default     = "t2.medium"
}

variable "base_ami_id" {
  description = "App EC2 Golden AMI ID (도쿄 리전)"
  type        = string
  default     = ""  # terraform.tfvars에서 지정
}

# -----------------------------------------------------------------------------
# Auto Scaling 설정 (App만 - Pilot Light: desired=0)
# -----------------------------------------------------------------------------
variable "app_asg_min" {
  description = "App ASG 최소 인스턴스"
  type        = number
}

variable "app_asg_max" {
  description = "App ASG 최대 인스턴스"
  type        = number
}

variable "app_asg_desired" {
  description = "App ASG 희망 인스턴스 (Pilot Light: 0)"
  type        = number
}

# -----------------------------------------------------------------------------
# DynamoDB 설정 (참조용 - Global Table은 서울에서 관리)
# -----------------------------------------------------------------------------
variable "dynamodb_table_prefix" {
  description = "DynamoDB 테이블 접두사 (IAM 정책용)"
  type        = string
  default     = "KDT-Msp4-PLDR"
}

# -----------------------------------------------------------------------------
# 도메인 설정
# -----------------------------------------------------------------------------
variable "domain_name" {
  description = "Route 53 호스팅 영역 도메인"
  type        = string
  default     = "megaticket.click"
}

variable "route53_zone_id" {
  description = "Route53 Hosted Zone ID for megaticket.click"
  type        = string
  default     = "Z02745862QYUFMC87Y6RJ"
}

variable "acm_certificate_arn" {
  description = "ACM SSL 인증서 ARN (megaticket.click - 도쿄 리전)"
  type        = string
  default     = "arn:aws:acm:ap-northeast-1:626614672806:certificate/d8ac0f33-980e-45e4-9608-caf2326f4e2b"
}

# -----------------------------------------------------------------------------
# GitHub 레포지토리
# -----------------------------------------------------------------------------
variable "github_repo" {
  description = "소스 코드 GitHub 레포지토리 URL"
  type        = string
  default     = "https://github.com/seolhyebom/megaticket.git"
}
