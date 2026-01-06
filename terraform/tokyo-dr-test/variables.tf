# =============================================================================
# Variables - DR Tokyo (GoldenAMI 사용)
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
  default     = "test"
}

variable "aws_region" {
  description = "AWS 리전 (도쿄)"
  type        = string
  default     = "ap-northeast-1"
}

variable "aws_profile" {
  description = "AWS CLI 프로파일"
  type        = string
  default     = "default"
}

# -----------------------------------------------------------------------------
# VPC 설정 (Main과 다른 CIDR: 10.1.0.0/16)
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "VPC CIDR 블록"
  type        = string
  default     = "10.1.0.0/16"
}

variable "public_subnet_a_cidr" {
  description = "Public Subnet A CIDR (ALB, NAT용 - 작게)"
  type        = string
  default     = "10.1.0.0/26"  # 64 IPs
}

variable "public_subnet_c_cidr" {
  description = "Public Subnet C CIDR (ALB, NAT용 - 작게)"
  type        = string
  default     = "10.1.0.64/26"  # 64 IPs
}

variable "private_subnet_a_cidr" {
  description = "Private Subnet A CIDR (EC2용 - 크게)"
  type        = string
  default     = "10.1.16.0/20"  # 4096 IPs
}

variable "private_subnet_c_cidr" {
  description = "Private Subnet C CIDR (EC2용 - 크게)"
  type        = string
  default     = "10.1.32.0/20"  # 4096 IPs
}

# -----------------------------------------------------------------------------
# EC2 설정
# -----------------------------------------------------------------------------
variable "key_pair_name" {
  description = "EC2 SSH 키 페어 이름 (도쿄 리전)"
  type        = string
  default     = "seungwan_tokyo"
}

variable "web_ami_id" {
  description = "Web Golden AMI ID (서울에서 복사된 AMI)"
  type        = string
  # 실행 시 반드시 지정 필요: terraform apply -var="web_ami_id=ami-xxx"
}

variable "app_ami_id" {
  description = "App Golden AMI ID (서울에서 복사된 AMI)"
  type        = string
  # 실행 시 반드시 지정 필요: terraform apply -var="app_ami_id=ami-yyy"
}

variable "instance_type" {
  description = "EC2 인스턴스 타입"
  type        = string
  default     = "t2.medium"
}

# -----------------------------------------------------------------------------
# Auto Scaling 설정 (테스트용 - 각 1개)
# -----------------------------------------------------------------------------
variable "web_asg_min" {
  description = "Web ASG 최소 인스턴스"
  type        = number
  default     = 0
}

variable "web_asg_max" {
  description = "Web ASG 최대 인스턴스"
  type        = number
  default     = 2
}

variable "web_asg_desired" {
  description = "Web ASG 희망 인스턴스 (Cold Standby 0개)"
  type        = number
  default     = 0
}

variable "app_asg_min" {
  description = "App ASG 최소 인스턴스"
  type        = number
  default     = 0
}

variable "app_asg_max" {
  description = "App ASG 최대 인스턴스"
  type        = number
  default     = 2
}

variable "app_asg_desired" {
  description = "App ASG 희망 인스턴스 (Cold Standby 0개)"
  type        = number
  default     = 0
}

# -----------------------------------------------------------------------------
# DynamoDB 설정 (참조용 - Global Table은 Main에서 관리)
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
  default     = "pilotlight-test.click"
}
