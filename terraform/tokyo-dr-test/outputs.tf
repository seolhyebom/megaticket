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
# DR 안내 (Cold Standby)
# =============================================================================
output "instructions" {
  description = "DR 안내"
  value       = <<-EOT
    
    ============================================================
    도쿄 DR 리전 인프라 (Cold Standby) 준비 완료!
    ============================================================
    
    현재 비용 최적화를 위해 인스턴스는 0대로 설정되어 있습니다. (Desired=0)
    시스템을 가동하려면 다음 단계를 수행하세요:

    1. 도쿄 인전 ASG 용량 상향 (1대 이상):
       terraform apply -var="web_asg_desired=1" -var="app_asg_desired=1"

    2. 서비스 확인 (Web):
       http://${aws_lb.dr.dns_name}
    
    3. API 헬스체크 (App):
       http://${aws_lb.dr.dns_name}/api/health
    
    4. 외부 인증서 연동 (팀원 제공 시):
       타 팀원이 생성한 ACM 인증서가 'pilotlight-test.click'으로 존재해야 
       HTTPS(443) 접속이 가능합니다. (현재는 HTTP 80 권장)

    ============================================================
    주의: NAT Gateway 및 로드 밸런서는 상시 과금 리소스입니다.
    ============================================================
  EOT
}
