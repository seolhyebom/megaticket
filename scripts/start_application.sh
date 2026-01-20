#!/bin/bash
# =============================================================================
# Start Application Script (CodeDeploy - AfterInstall Hook)
# =============================================================================

set -e

echo "=== Starting Application: $(date) ==="

APP_DIR=/home/ec2-user/app

# 환경변수 로드
source /home/ec2-user/app-env.sh 2>/dev/null || true
source /home/ec2-user/.bashrc 2>/dev/null || true
export NVM_DIR="/home/ec2-user/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 앱 디렉토리로 이동
cd $APP_DIR

# node_modules가 이미 포함되어 있으므로 npm install 생략
echo "Checking node_modules..."
ls -la node_modules 2>/dev/null && echo "node_modules exists!" || echo "WARNING: node_modules not found!"

# PM2로 앱 시작 (next 직접 실행)
echo "Starting application with PM2..."
pm2 start node_modules/next/dist/bin/next --name "mega-ticket-app" --merge-logs --log-date-format="YYYY-MM-DD HH:mm:ss" -- start -H 0.0.0.0 -p 3001

# PM2 상태 저장 (재부팅 시 자동 시작)
pm2 save

echo "=== Application Started: $(date) ==="
pm2 status
