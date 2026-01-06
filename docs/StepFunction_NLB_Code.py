# =============================================================================
# Step Function용 도쿄 DR NLB 생성 Lambda 코드
# =============================================================================
# 이 코드는 Step Function에서 DR Failover 시 NLB를 동적으로 생성합니다.
# Terraform 수정 반영:
# - Target Group, ASG 연결은 Terraform에서 관리
# - Step Function은 NLB 생성 및 Listener 연결만 담당
# =============================================================================

import boto3
import json
import time

# 환경 변수 또는 상수
REGION = "ap-northeast-1"  # 도쿄 리전
PROJECT_NAME = "MegaTicket"

# VPC/Subnet 정보 (Terraform outputs 또는 SSM Parameter Store에서 가져오기)
# 실제 배포 시 환경변수나 SSM Parameter Store에서 조회
VPC_ID = "vpc-05a716c5ee53cba93"  # terraform output vpc_id 값
PRIVATE_SUBNET_IDS = [
    "subnet-03d8408e49d75609c",  # private_a
    "subnet-0c9e18a2a46d21235"   # private_c
]


def create_nlb(event, context):
    """
    Step Function에서 호출되는 NLB 생성 Lambda 함수
    
    Returns:
        dict: NLB 정보 (dns_name, arn, target_group_arn)
    """
    elbv2 = boto3.client("elbv2", region_name=REGION)
    ssm = boto3.client("ssm", region_name=REGION)
    
    nlb_name = f"{PROJECT_NAME}-DR-NLB"
    tg_name = f"{PROJECT_NAME}-DR-App-NLB-TG"
    
    try:
        # 1. NLB 생성
        print(f"Creating NLB: {nlb_name}")
        nlb_response = elbv2.create_load_balancer(
            Name=nlb_name,
            Subnets=PRIVATE_SUBNET_IDS,
            Scheme="internal",  # Private NLB
            Type="network",
            IpAddressType="ipv4",
            Tags=[
                {"Key": "Name", "Value": nlb_name},
                {"Key": "Environment", "Value": "DR"},
                {"Key": "ManagedBy", "Value": "StepFunction"}
            ]
        )
        nlb_arn = nlb_response["LoadBalancers"][0]["LoadBalancerArn"]
        nlb_dns = nlb_response["LoadBalancers"][0]["DNSName"]
        print(f"NLB created: {nlb_dns}")
        
        # 2. Cross-zone load balancing 활성화
        elbv2.modify_load_balancer_attributes(
            LoadBalancerArn=nlb_arn,
            Attributes=[
                {"Key": "load_balancing.cross_zone.enabled", "Value": "true"}
            ]
        )
        
        # 3. Target Group 조회 (Terraform에서 이미 생성됨)
        print(f"Retrieving Target Group ARN: {tg_name}")
        tg_response = elbv2.describe_target_groups(
            Names=[tg_name]
        )
        if not tg_response["TargetGroups"]:
            raise ValueError(f"Target Group not found: {tg_name}")
            
        tg_arn = tg_response["TargetGroups"][0]["TargetGroupArn"]
        print(f"Target Group found: {tg_arn}")
        
        # 4. NLB Listener 생성 (TCP 3001) 및 기존 TG 연결
        print("Creating NLB Listener on port 3001")
        elbv2.create_listener(
            LoadBalancerArn=nlb_arn,
            Protocol="TCP",
            Port=3001,
            DefaultActions=[
                {
                    "Type": "forward",
                    "TargetGroupArn": tg_arn
                }
            ]
        )
        
        # 5. NLB가 Active 상태가 될 때까지 대기
        print("Waiting for NLB to become active...")
        waiter = elbv2.get_waiter("load_balancer_available")
        waiter.wait(
            LoadBalancerArns=[nlb_arn],
            WaiterConfig={"Delay": 15, "MaxAttempts": 40}
        )
        print("NLB is now active")
        
        # 6. SSM Parameter Store에 NLB DNS 저장 (다른 서비스에서 참조용)
        ssm.put_parameter(
            Name=f"/{PROJECT_NAME}/DR/NLB_DNS",
            Value=nlb_dns,
            Type="String",
            Overwrite=True,
            Description="도쿄 DR NLB DNS Name (Step Function에서 생성)"
        )
        # TG ARN도 저장해두지만, cleanup 시 참조용 (삭제는 안 함)
        ssm.put_parameter(
            Name=f"/{PROJECT_NAME}/DR/NLB_TG_ARN",
            Value=tg_arn,
            Type="String",
            Overwrite=True,
            Description="도쿄 DR NLB Target Group ARN"
        )
        
        result = {
            "nlb_dns_name": nlb_dns,
            "nlb_arn": nlb_arn,
            "target_group_arn": tg_arn,
            "status": "SUCCESS"
        }
        print(f"NLB creation complete: {json.dumps(result)}")
        return result
        
    except Exception as e:
        print(f"Error creating NLB: {str(e)}")
        raise e


# attach_asg_to_nlb 함수는 Terraform이 관리하므로 삭제됨


