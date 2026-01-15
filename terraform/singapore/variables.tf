# =============================================================================
# Variables - Singapore Main Region (V3.0 PLCR)
# =============================================================================

# -----------------------------------------------------------------------------
# Common
# -----------------------------------------------------------------------------
variable "project_name" {
  type        = string
  default     = "plcr"
}

variable "region_code" {
  type        = string
  default     = "aps1"
}

variable "environment" {
  type        = string
  default     = "prod"
}

variable "aws_region" {
  type        = string
  default     = "ap-southeast-1"
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  type        = string
  default     = "10.1.0.0/24"
}

variable "public_subnet_a_cidr" {
  type        = string
  default     = "10.1.0.0/27"
}

variable "public_subnet_b_cidr" {
  type        = string
  default     = "10.1.0.32/27"
}

variable "private_subnet_a_cidr" {
  type        = string
  default     = "10.1.0.64/26"
}

variable "private_subnet_b_cidr" {
  type        = string
  default     = "10.1.0.128/26"
}

# -----------------------------------------------------------------------------
# EC2 - AMI 자동 조회
# -----------------------------------------------------------------------------
variable "instance_type" {
  type        = string
  default     = "t2.medium"
}

# -----------------------------------------------------------------------------
# Auto Scaling
# -----------------------------------------------------------------------------
variable "app_asg_min" {
  type        = number
  default     = 1
}

variable "app_asg_max" {
  type        = number
  default     = 4
}

variable "app_asg_desired" {
  type        = number
  default     = 2
}

# -----------------------------------------------------------------------------
# DynamoDB (싱가포르에 수동 생성 완료)
# -----------------------------------------------------------------------------
variable "dynamodb_table_prefix" {
  type        = string
  default     = "plcr-gtbl"
}

# -----------------------------------------------------------------------------
# 도메인 설정
# -----------------------------------------------------------------------------
variable "domain_name" {
  type        = string
  default     = "pilotlight-test.click"
}

variable "acm_certificate_arn" {
  type        = string
  default     = "arn:aws:acm:ap-southeast-1:626614672806:certificate/a86d20fa-75d0-4e62-ac17-3974fcc6f767"
}

# -----------------------------------------------------------------------------
# GitHub 레포지토리
# -----------------------------------------------------------------------------
variable "github_repo" {
  type        = string
  default     = "https://github.com/seolhyebom/megaticket.git"
}
