# ssm.tf

resource "aws_ssm_parameter" "vpc_id" {
  name  = "/plcr/dr/vpc_id"
  type  = "String"
  value = aws_vpc.dr.id
}

resource "aws_ssm_parameter" "public_subnet_ids" {
  name  = "/plcr/dr/public_subnet_ids"
  type  = "StringList"
  value = join(",", [aws_subnet.public_a.id, aws_subnet.public_c.id])
}

resource "aws_ssm_parameter" "private_rt_ids" {
  name  = "/plcr/dr/private_route_table_ids"
  type  = "String"
  value = aws_route_table.private.id
}

resource "aws_ssm_parameter" "asg_name" {
  name  = "/plcr/dr/asg_name"
  type  = "String"
  value = aws_autoscaling_group.app.name
}

resource "aws_ssm_parameter" "alb_sg_id" {
  name  = "/plcr/dr/alb_security_group_id"
  type  = "String"
  value = aws_security_group.alb.id
}