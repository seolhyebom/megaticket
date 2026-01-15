# =============================================================================
# Security Groups - Singapore Main Region (V3.0)
# =============================================================================
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_prefix_list" "s3" {
  prefix_list_id = aws_vpc_endpoint.s3.prefix_list_id
}

# --------------------------------------------------------------------------------
# Security Groups Definitions
# --------------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-sg-${var.region_code}-alb"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-sg-${var.region_code}-alb"
  }
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg-${var.region_code}-app"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-sg-${var.region_code}-app"
    Tier = "app"
  }
}

resource "aws_security_group" "vpce" {
  name        = "${var.project_name}-sg-${var.region_code}-vpce"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-sg-${var.region_code}-vpce"
  }
}

# --------------------------------------------------------------------------------
# Security Group Rules
# --------------------------------------------------------------------------------
# ALB Rules
resource "aws_security_group_rule" "alb_ingress_http_cloudfront" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  prefix_list_ids   = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_ingress_https_cloudfront" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  prefix_list_ids   = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  security_group_id = aws_security_group.alb.id
}

resource "aws_security_group_rule" "alb_egress_app" {
  type                     = "egress"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  security_group_id        = aws_security_group.alb.id
}

# App EC2 Rules
resource "aws_security_group_rule" "app_ingress_alb" {
  type                     = "ingress"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.app.id
}

resource "aws_security_group_rule" "app_egress_ssm" {
  type                     = "egress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.vpce.id
  security_group_id        = aws_security_group.app.id
}

resource "aws_security_group_rule" "app_egress_s3" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  prefix_list_ids   = [aws_vpc_endpoint.s3.prefix_list_id]
  security_group_id = aws_security_group.app.id
}

resource "aws_security_group_rule" "app_egress_https" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.app.id
}

resource "aws_security_group_rule" "app_egress_http" {
  type              = "egress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.app.id
}

# VPCE Rules
resource "aws_security_group_rule" "vpce_ingress_app" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  security_group_id        = aws_security_group.vpce.id
}
