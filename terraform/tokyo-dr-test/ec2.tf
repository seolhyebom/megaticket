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
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    
    # 로그 파일 설정
    exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
    echo "=== DR User Data Script Started: $(date) ==="
    
    USER_HOME=/home/ec2-user
    
    # 1. DR 리전 환경변수 설정 (.bashrc에 추가)
    echo "=== Setting DR Environment Variables ==="
    sudo -u ec2-user bash -c "echo 'export AWS_REGION=${var.aws_region}' >> $USER_HOME/.bashrc"
    sudo -u ec2-user bash -c "echo 'export NEXT_PUBLIC_AWS_REGION=${var.aws_region}' >> $USER_HOME/.bashrc"
    sudo -u ec2-user bash -c "echo 'export INTERNAL_API_URL=https://${var.domain_name}' >> $USER_HOME/.bashrc"
    sudo -u ec2-user bash -c "echo 'export DR_RECOVERY_MODE=true' >> $USER_HOME/.bashrc"
    
    # 2. .env.local 파일 수정 (도쿄 리전으로 변경)
    echo "=== Updating .env.local ==="
    cd $USER_HOME/megaticket/apps/web
    if [ -f .env.local ]; then
        sed -i 's/ap-northeast-2/ap-northeast-1/g' .env.local
        grep -q "DR_RECOVERY_MODE" .env.local || echo "DR_RECOVERY_MODE=true" >> .env.local
    fi
    
    # 3. PM2 권한 수정 (필요시)
    sudo chown -R ec2-user:ec2-user $USER_HOME/.pm2 2>/dev/null || true
    
    # 4. PM2 환경변수 업데이트 및 재시작 (Host Binding 강제 적용)
    echo "=== Restarting PM2 with DR Environment ==="
    sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && export AWS_REGION=${var.aws_region} && export NEXT_PUBLIC_AWS_REGION=${var.aws_region} && export DR_RECOVERY_MODE=true && cd $HOME/megaticket/apps/web && pm2 delete web-frontend 2>/dev/null || true && pm2 start npm --name "web-frontend" -- start -- -H 0.0.0.0 -p 3000 && pm2 save'
    
    echo "=== DR User Data Script Completed: $(date) ==="
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

  # User Data - DR 환경변수 설정 및 PM2 재시작
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    
    # 로그 파일 설정
    exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
    echo "=== DR User Data Script Started: $(date) ==="
    
    USER_HOME=/home/ec2-user
    
    # 1. DR 리전 환경변수 설정 (.bashrc에 추가)
    echo "=== Setting DR Environment Variables ==="
    sudo -u ec2-user bash -c "echo 'export AWS_REGION=${var.aws_region}' >> $USER_HOME/.bashrc"
    sudo -u ec2-user bash -c "echo 'export DR_RECOVERY_MODE=true' >> $USER_HOME/.bashrc"
    
    # 2. PM2 권한 수정 (필요시)
    sudo chown -R ec2-user:ec2-user $USER_HOME/.pm2 2>/dev/null || true
    
    # 3. PM2 환경변수 업데이트 및 재시작 (Host Binding 강제 적용)
    echo "=== Restarting PM2 with DR Environment ==="
    sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && export AWS_REGION=${var.aws_region} && export DR_RECOVERY_MODE=true && cd $HOME/megaticket/apps/app && pm2 delete app-backend 2>/dev/null || true && pm2 start npm --name "app-backend" -- start -- -H 0.0.0.0 -p 3001 && pm2 save'
    
    echo "=== DR User Data Script Completed: $(date) ==="
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
