# =============================================================================
# EC2 Instances with Auto Scaling - Singapore Main Region (V3.0)
# =============================================================================
# Web: S3 정적 호스팅으로 이전 (EC2 제거)
# App: ASG + ALB Target Group 연결
# =============================================================================

# -----------------------------------------------------------------------------
# AMI 자동 조회 (Amazon Linux 2023)
# -----------------------------------------------------------------------------
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-6.1-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# -----------------------------------------------------------------------------
# Launch Template - App (Private Subnet)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-lt-${var.region_code}-app-"
  image_id      = data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # User Data - App 서버 초기화, 서비스 시작
  user_data = base64encode(templatefile("${path.module}/user_data_app.sh", {
    project_name          = var.project_name
    aws_region            = var.aws_region
    dynamodb_table_prefix = var.dynamodb_table_prefix
    github_repo           = var.github_repo
  }))

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
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling Group - App (Private Subnet)
# ALB Target Group 연결
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-asg-${var.region_code}-app"
  min_size            = var.app_asg_min
  max_size            = var.app_asg_max
  desired_capacity    = var.app_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  target_group_arns   = [aws_lb_target_group.app.arn]
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
    create_before_destroy = true
  }
}
