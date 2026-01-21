#!/bin/bash
# =============================================================================
# DR Tokyo User Data - S3 아티팩트 다운로드 방식
# =============================================================================
# 목적: Golden AMI 기반 EC2 인스턴스 시작 시
#       - S3에서 최신 app.zip 다운로드 (CRR 복제본)
#       - 환경변수 설정 (도쿄 리전)
#       - PM2로 앱 재시작
# =============================================================================

set -x
exec > >(tee /var/log/user-data.log) 2>&1
echo "=== DR Tokyo User Data Started: $(date) ==="

# -----------------------------------------------------------------------------
# 변수 설정
# -----------------------------------------------------------------------------
APP_DIR=/home/ec2-user/app
S3_BUCKET=plcr-s3-an1-app-artifacts
S3_KEY=latest/app.zip
AWS_REGION=ap-northeast-1

# -----------------------------------------------------------------------------
# 1. 환경변수 파일 생성
# -----------------------------------------------------------------------------
echo "=== Setting Environment Variables ==="
cat > /home/ec2-user/app-env.sh << 'ENVEOF'
export AWS_REGION=ap-northeast-1
export PORT=3001
export BEDROCK_REGION=ap-northeast-1
export DYNAMODB_RESERVATIONS_TABLE=plcr-gtbl-reservations
export DYNAMODB_PERFORMANCES_TABLE=plcr-gtbl-performances
export DYNAMODB_VENUES_TABLE=plcr-gtbl-venues
export DYNAMODB_SCHEDULES_TABLE=plcr-gtbl-schedules
export DR_RECOVERY_MODE=true
ENVEOF

chown ec2-user:ec2-user /home/ec2-user/app-env.sh
chmod 644 /home/ec2-user/app-env.sh

# .bashrc에 추가
grep -q "app-env.sh" /home/ec2-user/.bashrc || echo "source /home/ec2-user/app-env.sh" >> /home/ec2-user/.bashrc

echo "=== Environment file created ==="
cat /home/ec2-user/app-env.sh

# -----------------------------------------------------------------------------
# 2. NVM 환경 로드
# -----------------------------------------------------------------------------
echo "=== Loading NVM ==="
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
echo "Node version: $(node -v 2>&1 || echo 'NOT FOUND')"
echo "NPM version: $(npm -v 2>&1 || echo 'NOT FOUND')"

# -----------------------------------------------------------------------------
# 3. 기존 앱 백업 (선택적)
# -----------------------------------------------------------------------------
echo "=== Backing up existing app ==="
if [ -d "$APP_DIR" ]; then
    BACKUP_DIR="/home/ec2-user/app_backup_$(date +%Y%m%d-%H%M%S)"
    mv $APP_DIR $BACKUP_DIR
    echo "Backup created: $BACKUP_DIR"
fi

# -----------------------------------------------------------------------------
# 4. S3에서 최신 아티팩트 다운로드
# -----------------------------------------------------------------------------
echo "=== Downloading latest artifact from S3 ==="
mkdir -p $APP_DIR
cd /home/ec2-user

aws s3 cp s3://$S3_BUCKET/$S3_KEY ./app.zip --region $AWS_REGION

if [ $? -ne 0 ]; then
    echo "❌ Failed to download from S3!"
    echo "Restoring backup..."
    [ -d "$BACKUP_DIR" ] && mv $BACKUP_DIR $APP_DIR
    exit 1
fi

# -----------------------------------------------------------------------------
# 5. 압축 해제
# -----------------------------------------------------------------------------
echo "=== Extracting artifact ==="
unzip -o ./app.zip -d $APP_DIR
rm -f ./app.zip

# 권한 설정
chown -R ec2-user:ec2-user $APP_DIR
chmod -R 755 $APP_DIR

echo "=== App directory contents ==="
ls -la $APP_DIR

# -----------------------------------------------------------------------------
# 6. PM2로 앱 시작
# -----------------------------------------------------------------------------
echo "=== Starting application with PM2 ==="
source /home/ec2-user/app-env.sh

# 기존 PM2 프로세스 중지
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 delete all 2>/dev/null || true'

# 앱 시작
cd $APP_DIR
sudo -u ec2-user bash -c "source /home/ec2-user/app-env.sh && source \$HOME/.nvm/nvm.sh && cd $APP_DIR && pm2 start node_modules/next/dist/bin/next --name 'mega-ticket-app' --merge-logs --log-date-format='YYYY-MM-DD HH:mm:ss' -- start -H 0.0.0.0 -p 3001"

# PM2 저장
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 save'

# -----------------------------------------------------------------------------
# 7. 헬스체크
# -----------------------------------------------------------------------------
echo "=== Health Check ==="
sleep 5
for i in {1..5}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Health check passed! HTTP $HTTP_CODE"
        break
    fi
    echo "Attempt $i: HTTP $HTTP_CODE, retrying..."
    sleep 3
done

# -----------------------------------------------------------------------------
# 8. 완료
# -----------------------------------------------------------------------------
echo "=== PM2 Status ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 status'

echo "=== DR Tokyo User Data Completed: $(date) ==="
