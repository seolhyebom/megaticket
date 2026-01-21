# =============================================================================
# Variables - Seoul Main Region (V3.0 PLCR)
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
  default     = "an2"
}

variable "environment" {
  type        = string
  default     = "prod"
}

variable "aws_region" {
  type        = string
  default     = "ap-northeast-2"
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/24"
}

variable "public_subnet_a_cidr" {
  type        = string
  default     = "10.0.0.0/27"
}

variable "public_subnet_c_cidr" {
  type        = string
  default     = "10.0.0.32/27"
}

variable "private_subnet_a_cidr" {
  type        = string
  default     = "10.0.0.64/26"
}

variable "private_subnet_c_cidr" {
  type        = string
  default     = "10.0.0.128/26"
}

# -----------------------------------------------------------------------------
# EC2
# -----------------------------------------------------------------------------
variable "base_ami_id" {
  description = "Amazon Linux 2023"
  type        = string
  default     = "ami-0b818a04bc9c2133c"
}

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
  default     = "arn:aws:acm:ap-northeast-2:626614672806:certificate/84cc7d70-59c8-4ae6-91c3-3e2f14b028ea"
}

