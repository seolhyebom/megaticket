# =============================================================================
# Route 53 - Seoul (Failover PRIMARY)
# =============================================================================

# -----------------------------------------------------------------------------
# Health Check for ALB
# -----------------------------------------------------------------------------
resource "aws_route53_health_check" "main" {
  fqdn              = aws_lb.main.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name = "${var.project_name}-Seoul-HealthCheck"
  }
}

# -----------------------------------------------------------------------------
# A Record - Failover PRIMARY (도쿄 SECONDARY와 쌍으로 동작)
# -----------------------------------------------------------------------------
resource "aws_route53_record" "main" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "seoul-primary"
  health_check_id = aws_route53_health_check.main.id

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
