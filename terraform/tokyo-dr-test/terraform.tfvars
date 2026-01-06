# =============================================================================
# 변수 값 설정 - DR Tokyo (GoldenAMI 사용)
# =============================================================================
# ⚠️ 이 파일은 .gitignore에 추가하세요!
# =============================================================================

project_name = "MegaTicket"
environment  = "test"
aws_region   = "ap-northeast-1"  # 도쿄 리전
aws_profile  = "default"

# VPC CIDR (서울과 다른 CIDR, 서브넷 크기는 동일)
vpc_cidr              = "10.1.0.0/16"
public_subnet_a_cidr  = "10.1.0.0/26"    # 64 IPs
public_subnet_c_cidr  = "10.1.0.64/26"   # 64 IPs
private_subnet_a_cidr = "10.1.16.0/20"   # 4096 IPs
private_subnet_c_cidr = "10.1.32.0/20"   # 4096 IPs

# EC2 설정 (도쿄 리전)
key_pair_name = "seungwan_tokyo"
instance_type = "t2.medium"

# ⚠️ AMI는 Step Function에서 관리 - 테라폼에서 관리하지 않음

# Auto Scaling (Desired 0 - Cold Standby)
web_asg_min     = 0
web_asg_max     = 0
web_asg_desired = 0

app_asg_min     = 0
app_asg_max     = 0
app_asg_desired = 0

# DynamoDB (참조용 - Global Table은 서울에서 관리)
dynamodb_table_prefix = "KDT-Msp4-PLDR"

# 도메인
domain_name = "pilotlight-test.click"


