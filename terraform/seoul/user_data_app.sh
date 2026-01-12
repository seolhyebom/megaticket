#!/bin/bash
# =============================================================================
# App User Data - Seoul Main Region (V3.0)
# =============================================================================
# 목적: ASG 인스턴스 시작 시 git pull → npm build → PM2 시작
# Golden AMI 생성: 이 User Data로 빌드 완료된 EC2에서 AMI 스냅샷 생성
# =============================================================================

set -e

# 로그 파일 설정
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== User Data Script Started: $(date) ==="

# 사용자 설정 (ec2-user로 실행)
USER_HOME=/home/ec2-user

# 1. Git 설치 (Amazon Linux 2023)
echo "=== Installing Git ==="
dnf install git -y

# 2. ec2-user 홈 디렉토리 권한 확인
chown ec2-user:ec2-user $USER_HOME

# 3. NVM 설치 (ec2-user 권한으로)
echo "=== Installing NVM ==="
sudo -u ec2-user bash -c 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash'

# 4. Node.js 설치
echo "=== Installing Node.js ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && nvm install 24.12.0'

# 5. PM2 전역 설치
echo "=== Installing PM2 ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && npm install -g pm2'

# 6. 소스코드 복제
echo "=== Cloning Repository ==="
sudo -u ec2-user bash -c 'cd $HOME && rm -rf megaticket && git clone ${github_repo} || echo "Git clone failed, attempting recovery..."'

# 7. 의존성 설치
echo "=== Installing Dependencies ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && cd $HOME/megaticket && npm install'

# 8. 환경변수 설정
echo "=== Setting Environment Variables ==="
cat > /home/ec2-user/app-env.sh << 'ENVEOF'
export AWS_REGION=${aws_region}
export PORT=3001
export BEDROCK_REGION=${aws_region}
export DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations
export DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances
export DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues
export DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules
ENVEOF

chown ec2-user:ec2-user /home/ec2-user/app-env.sh
echo "source /home/ec2-user/app-env.sh" >> /home/ec2-user/.bashrc

# 9. App 빌드
echo "=== Building App ==="
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket && npm run build:app"

# 10. PM2로 App 서비스 시작 (환경변수 주입)
echo "=== Starting App Service with PM2 ==="
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/app && \
PORT=3001 \
AWS_REGION=${aws_region} \
BEDROCK_REGION=${aws_region} \
DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations \
DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances \
DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues \
DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules \
pm2 start npm --name 'app-backend' -- start"

# 11. PM2 저장 및 startup 설정
echo "=== Setting up PM2 Startup ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 save'

# PM2 startup
NODE_BIN_DIR="/home/ec2-user/.nvm/versions/node/v24.12.0/bin"
sudo env PATH=$NODE_BIN_DIR:$PATH $NODE_BIN_DIR/pm2 startup systemd -u ec2-user --hp /home/ec2-user --service-name pm2-ec2-user || true

echo "=== User Data Script Completed: $(date) ==="
