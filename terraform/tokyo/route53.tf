# =============================================================================
# Route53 Failover Routing - Tokyo DR Region (Secondary)
# =============================================================================

# -----------------------------------------------------------------------------
# Secondary Failover Record (No Health Check)
# -----------------------------------------------------------------------------
# resource "aws_route53_record" "api_secondary" {
#  zone_id = var.route53_zone_id
#  name    = "api.megaticket.click"
#  type    = "A"
#
#  failover_routing_policy {
#    type = "SECONDARY"
#  }
#
#  set_identifier = "${var.project_name}-api-${var.region_code}-secondary"
#
#  alias {
#    name                   = aws_lb.dr.dns_name
#    zone_id                = aws_lb.dr.zone_id
#    evaluate_target_health = true
#  }
#}

