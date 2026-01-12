# =============================================================================
# Security Groups - Seoul Main Region (V3.0)
# =============================================================================
# Web SG 제거 (S3로 이전)
# ALB SG → App SG 직접 연결
# =============================================================================

# -----------------------------------------------------------------------------
# ALB Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-sg-alb-${var.region_code}"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress는 모든 아웃바운드 허용 (순환 참조 방지)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg-alb-${var.region_code}"
  }
}

# -----------------------------------------------------------------------------
# App Instance Security Group (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg-app-${var.region_code}"
  description = "Security group for App instances"
  vpc_id      = aws_vpc.main.id

  # ALB에서 오는 API 요청
  ingress {
    description     = "API Port from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # SSM Session Manager 및 아웃바운드 (HTTPS, DynamoDB 등)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg-app-${var.region_code}"
    Tier = "app"
  }
}
