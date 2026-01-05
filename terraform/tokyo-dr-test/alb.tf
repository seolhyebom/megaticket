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
# Target Group - App (Port 3001)
# -----------------------------------------------------------------------------
resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-DR-App-TG"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.dr.id

  health_check {
    path                = "/api/health"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-DR-App-TG"
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
# ALB Listener - HTTPS (Port 443)
# -----------------------------------------------------------------------------
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.dr.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  depends_on = [aws_acm_certificate_validation.main]
}

# -----------------------------------------------------------------------------
# ALB Listener Rule - API 요청은 App Target Group으로 전달
# -----------------------------------------------------------------------------
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