def update_web_launch_template(event, context):
    """
    Web Launch Template의 user_data를 업데이트하여 NLB DNS를 주입
    Step Function에서 NLB 생성 후 호출
    
    Args:
        event: {"nlb_dns_name": "MegaTicket-DR-NLB-xxx.elb.ap-northeast-1.amazonaws.com"}
    """
    ec2 = boto3.client("ec2", region_name=REGION)
    
    nlb_dns = event.get("nlb_dns_name")
    if not nlb_dns:
        raise ValueError("nlb_dns_name is required")
    
    lt_name_prefix = f"{PROJECT_NAME}-DR-Web-LT-"
    
    try:
        # 현재 Launch Template 조회
        response = ec2.describe_launch_templates(
            Filters=[{"Name": "launch-template-name", "Values": [f"{lt_name_prefix}*"]}]
        )
        
        if not response["LaunchTemplates"]:
            raise ValueError(f"Launch Template not found: {lt_name_prefix}*")
        
        lt = response["LaunchTemplates"][0]
        lt_id = lt["LaunchTemplateId"]
        lt_name = lt["LaunchTemplateName"]
        
        # 최신 버전의 Launch Template 데이터 조회
        version_response = ec2.describe_launch_template_versions(
            LaunchTemplateId=lt_id,
            Versions=["$Latest"]
        )
        
        lt_data = version_response["LaunchTemplateVersions"][0]["LaunchTemplateData"]
        
        # User Data 업데이트 (NLB_DNS_PLACEHOLDER를 실제 DNS로 교체)
        import base64
        current_user_data = base64.b64decode(lt_data.get("UserData", "")).decode("utf-8")
        updated_user_data = current_user_data.replace(
            "NLB_DNS_PLACEHOLDER",
            nlb_dns
        )
        
        # 새 Launch Template 버전 생성
        new_lt_data = lt_data.copy()
        new_lt_data["UserData"] = base64.b64encode(updated_user_data.encode("utf-8")).decode("utf-8")
        
        ec2.create_launch_template_version(
            LaunchTemplateId=lt_id,
            LaunchTemplateData=new_lt_data,
            VersionDescription=f"Updated NLB DNS: {nlb_dns}"
        )
        
        print(f"Launch Template updated: {lt_name}")
        
        return {
            "launch_template_id": lt_id,
            "launch_template_name": lt_name,
            "nlb_dns_name": nlb_dns,
            "status": "SUCCESS"
        }
        
    except Exception as e:
        print(f"Error updating Launch Template: {str(e)}")
        raise e


def delete_nlb(event, context):
    """
    DR 종료 시 NLB를 삭제하는 Lambda 함수 (비용 절감)
    
    Step Function DR Failback 프로세스에서 호출
    """
    elbv2 = boto3.client("elbv2", region_name=REGION)
    ssm = boto3.client("ssm", region_name=REGION)
    
    nlb_name = f"{PROJECT_NAME}-DR-NLB"
    
    try:
        # 1. NLB ARN 조회
        response = elbv2.describe_load_balancers(Names=[nlb_name])
        if not response["LoadBalancers"]:
            print(f"NLB not found: {nlb_name}")
            return {"status": "NOT_FOUND"}
        
        nlb_arn = response["LoadBalancers"][0]["LoadBalancerArn"]
        
        # 2. Listener 삭제
        listeners = elbv2.describe_listeners(LoadBalancerArn=nlb_arn)
        for listener in listeners["Listeners"]:
            elbv2.delete_listener(ListenerArn=listener["ListenerArn"])
            print(f"Deleted listener: {listener['ListenerArn']}")
        
        # 3. NLB 삭제
        elbv2.delete_load_balancer(LoadBalancerArn=nlb_arn)
        print(f"Deleted NLB: {nlb_name}")
        
        # 4. Target Group 삭제 생략 (Terraform 관리)
        # Terraform이 관리하므로 삭제하지 않음. ASG Detach도 불필요 (Terraform 연결 유지)
        
        # 5. SSM Parameter 정리
        for param_name in [f"/{PROJECT_NAME}/DR/NLB_DNS", f"/{PROJECT_NAME}/DR/NLB_TG_ARN"]:
            try:
                ssm.delete_parameter(Name=param_name)
            except ssm.exceptions.ParameterNotFound:
                pass
        
        return {"status": "SUCCESS", "deleted_nlb": nlb_name}
        
    except Exception as e:
        print(f"Error deleting NLB: {str(e)}")
        raise e


# =============================================================================
# Step Function 정의 (Amazon States Language - ASL)
# =============================================================================
STEP_FUNCTION_DEFINITION = """
{
  "Comment": "도쿄 DR Failover - NLB 동적 생성 (TG 및 ASG 연결은 Terraform 관리)",
  "StartAt": "CreateNLB",
  "States": {
    "CreateNLB": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:DR-CreateNLB",
      "ResultPath": "$.nlb",
      "Next": "UpdateWebLaunchTemplate"
    },
    "UpdateWebLaunchTemplate": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:DR-UpdateWebLT",
      "InputPath": "$.nlb",
      "ResultPath": "$.web_lt_update",
      "Next": "IncreaseASGCapacity"
    },
    "IncreaseASGCapacity": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:autoscaling:updateAutoScalingGroup",
      "Parameters": {
        "AutoScalingGroupName": "MegaTicket-DR-App-ASG",
        "DesiredCapacity": 1
      },
      "ResultPath": "$.app_asg_update",
      "Next": "IncreaseWebASGCapacity"
    },
    "IncreaseWebASGCapacity": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:autoscaling:updateAutoScalingGroup",
      "Parameters": {
        "AutoScalingGroupName": "MegaTicket-DR-Web-ASG",
        "DesiredCapacity": 1
      },
      "ResultPath": "$.web_asg_update",
      "End": true
    }
  }
}
"""
