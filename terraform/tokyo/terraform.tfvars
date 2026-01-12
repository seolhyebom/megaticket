# =============================================================================
# 변수 값 설정 - Tokyo DR Region (V3.0 PLCR)
# =============================================================================
# ⚠️ 이 파일은 .gitignore에 추가하세요!
# =============================================================================

project_name = "plcr"
region_code  = "an1"
environment  = "dr"
aws_region   = "ap-northeast-1"
aws_profile  = "default"

# VPC CIDR (10.0.1.0/24 사용 - V3.0 확정, 도쿄 DR Region)
vpc_cidr              = "10.0.1.0/24"
public_subnet_a_cidr  = "10.0.1.0/27"   # 10.0.1.0 ~ 10.0.1.31
public_subnet_c_cidr  = "10.0.1.32/27"  # 10.0.1.32 ~ 10.0.1.63
private_subnet_a_cidr = "10.0.1.64/26"  # 10.0.1.64 ~ 10.0.1.127
private_subnet_c_cidr = "10.0.1.128/26" # 10.0.1.128 ~ 10.0.1.191
# [참고] 여유 CIDR (확장용 Reserved): 10.0.1.192/26 (10.0.1.192 ~ 10.0.1.255)

# EC2 설정 (도쿄 리전)
key_pair_name = "seungwan_tokyo"
instance_type = "t2.medium"
base_ami_id   = "ami-095b23fbc6a272c40"  # 도쿄 복사 Golden AMI (테스트용)

# Auto Scaling (Pilot Light - 평시 0, DR 시 scale up)
app_asg_min     = 1
app_asg_max     = 1
app_asg_desired = 1

# DynamoDB (참조용 - Global Table은 서울에서 관리)
dynamodb_table_prefix = "KDT-Msp4-PLDR"

# 도메인
domain_name = "megaticket.click"
