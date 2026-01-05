# =============================================================================
# EC2 Instances with Auto Scaling - DR Tokyo
# =============================================================================
# GoldenAMI 사용 - user_data는 환경변수 변경 및 PM2 재시작만 수행
# Web, App 모두 Private Subnet에 배치
# =============================================================================

# -----------------------------------------------------------------------------
# Launch Template - Web (Private Subnet, GoldenAMI 사용)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "web" {
  name_prefix   = "${var.project_name}-DR-Web-LT-"
  image_id      = var.web_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.web.id]

  # User Data - DR 환경변수 설정 및 PM2 재시작
  # GoldenAMI에는 이미 모든 소프트웨어가 설치되어 있음
  # Web User Data (Golden AMI용 - 환경변수 설정 및 재시작)
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    exec > >(tee /var/log/user-data.log) 2>&1
    echo "=== DR Web User Data Started: $(date) ==="
    
    # 환경변수 파일 생성
    cat > /home/ec2-user/megaticket/apps/web/.env.local << 'ENVEOF'
    AWS_REGION=${var.aws_region}
    NEXT_PUBLIC_AWS_REGION=${var.aws_region}
    INTERNAL_API_URL=http://${aws_lb.nlb.dns_name}:3001
    ENVEOF
    
    
    # PM2 restart with explicit environment variables (No Rebuild needed)
    echo "=== Restarting Web Service with Explicit Env Vars ==="
    # 1. 기존 프로세스 삭제 (환경변수 클린 적용)
    sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 delete web-frontend || true'
    # 2. 환경변수와 함께 시작 (Runtime override - API 및 Next.js Runtime Config에 적용됨)
    sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/web && AWS_REGION=${var.aws_region} INTERNAL_API_URL=http://${aws_lb.nlb.dns_name}:3001 pm2 start npm --name \"web-frontend\" -- start"
    
    echo "=== DR Web User Data Completed: $(date) ==="
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-DR-Web"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# Launch Template - App (Private Subnet, GoldenAMI 사용)
# -----------------------------------------------------------------------------
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-DR-App-LT-"
  image_id      = var.app_ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # App User Data (Golden AMI용 - 환경변수 설정 및 재시작)
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    exec > >(tee /var/log/user-data.log) 2>&1
    echo "=== DR App User Data Started: $(date) ==="
    
    # 환경변수 파일 생성
    cat > /home/ec2-user/megaticket/apps/app/.env << 'ENVEOF'
    AWS_REGION=${var.aws_region}
    PORT=3001
    DYNAMODB_RESERVATIONS_TABLE=${var.dynamodb_table_prefix}-reservations
    DYNAMODB_PERFORMANCES_TABLE=${var.dynamodb_table_prefix}-performances
    DYNAMODB_VENUES_TABLE=${var.dynamodb_table_prefix}-venues
    DYNAMODB_SCHEDULES_TABLE=${var.dynamodb_table_prefix}-schedules
    DR_RECOVERY_MODE=true
    ENVEOF
    
    chown ec2-user:ec2-user /home/ec2-user/megaticket/apps/app/.env
    
    # PM2 restart with environment update (환경변수 명시적 전달)
    sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 delete app-backend || true'
    sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/app && AWS_REGION=${var.aws_region} DYNAMODB_RESERVATIONS_TABLE=${var.dynamodb_table_prefix}-reservations DYNAMODB_PERFORMANCES_TABLE=${var.dynamodb_table_prefix}-performances DYNAMODB_VENUES_TABLE=${var.dynamodb_table_prefix}-venues DYNAMODB_SCHEDULES_TABLE=${var.dynamodb_table_prefix}-schedules DR_RECOVERY_MODE=true pm2 start npm --name \"app-backend\" -- start"
    
    echo "=== DR App User Data Completed: $(date) ==="
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-DR-App"
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
# -----------------------------------------------------------------------------
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-DR-App-ASG"
  min_size            = var.app_asg_min
  max_size            = var.app_asg_max
  desired_capacity    = var.app_asg_desired
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  target_group_arns   = [aws_lb_target_group.app.arn, aws_lb_target_group.app_nlb.arn]
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
