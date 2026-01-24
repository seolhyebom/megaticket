# 🚨 배포 방식 문제점 및 해결 방안

## 📋 현재 배포 방식

```
팀 Repo (main push)
  ↓
GitHub Actions (deploy-app.yml)
  ↓
npm build → app.zip
  ↓
S3 업로드 (plcr-s3-an2-app-artifacts/latest/app.zip)
  ↓
CodeDeploy 배포 실행
  ↓
✅ 현재 실행 중인 인스턴스에만 배포됨
```

---

## 🔴 문제점

### 1. ASG 새 인스턴스 생성 시 앱 배포 안 됨

**시나리오**:
- Terraform apply로 인스턴스 재생성
- ASG Auto Scaling으로 인스턴스 추가
- DR 리전으로 전환 시 새 인스턴스 시작

**결과**:
```
새 인스턴스 생성
  ↓
User Data 실행 (Node.js, PM2, CodeDeploy Agent 설치)
  ↓
❌ 앱 코드 없음 (빈 /home/ec2-user/app/ 디렉토리)
  ↓
⚠️ 서비스 불가 상태
```

### 2. 영향 범위

- **서울 리전**: ASG 스케일 아웃 시 새 인스턴스 서비스 불가
- **DR 전환**: Tokyo 리전 인스턴스 시작 시 앱 없음
- **Instance Refresh**: Launch Template 업데이트 시 신규 인스턴스에 앱 없음

### 3. 근본 원인

**CodeDeploy Deployment Group 설정 문제**:
- ASG와 연동은 되어 있음 (`plcr-asg-an2-app` 연결)
- **하지만 ASG Lifecycle Hook이 설정되지 않음**

**확인 결과**:
```bash
$ aws autoscaling describe-lifecycle-hooks --auto-scaling-group-name plcr-asg-an2-app --region ap-northeast-2
{
    "LifecycleHooks": []  # ❌ 비어있음
}
```

**CodeDeploy가 수동으로 생성됨**:
- Terraform 코드에 CodeDeploy 리소스 없음
- 수동 생성으로 인해 ASG와 완전한 통합 안 됨

---

## ✅ 임시 해결 방법 (현재)

### 새 인스턴스에 수동 배포

```bash
aws deploy create-deployment \
  --application-name plcr-codedeploy-an2-app \
  --deployment-group-name plcr-dg-an2-app \
  --s3-location bucket=plcr-s3-an2-app-artifacts,key=latest/app.zip,bundleType=zip \
  --deployment-config-name CodeDeployDefault.OneAtATime \
  --description "Manual deployment to new instance" \
  --region ap-northeast-2
```

**문제**:
- 매번 수동 작업 필요
- 자동화된 DR 전환 불가
- ASG Auto Scaling 무의미

---

## 💡 근본적 해결 방안

### 옵션 1: Terraform에 CodeDeploy 추가 (권장)

**장점**:
- Infrastructure as Code 완성
- ASG Lifecycle Hook 자동 설정
- 새 인스턴스 자동 배포
- DR 리전 동일하게 적용 가능

**작업**:
1. `terraform/seoul/codedeploy.tf` 생성
2. CodeDeploy Application, Deployment Group 정의
3. ASG와 연동 설정 (`autoscaling_groups` 파라미터)
4. Tokyo DR에도 동일하게 적용

**참고**: CodeDeploy가 ASG와 제대로 연동되면 Lifecycle Hook이 자동 생성됨

### 옵션 2: User Data에서 앱 배포까지 처리

**장점**:
- CodeDeploy 없이 단순화
- User Data만으로 완전한 인스턴스 구성

**단점**:
- User Data 실행 시간 증가 (git clone, npm build)
- 배포 실패 추적 어려움
- Blue/Green 배포 불가

**작업**:
```bash
# User Data에 추가
aws s3 cp s3://plcr-s3-an2-app-artifacts/latest/app.zip /home/ec2-user/app.zip
unzip /home/ec2-user/app.zip -d /home/ec2-user/app/
cd /home/ec2-user/app && pm2 start npm --name "app" -- start
```

---

## 📊 배포 히스토리 분석

| 날짜/시간 | 방식 | 커밋 | 상태 |
|----------|------|------|------|
| 1/24 16:50 | - | `abc4999` (chore) | 배포 안 됨 (경로 변경 없음) |
| 1/24 15:39 | 수동 | - | ✅ Succeeded |
| 1/24 15:23 | Actions | `09a72a4` (race condition) | ❌ Failed |
| 1/24 11:34 | 수동 | - | ✅ Succeeded |
| 1/24 03:32 | Actions | `a173070` (health check) | ❌ Failed |

**패턴**:
- GitHub Actions 자동 배포 실패율 높음
- 수동 배포는 대부분 성공

---

## 🎯 권장 조치

1. **즉시**: Terraform에 CodeDeploy 리소스 추가 (옵션 1)
2. **Seoul/Tokyo 모두 적용**
3. **검증**: 인스턴스 종료 후 재생성 → 자동 배포 확인
4. **문서화**: DR 전환 시나리오 테스트 및 문서화

---

## 📌 관련 리소스

- **CodeDeploy Application**: `plcr-codedeploy-an2-app`
- **Deployment Group**: `plcr-dg-an2-app`
- **S3 Artifact Bucket**: `plcr-s3-an2-app-artifacts`
- **ASG**: `plcr-asg-an2-app`
- **GitHub Workflow**: `.github/workflows/deploy-app.yml`

---

**작성일**: 2026-01-24
**보고자**: Bedrock Team
**우선순위**: 🔴 High (DR 및 Auto Scaling 기능 영향)
