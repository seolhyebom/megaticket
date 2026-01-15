# =============================================================================
# 변수 값 설정 - Singapore Main Region (V3.0 PLCR)
# =============================================================================
# ⚠️ 이 파일은 .gitignore에 추가하세요!
# =============================================================================

project_name = "plcr"
region_code  = "aps1"
environment  = "prod"
aws_region   = "ap-southeast-1"

# VPC CIDR (10.1.0.0/24 사용 - V3.0, 싱가포르 Main Region)
vpc_cidr              = "10.1.0.0/24"
public_subnet_a_cidr  = "10.1.0.0/27"   # 10.1.0.0 ~ 10.1.0.31
public_subnet_b_cidr  = "10.1.0.32/27"  # 10.1.0.32 ~ 10.1.0.63
private_subnet_a_cidr = "10.1.0.64/26"  # 10.1.0.64 ~ 10.1.0.127
private_subnet_b_cidr = "10.1.0.128/26" # 10.1.0.128 ~ 10.1.0.191
# 여유 CIDR (확장용 Reserved): 10.1.0.192/26 (10.1.0.192 ~ 10.1.0.255)

# EC2 - AMI는 data source로 자동 조회
instance_type = "t2.medium"

# Auto Scaling
app_asg_min     = 1
app_asg_max     = 4
app_asg_desired = 1

# DynamoDB (싱가포르에 수동 생성 완료)
# dynamodb_table_prefix = "plcr-gtbl"

dynamodb_table_prefix = "MegaTicket-Hybrid"

# 도메인
domain_name = "pilotlight-test.click"

# ACM 인증서 (싱가포르)
acm_certificate_arn = "arn:aws:acm:ap-southeast-1:626614672806:certificate/a86d20fa-75d0-4e62-ac17-3974fcc6f767"

# GitHub 레포지토리
github_repo = "https://github.com/seolhyebom/megaticket.git"
