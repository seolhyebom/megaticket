# =============================================================================
# Outputs - DR Tokyo
# =============================================================================

output "vpc_id" {
  description = "DR VPC ID"
  value       = aws_vpc.dr.id
}

output "alb_dns_name" {
  description = "DR ALB DNS Name"
  value       = aws_lb.dr.dns_name
}

output "nlb_dns_name" {
  description = "DR NLB DNS Name"
  value       = aws_lb.nlb.dns_name
}

output "web_asg_name" {
  description = "DR Web Auto Scaling Group Name"
  value       = aws_autoscaling_group.web.name
}

output "app_asg_name" {
  description = "DR App Auto Scaling Group Name"
  value       = aws_autoscaling_group.app.name
}

output "private_subnet_ids" {
  description = "DR Private Subnet IDs"
  value       = [aws_subnet.private_a.id, aws_subnet.private_c.id]
}

output "public_subnet_ids" {
  description = "DR Public Subnet IDs"
  value       = [aws_subnet.public_a.id, aws_subnet.public_c.id]
}

# =============================================================================
# DR 테스트 안내
# =============================================================================
output "instructions" {
  description = "DR 테스트 안내"
  value       = <<-EOT
    
    ============================================================
    도쿄 DR 리전 인프라가 생성되었습니다!
    ============================================================
    
    1. DR ALB DNS로 접속하여 서비스 동작 확인:
       http://${aws_lb.dr.dns_name}
    
    2. API 헬스체크:
       http://${aws_lb.dr.dns_name}/api/health
    
    3. NLB DNS로 직접 API 접근:
       http://${aws_lb.nlb.dns_name}:3001
    
    4. 인스턴스 상태 확인 (SSM으로 접속):
       - pm2 list
       - pm2 logs
       - echo $AWS_REGION (ap-northeast-1 확인)
       - echo $DR_RECOVERY_MODE (true 확인)
    
    5. DynamoDB Global Table 데이터 확인:
       - 서울에서 입력한 데이터가 도쿄에서도 조회되는지 확인
    
    6. 테스트 완료 후 리소스 정리:
       terraform destroy
    
    ============================================================
    주의: NAT Gateway는 시간당 과금됩니다. 테스트 후 반드시 destroy!
    ============================================================
  EOT
}
