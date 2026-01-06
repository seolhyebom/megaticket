# =============================================================================
# NLB Target Group - DR Tokyo
# =============================================================================
# NLB 자체는 Step Function이 생성하지만, Target Group과 ASG 연결은 Terraform에서 관리합니다.
# Step Function은 생성한 NLB Listener를 이 Target Group에 연결하기만 하면 됩니다.

resource "aws_lb_target_group" "app_nlb" {
  name        = "${var.project_name}-DR-App-NLB-TG"
  port        = 3001
  protocol    = "TCP"
  vpc_id      = aws_vpc.dr.id
  target_type = "instance"

  health_check {
    enabled             = true
    protocol            = "TCP"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    interval            = 30
  }

  tags = {
    Name = "${var.project_name}-DR-App-NLB-TG"
    Environment = "DR"
  }
}

output "nlb_target_group_arn" {
  value = aws_lb_target_group.app_nlb.arn
}
