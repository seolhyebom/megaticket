# =============================================================================
# Variables - Tokyo DR Region (V3.0 PLCR)
# =============================================================================

# -----------------------------------------------------------------------------
# 기본 설정
# -----------------------------------------------------------------------------
variable "project_name" {
  type        = string
  default     = "plcr"
}

variable "region_code" {
  type        = string
  default     = "an1"
}

variable "environment" {
  type        = string
  default     = "dr"
}

variable "aws_region" {
  type        = string
  default     = "ap-northeast-1"
}

# -----------------------------------------------------------------------------
# VPC 
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_a_cidr" {
  type        = string
  default     = "10.0.1.0/27"
}

variable "public_subnet_c_cidr" {
  type        = string
  default     = "10.0.1.32/27"
}

variable "private_subnet_a_cidr" {
  type        = string
  default     = "10.0.1.64/26"
}

variable "private_subnet_c_cidr" {
  type        = string
  default     = "10.0.1.128/26"
}

# -----------------------------------------------------------------------------
# EC2
# -----------------------------------------------------------------------------
variable "instance_type" {
  type        = string
  default     = "t2.medium"
}

variable "base_ami_id" {
  type        = string
}

# -----------------------------------------------------------------------------
# Auto Scaling 설정 (App - Pilot Light: desired=0)
# -----------------------------------------------------------------------------
variable "app_asg_min" {
  type        = number
}

variable "app_asg_max" {
  type        = number
}

variable "app_asg_desired" {
  type        = number
}

# -----------------------------------------------------------------------------
# DynamoDB 
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
  default     = "megaticket.click"
}

variable "route53_zone_id" {
  type        = string
  default     = "Z02745862QYUFMC87Y6RJ"
}

variable "acm_certificate_arn" {
  type        = string
  default     = "arn:aws:acm:ap-northeast-1:626614672806:certificate/d8ac0f33-980e-45e4-9608-caf2326f4e2b"
}

# -----------------------------------------------------------------------------
# GitHub 레포지토리
# -----------------------------------------------------------------------------
variable "github_repo" {
  type        = string
  default     = "https://github.com/seolhyebom/megaticket.git"
}