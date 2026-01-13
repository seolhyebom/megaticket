# =============================================================================
# 변수 값 설정 - Seoul Main Region (V3.0 PLCR)
# =============================================================================
# ⚠️ 이 파일은 .gitignore에 추가하세요!
# =============================================================================

project_name = "plcr"
region_code  = "an2"
environment  = "prod"
aws_region   = "ap-northeast-2"

# VPC CIDR (10.0.0.0/24 사용 - V3.0 확정, 서울 Main Region)
vpc_cidr              = "10.0.0.0/24"
public_subnet_a_cidr  = "10.0.0.0/27"   # 10.0.0.0 ~ 10.0.0.31
public_subnet_c_cidr  = "10.0.0.32/27"  # 10.0.0.32 ~ 10.0.0.63
private_subnet_a_cidr = "10.0.0.64/26"  # 10.0.0.64 ~ 10.0.0.127
private_subnet_c_cidr = "10.0.0.128/26" # 10.0.0.128 ~ 10.0.0.191
# 여유 CIDR (확장용 Reserved): 10.0.0.192/26 (10.0.0.192 ~ 10.0.0.255)

# EC2
base_ami_id   = "ami-0b818a04bc9c2133c"  # Amazon Linux 2023
instance_type = "t2.medium"

# Auto Scaling
app_asg_min     = 1
app_asg_max     = 4
app_asg_desired = 1

# DynamoDB
dynamodb_table_prefix = "plcr-gtbl"

# 도메인
domain_name = "megaticket.click"

# GitHub 레포지토리
github_repo = "https://github.com/seolhyebom/megaticket.git"