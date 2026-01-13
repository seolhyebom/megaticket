# =============================================================================
# Outputs - Seoul Main Region (V3.0)
# =============================================================================

output "vpc_id" {
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  value       = aws_lb.main.dns_name
}

output "app_asg_name" {
  value       = aws_autoscaling_group.app.name
}

output "app_target_group_arn" {
  value       = aws_lb_target_group.app.arn
}

output "private_subnet_ids" {
  value       = [aws_subnet.private_a.id, aws_subnet.private_c.id]
}

output "public_subnet_ids" {
  value       = [aws_subnet.public_a.id, aws_subnet.public_c.id]
}

output "ec2_iam_role_arn" {
  value       = aws_iam_role.ec2_role.arn
}

output "app_security_group_id" {
  value       = aws_security_group.app.id
}