#!/bin/bash
# App 서비스 시작 (디버깅 로그 + PM2 에러 로그 + S3 업로드)

LOG_FILE="/var/log/start_app.log"
rm -f $LOG_FILE
exec > >(tee -a $LOG_FILE) 2>&1

echo "=== Start Application: $(date) ==="

# 1. NVM 환경 로드
echo "[1] Loading NVM..."
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
echo "Node: $(node -v 2>&1 || echo 'NOT FOUND')"
echo "NPM: $(npm -v 2>&1 || echo 'NOT FOUND')"
echo "PM2: $(pm2 -v 2>&1 || echo 'NOT FOUND')"

# 2. 앱 디렉토리 이동
echo "[2] Changing to app directory..."
cd /home/ec2-user/app || { echo "❌ App directory not found!"; exit 1; }
echo "Current dir: $(pwd)"
echo "Files:"
ls -la

# 3. 환경변수 설정 (싱가포르 리전)
echo "[3] Setting environment variables..."
export NODE_ENV=production
export PORT=3001
export AWS_REGION=ap-southeast-1
export DYNAMODB_PERFORMANCES_TABLE=MegaTicket-Hybrid-performances
export DYNAMODB_RESERVATIONS_TABLE=MegaTicket-Hybrid-reservations
export DYNAMODB_SCHEDULES_TABLE=MegaTicket-Hybrid-schedules
export DYNAMODB_VENUES_TABLE=MegaTicket-Hybrid-venues

# 4. PM2로 앱 시작
echo "[4] Starting PM2..."
pm2 delete app 2>/dev/null || true
pm2 start npm --name "app" --merge-logs --log-date-format="YYYY-MM-DD HH:mm:ss" -- start

# 5. [핵심] 앱 구동 확인 및 로그 덤프
echo "[5] Waiting for app to initialize (5 seconds)..."
sleep 5

echo "--- PM2 Status ---"
pm2 list

echo "--- PM2 Logs (Last 50 lines) ---"
pm2 logs app --lines 50 --nostream

# 6. PM2 저장
echo "[6] PM2 save..."
pm2 save

echo "=== Completed: $(date) ==="

# 7. S3에 로그 업로드
echo "[7] Uploading log to S3..."
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
S3_KEY="logs/start_app_${INSTANCE_ID}_$(date +%Y%m%d-%H%M%S).log"

if aws s3 cp $LOG_FILE s3://codepipeline-ap-southeast-1-artifacts/$S3_KEY 2>/dev/null; then
    echo "✅ Log uploaded: $S3_KEY"
else
    echo "⚠️ Log upload skipped (bucket may not exist)"
fi

echo "Application started successfully"
