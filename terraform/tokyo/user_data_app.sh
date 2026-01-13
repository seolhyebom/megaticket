#!/bin/bash
set -x
exec > >(tee /var/log/user-data.log) 2>&1
echo "=== DR App User Data Started: $(date) ==="

# 환경변수 파일 생성 (쉘용)
echo "export AWS_REGION=${aws_region}" > /home/ec2-user/dr-env.sh
echo "export PORT=3001" >> /home/ec2-user/dr-env.sh
echo "export DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations" >> /home/ec2-user/dr-env.sh
echo "export DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances" >> /home/ec2-user/dr-env.sh
echo "export DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues" >> /home/ec2-user/dr-env.sh
echo "export DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules" >> /home/ec2-user/dr-env.sh
echo "export DR_RECOVERY_MODE=true" >> /home/ec2-user/dr-env.sh

chown ec2-user:ec2-user /home/ec2-user/dr-env.sh
chmod 644 /home/ec2-user/dr-env.sh

# 내용 확인
echo "=== Created Environment File ==="
cat /home/ec2-user/dr-env.sh

# .env.production 파일 재생성 (Next.js 런타임용) - Golden AMI 설정 덮어쓰기
echo "=== Creating .env.production for App ==="
sudo -u ec2-user bash -c "cat > /home/ec2-user/megaticket/apps/app/.env.production << 'ENVEOF'
AWS_REGION=${aws_region}
PORT=3001
DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations
DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances
DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues
DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules
DR_RECOVERY_MODE=true
ENVEOF"

echo "=== .env.production contents ==="
cat /home/ec2-user/megaticket/apps/app/.env.production

# 1. Git 설치 (Amazon Linux 2023)
echo "=== Installing Git ==="
dnf install git -y

# PM2 재시작 - 환경변수를 명시적으로 주입하여 start
echo "=== Restarting App Backend ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 delete app-backend || true'
sudo -u ec2-user bash -c "source /home/ec2-user/dr-env.sh && source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/app && AWS_REGION=${aws_region} PORT=3001 DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules pm2 start npm --name 'app-backend' -- start"
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 save'

echo "=== DR App User Data Completed: $(date) ==="
