# =============================================================================
# EC2 Instances with Auto Scaling - Tokyo DR Region (V3.0)
# =============================================================================
# Web: S3 정적 호스팅으로 이전
# App: ASG + ALB Target Group 연결 (Pilot Light: desired=0)
# Golden AMI 사용 (빌드 스킵) - 서울에서 복사된 AMI
# =============================================================================

# -----------------------------------------------------------------------------
# Launch Template - App (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-lt-${var.region_code}-app-"
  image_id      = var.base_ami_id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # User Data - S3에서 app.zip 다운로드 (GitHub Actions 빌드 아티팩트)
  user_data = base64encode(file("${path.module}/user_data_dr_tokyo.sh"))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name   = "${var.project_name}-app-${var.region_code}"
      Tier   = "app"
      Backup = "true"
    }
  }

  lifecycle {
    create_before_destroy = true
    # ignore_changes = [image_id]  # 테스트 단계: Terraform으로 AMI 변경 적용
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - App (Private Subnet, Pilot Light)
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-asg-${var.region_code}-app"
  min_size            = var.app_asg_min
  max_size            = var.app_asg_max
  desired_capacity    = var.app_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = []
  health_check_type   = "ELB"
  health_check_grace_period = 600

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 300
    }
    triggers = ["launch_template"]
  }

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  dynamic "tag" {
    for_each = merge(
      {
        Name = "${var.project_name}-app-${var.region_code}"
        Tier = "app"
      }
    )
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    ignore_changes = [
      desired_capacity,
      min_size,
      max_size,
      target_group_arns,
      load_balancers
    ]
  }
}
