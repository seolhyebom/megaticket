#!/bin/bash
# 배포 전 환경 준비

echo "Preparing environment for deployment..."

# 이전 배포 백업 (선택사항)
if [ -d /home/ec2-user/app ]; then
  echo "Backing up previous deployment..."
  mv /home/ec2-user/app /home/ec2-user/app.backup.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
fi

# 배포 디렉토리 생성
mkdir -p /home/ec2-user/app

echo "Environment prepared"
