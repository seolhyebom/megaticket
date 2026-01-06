# =============================================================================
# EC2 Instances with Auto Scaling - DR Tokyo
# =============================================================================
# GoldenAMI 사용 - user_data는 환경변수 변경 및 PM2 재시작만 수행
# Web, App 모두 Private Subnet에 배치
# ⚠️ AMI는 Step Function에서 관리 - image_id는 Step Function이 LT 업데이트 시 주입
# =============================================================================

# -----------------------------------------------------------------------------
# Launch Template - Web (Private Subnet, GoldenAMI 사용)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "web" {
  name_prefix   = "${var.project_name}-DR-Web-LT-"
  # image_id는 Step Function에서 LT 업데이트 시 주입
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.web.id]

  # User Data - DR 환경변수 설정 및 PM2 재시작
  # GoldenAMI에는 이미 모든 소프트웨어가 설치되어 있음
  # Web User Data (Golden AMI용 - 환경변수 설정 및 재시작)
  user_data = base64encode(templatefile("${path.module}/user_data_web.sh", {
    aws_region       = var.aws_region
    internal_api_url = "http://${aws_lb.nlb.dns_name}:3001"
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-DR-Web"
    }
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [image_id]  # Step Function이 관리
  }
}

# -----------------------------------------------------------------------------
# Launch Template - App (Private Subnet, GoldenAMI 사용)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-DR-App-LT-"
  # image_id는 Step Function에서 LT 업데이트 시 주입
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # App User Data (Golden AMI용 - 환경변수 설정 및 재시작)
  user_data = base64encode(templatefile("${path.module}/user_data_app.sh", {
    aws_region            = var.aws_region
    dynamodb_table_prefix = var.dynamodb_table_prefix
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-DR-App"
    }
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [image_id]  # Step Function이 관리
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - Web (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "web" {
  name                = "${var.project_name}-DR-Web-ASG"
  min_size            = var.web_asg_min
  max_size            = var.web_asg_max
  desired_capacity    = var.web_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.web.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300  # GoldenAMI 사용으로 빌드 불필요, 5분

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-DR-Web"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - App (Private Subnet)
# NLB TG만 연결 - ALB 직접 접근 차단
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-DR-App-ASG"
  min_size            = var.app_asg_min
  max_size            = var.app_asg_max
  desired_capacity    = var.app_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.app_nlb.arn]  # NLB TG만 연결
  health_check_type   = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-DR-App"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}
