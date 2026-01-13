# =============================================================================
# Route53 Failover Routing - Seoul Main Region (Primary)
# =============================================================================

# -----------------------------------------------------------------------------
# Health Check for ALB
# -----------------------------------------------------------------------------
resource "aws_route53_health_check" "api" {
  fqdn              = aws_lb.main.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name        = "${var.project_name}-r53-${var.region_code}-api"
  }
}

# -----------------------------------------------------------------------------
# Primary Failover Record
# -----------------------------------------------------------------------------
resource "aws_route53_record" "api_primary" {
  zone_id = var.route53_zone_id
  name    = "api.megaticket.click"
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "${var.project_name}-api${var.region_code}-primary"
  health_check_id = aws_route53_health_check.api.id

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
