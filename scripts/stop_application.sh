#!/bin/bash
# 기존 App 서비스 중지

echo "Stopping existing application..."

# PM2로 실행 중인 앱 중지
pm2 stop app 2>/dev/null || echo "No running app found"

# 포트 3001 사용 중인 프로세스 종료
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "Port 3001 is free"

echo "Application stopped successfully"
