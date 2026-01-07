#!/bin/bash
set -x
exec > >(tee /var/log/user-data.log) 2>&1
echo "=== DR Web User Data Started: $(date) ==="

# 환경변수 파일 생성 (쉘용)
echo "export AWS_REGION=${aws_region}" > /home/ec2-user/dr-web-env.sh
echo "export INTERNAL_API_URL=${internal_api_url}" >> /home/ec2-user/dr-web-env.sh

chown ec2-user:ec2-user /home/ec2-user/dr-web-env.sh
chmod 644 /home/ec2-user/dr-web-env.sh

# 내용 확인
echo "=== Created Environment File ==="
cat /home/ec2-user/dr-web-env.sh

# .env.production 파일 재생성 (Next.js 런타임용) - Golden AMI 설정 덮어쓰기
echo "=== Creating .env.production for Web ==="
sudo -u ec2-user bash -c "cat > /home/ec2-user/megaticket/apps/web/.env.production << 'ENVEOF'
AWS_REGION=${aws_region}
INTERNAL_API_URL=${internal_api_url}
ENVEOF"

echo "=== .env.production contents ==="
cat /home/ec2-user/megaticket/apps/web/.env.production

# PM2 재시작 - 환경변수 명시적 주입
echo "=== Restarting Web Frontend ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 delete web-frontend || true'
sudo -u ec2-user bash -c "source /home/ec2-user/dr-web-env.sh && source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/web && AWS_REGION=${aws_region} INTERNAL_API_URL=${internal_api_url} pm2 start npm --name 'web-frontend' -- start"
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 save'

echo "=== DR Web User Data Completed: $(date) ==="
