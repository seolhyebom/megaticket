#!/bin/bash
# =============================================================================
# App User Data - CodeDeploy 방식 (GitHub Actions CI/CD)
# =============================================================================
# 목적: EC2 인스턴스 시작 시 런타임 환경 설정 + CodeDeploy Agent 설치
# 앱 배포는 CodeDeploy가 담당 (git clone, npm build 없음)
# =============================================================================

set -e

# 로그 파일 설정
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== User Data Script Started: $(date) ==="

# 사용자 설정
USER_HOME=/home/ec2-user
APP_DIR=/home/ec2-user/app

# -----------------------------------------------------------------------------
# 1. 필수 패키지 설치 (Amazon Linux 2023)
# -----------------------------------------------------------------------------
echo "=== Installing Required Packages ==="
dnf install -y git ruby wget unzip

# -----------------------------------------------------------------------------
# 2. ec2-user 홈 디렉토리 권한 확인
# -----------------------------------------------------------------------------
chown ec2-user:ec2-user $USER_HOME

# -----------------------------------------------------------------------------
# 3. NVM 설치 (ec2-user 권한으로)
# -----------------------------------------------------------------------------
echo "=== Installing NVM ==="
sudo -u ec2-user bash -c 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash'

# -----------------------------------------------------------------------------
# 4. Node.js 설치
# -----------------------------------------------------------------------------
echo "=== Installing Node.js ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && nvm install 24.12.0'

# -----------------------------------------------------------------------------
# 5. PM2 전역 설치
# -----------------------------------------------------------------------------
echo "=== Installing PM2 ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && npm install -g pm2'

# -----------------------------------------------------------------------------
# 6. PM2 startup 설정
# -----------------------------------------------------------------------------
echo "=== Setting up PM2 Startup ==="
NODE_BIN_DIR="/home/ec2-user/.nvm/versions/node/v24.12.0/bin"
sudo env PATH=$NODE_BIN_DIR:$PATH $NODE_BIN_DIR/pm2 startup systemd -u ec2-user --hp /home/ec2-user --service-name pm2-ec2-user || true

# -----------------------------------------------------------------------------
# 7. 환경변수 설정 파일 생성
# -----------------------------------------------------------------------------
echo "=== Setting Environment Variables ==="
cat > /home/ec2-user/app-env.sh << 'ENVEOF'
export AWS_REGION=ap-northeast-2
export PORT=3001
export BEDROCK_REGION=ap-northeast-2
export DYNAMODB_RESERVATIONS_TABLE=plcr-gtbl-reservations
export DYNAMODB_PERFORMANCES_TABLE=plcr-gtbl-performances
export DYNAMODB_VENUES_TABLE=plcr-gtbl-venues
export DYNAMODB_SCHEDULES_TABLE=plcr-gtbl-schedules
ENVEOF

chown ec2-user:ec2-user /home/ec2-user/app-env.sh
grep -q "app-env.sh" /home/ec2-user/.bashrc || echo "source /home/ec2-user/app-env.sh" >> /home/ec2-user/.bashrc

# -----------------------------------------------------------------------------
# 8. 앱 디렉토리 생성 (CodeDeploy용)
# -----------------------------------------------------------------------------
echo "=== Creating app directory ==="
mkdir -p $APP_DIR
chown ec2-user:ec2-user $APP_DIR

# -----------------------------------------------------------------------------
# 9. CodeDeploy Agent 설치
# -----------------------------------------------------------------------------
echo "=== Installing CodeDeploy Agent ==="
cd /home/ec2-user
wget https://aws-codedeploy-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/latest/install
chmod +x ./install
./install auto
rm -f ./install

# -----------------------------------------------------------------------------
# 10. CodeDeploy Agent 상태 확인
# -----------------------------------------------------------------------------
echo "=== Checking CodeDeploy Agent Status ==="
systemctl status codedeploy-agent || true

echo "=== User Data Script Completed: $(date) ==="
echo "=== Waiting for CodeDeploy to deploy the application ==="
