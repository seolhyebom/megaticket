# =============================================================================
# Route 53 Failover - DR Tokyo
# =============================================================================
# 서울(Primary) ↔ 도쿄(Secondary) Failover 설정
# Health Check 실패 시 자동으로 도쿄로 트래픽 전환
# =============================================================================

# Route 53은 글로벌 서비스이므로 us-east-1 provider 사용
provider "aws" {
  alias   = "global"
  region  = "us-east-1"
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
# 변수 추가 (variables.tf에 추가 필요)
# -----------------------------------------------------------------------------
variable "seoul_alb_dns" {
  description = "서울 리전 ALB DNS 이름"
  type        = string
  default     = ""  # terraform.tfvars에서 설정
}

variable "seoul_alb_zone_id" {
  description = "서울 리전 ALB Hosted Zone ID"
  type        = string
  default     = ""  # terraform.tfvars에서 설정
}

variable "route53_zone_id" {
  description = "Route 53 Hosted Zone ID"
  type        = string
  default     = ""  # terraform.tfvars에서 설정
}

# -----------------------------------------------------------------------------
# Route 53 Health Check - 서울 ALB
# -----------------------------------------------------------------------------
resource "aws_route53_health_check" "seoul_primary" {
  provider = aws.global
  count    = var.seoul_alb_dns != "" ? 1 : 0

  fqdn              = var.seoul_alb_dns
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name = "${var.project_name}-Seoul-Health-Check"
  }
}

# -----------------------------------------------------------------------------
# Data Source - Route 53 Zone Lookup
# -----------------------------------------------------------------------------
data "aws_route53_zone" "selected" {
  provider     = aws.global
  name         = var.domain_name
  private_zone = false
}

# -----------------------------------------------------------------------------
# Route 53 Failover Records
# -----------------------------------------------------------------------------

# Primary Record - 서울 ALB (Seoul Terraform에서 관리함)
resource "aws_route53_record" "primary" {
  provider = aws.global
  count    = 0 # Seoul Terraform에서 관리하므로 여기서는 생성 안 함

  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.domain_name
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary-seoul"
  health_check_id = aws_route53_health_check.seoul_primary[0].id

  alias {
    name                   = var.seoul_alb_dns
    zone_id                = var.seoul_alb_zone_id
    evaluate_target_health = true
  }
}

# Secondary Record - 도쿄 ALB (Failover 대상)
resource "aws_route53_record" "secondary" {
  provider = aws.global
  count    = 1 # Always create for DR

  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.domain_name
  type    = "A"

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier = "secondary-tokyo"

  alias {
    name                   = aws_lb.dr.dns_name
    zone_id                = aws_lb.dr.zone_id
    evaluate_target_health = true
  }
}

# -----------------------------------------------------------------------------
# Output - Route 53 설정 안내
# -----------------------------------------------------------------------------
output "route53_failover_status" {
  value = var.route53_zone_id != "" ? "Failover configured" : <<EOT

============================================================
⚠️ Route 53 Failover 설정 필요
============================================================

terraform.tfvars에 다음 값을 추가하세요:

# Route 53 Failover 설정
route53_zone_id   = "Z0853952ATBTQYQZAMMXB"  # pilotlight-test.click Zone ID
seoul_alb_dns     = "your-seoul-alb.ap-northeast-2.elb.amazonaws.com"
seoul_alb_zone_id = "ZWKZPGTI48KDX"  # 서울 리전 ALB Zone ID

============================================================
EOT
}
