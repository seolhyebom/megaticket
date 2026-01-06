# =============================================================================
# Application Load Balancer - DR Tokyo
# =============================================================================

# -----------------------------------------------------------------------------
# ALB (Public Subnet에 배치)
# -----------------------------------------------------------------------------
resource "aws_lb" "dr" {
  name               = "${var.project_name}-DR-ALB"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_c.id]

  tags = {
    Name = "${var.project_name}-DR-ALB"
  }
}

# -----------------------------------------------------------------------------
# Target Group - Web (Port 3000)
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "web" {
  name     = "${var.project_name}-DR-Web-TG"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.dr.id

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
    matcher             = "200-399"
  }

  tags = {
    Name = "${var.project_name}-DR-Web-TG"
  }
}

# -----------------------------------------------------------------------------
# ALB Listener - HTTP (Port 80)
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.dr.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Source - ACM (외부에서 생성된 인증서 검색)
# -----------------------------------------------------------------------------
data "aws_acm_certificate" "issued" {
  domain   = var.domain_name
  statuses = ["ISSUED"]
  most_recent = true
}

# -----------------------------------------------------------------------------
# ALB Listener - HTTPS (Port 443)
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.dr.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = data.aws_acm_certificate.issued.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
