# =============================================================================
# Outputs - Tokyo DR Region (V3.0)
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.dr.id
}

output "alb_dns_name" {
  description = "ALB DNS Name"
  value       = aws_lb.dr.dns_name
}

output "app_asg_name" {
  description = "App Auto Scaling Group Name"
  value       = aws_autoscaling_group.app.name
}

output "app_target_group_arn" {
  description = "App Target Group ARN"
  value       = aws_lb_target_group.app.arn
}

output "private_subnet_ids" {
  description = "Private Subnet IDs"
  value       = [aws_subnet.private_a.id, aws_subnet.private_c.id]
}

output "public_subnet_ids" {
  description = "Public Subnet IDs"
  value       = [aws_subnet.public_a.id, aws_subnet.public_c.id]
}

output "ec2_iam_role_arn" {
  description = "EC2 IAM Role ARN"
  value       = aws_iam_role.ec2_role.arn
}

output "app_security_group_id" {
  description = "App Security Group ID"
  value       = aws_security_group.app.id
}

# =============================================================================
# V3.0 DR 배포 후 확인용 정보
# =============================================================================
output "instructions" {
  description = "다음 단계 안내"
  value       = <<-EOT
    
    ============================================================
    도쿄 DR 리전 인프라 (V3.0 Pilot Light) 배포 완료!
    ============================================================
    
    현재 상태: App ASG desired=${var.app_asg_desired} (Pilot Light)
    
    1. DR 활성화 시:
       terraform apply -var="app_asg_desired=2"
    
    2. ALB DNS로 API 헬스체크:
       https://${aws_lb.dr.dns_name}/api/health
    
    3. S3 정적 호스팅 DR:
       - S3 CRR로 서울 → 도쿄 자동 복제
    
    ============================================================
    PLCR Naming: ${var.project_name}-*-${var.region_code}
    ============================================================
  EOT
}
