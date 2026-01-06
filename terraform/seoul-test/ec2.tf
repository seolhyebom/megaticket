# =============================================================================
# EC2 Instances with Auto Scaling - Seoul Test
# =============================================================================
# Web, App 인스턴스 모두 Private Subnet에 배치
# user_data를 통해 Git, Node.js, PM2 설치 → 소스 복제 → 빌드 → 서비스 시작 자동화
# =============================================================================

# -----------------------------------------------------------------------------
# Launch Template - Web (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "web" {
  name_prefix   = "${var.project_name}-Web-LT-"
  image_id      = var.base_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.web.id]

  # User Data - 전체 설치 및 서비스 시작 자동화 (외부 스크립트 파일 사용)
  user_data = base64encode(templatefile("${path.module}/user_data_web.sh", {
    github_repo  = var.github_repo
    aws_region   = var.aws_region
    nlb_dns_name = aws_lb.nlb.dns_name
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-Web"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Launch Template - App (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-App-LT-"
  image_id      = var.base_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # User Data - 전체 설치 및 서비스 시작 자동화 (외부 스크립트 파일 사용)
  user_data = base64encode(templatefile("${path.module}/user_data_app.sh", {
    project_name          = var.project_name
    aws_region            = var.aws_region
    dynamodb_table_prefix = var.dynamodb_table_prefix
    github_repo           = var.github_repo
  }))


  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-App"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - Web (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "web" {
  name                = "${var.project_name}-Web-ASG"
  min_size            = var.web_asg_min
  max_size            = var.web_asg_max
  desired_capacity    = var.web_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.web.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 600  # 빌드 시간 고려하여 10분

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-Web"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - App (Private Subnet)
# NLB TG만 연결 - ALB 직접 접근 차단 (Next.js rewrites로 프록시)
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-App-ASG"
  min_size            = var.app_asg_min
  max_size            = var.app_asg_max
  desired_capacity    = var.app_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.app_nlb.arn]  # NLB TG만 연결
  health_check_type   = "ELB"
  health_check_grace_period = 600  # 빌드 시간 고려하여 10분

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-App"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}
