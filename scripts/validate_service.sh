#!/bin/bash
# 배포 후 서비스 Health Check

echo "Validating service health..."

# 앱이 시작될 시간 대기
sleep 60

# Health Check API 호출
HEALTH_CHECK_URL="http://localhost:3001/api/health"

echo "Checking health endpoint: $HEALTH_CHECK_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL)

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Health check passed! (HTTP $HTTP_CODE)"
  exit 0
else
  echo "❌ Health check failed! (HTTP $HTTP_CODE)"
  echo "Rolling back deployment..."
  exit 1
fi
