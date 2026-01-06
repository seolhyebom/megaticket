#!/bin/bash
set -e

# 로그 파일 설정
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== User Data Script Started: $(date) ==="
# FORCE UPDATE CHECK: APP USER DATA

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

# 6. 소스코드 복제 (Clone 실패 시에도 진행 - Fail-safe 대비)
echo "=== Cloning Repository ==="
sudo -u ec2-user bash -c 'cd $HOME && rm -rf megaticket && git clone ${github_repo} || echo "Git clone failed, attempting recovery..."'

# 6.1 누락된 빌드 파일 복구 (안전장치 - GitHub 유실 대비)
echo "=== Restoring Missing Build Files (Fail-safe) ==="
sudo -u ec2-user bash -c 'cd $HOME/megaticket && (
    if [ ! -f package.json ]; then
        echo "Restoring package.json..."
        echo "ewogICAgIm5hbWUiOiAibWVnYS10aWNrZXQiLAogICAgInByaXZhdGUiOiB0cnVlLAogICAgIndvcmtzcGFjZXMiOiBbCiAgICAgICAgImFwcHMvKiIsCiAgICAgICAgInBhY2thZ2VzLyoiCiAgICBdLAogICAgInNjcmlwdHMiOiB7CiAgICAgICAgImRldiI6ICJ0dXJibyBydW4gZGV2IiwKICAgICAgICAiZGV2OndlYiI6ICJ0dXJibyBydW4gZGV2IC0tZmlsdGVyPXdlYiIsCiAgICAgICAgImRldjphcHAiOiAidHVyYm8gcnVuIGRldiAtLWZpbHRlcj1hcHAiLAogICAgICAgICJidWlsZCI6ICJ0dXJibyBydW4gYnVpbGQiLAogICAgICAgICJidWlsZDp3ZWIiOiAidHVyYm8gcnVuIGJ1aWxkIC0tZmlsdGVyPXdlYiIsCiAgICAgICAgImJ1aWxkOmFwcCI6ICJ0dXJibyBydW4gYnVpbGQgLS1maWx0ZXI9YXBwIiwKICAgICAgICAibGludCI6ICJ0dXJibyBydW4gbGludCIsCiAgICAgICAgImNsZWFuIjogInR1cmJvIHJ1biBjbGVhbiIsCiAgICAgICAgImNsZWFuOmZvcmNlIjogImVjaG8gXCJXYXJuaW5nOiBUaGlzIG1heSBmYWlsIGlmIGZpbGVzIGFyZSBsb2NrZWQuXCIgJiYgdHVyYm8gcnVuIGNsZWFuIC0tbm8tZGFlbW9uICYmIGlmIGV4aXN0IG5vZGVfbW9kdWxlcyBybWRpciAvcyAvcSBub2RlX21vZHVsZXMiLAogICAgICAgICJ0ZXN0LWNoYXRib3QiOiAibm9kZSBkaWFnbm9zZV92N185LmpzIgogICAgfSwKICAgICJkZXZEZXBlbmRlbmNpZXMiOiB7CiAgICAgICAgIkBhd3Mtc2RrL2NyZWRlbnRpYWwtcHJvdmlkZXJzIjogIl4zLjk1OC4wIiwKICAgICAgICAicHJldHRpZXIiOiAiXjMuMS4wIiwKICAgICAgICAidHVyYm8iOiAiXjIuMy4zIiwKICAgICAgICAidHlwZXNjcmlwdCI6ICJeNS4zLjAiCiAgICB9LAogICAgInBhY2thZ2VNYW5hZ2VyIjogIm5wbUAxMC4yLjUiCn0=" | base64 -d > package.json
    fi
    if [ ! -f turbo.json ]; then
        echo "Restoring turbo.json..."
        echo "ewogICAgIiRzY2hlbWEiOiAiaHR0cHM6Ly90dXJiby5idWlsZC9zY2hlbWEuanNvbiIsCiAgICAiZ2xvYmFsRGVwZW5kZW5jaWVzIjogWwogICAgICAgICIuZW52IgogICAgXSwKICAgICJ0YXNrcyI6IHsKICAgICAgICAiYnVpbGQiOiB7CiAgICAgICAgICAgICJkZXBlbmRzT24iOiBbCiAgICAgICAgICAgICAgICAiXmJ1aWxkIgogICAgICAgICAgICBdLAogICAgICAgICAgICAib3V0cHV0cyI6IFsKICAgICAgICAgICAgICAgICIubmV4dC8qKiIsCiAgICAgICAgICAgICAgICAiIS5uZXh0L2NhY2hlLyoqIiwKICAgICAgICAgICAgICAgICJkaXN0LyoqIgogICAgICAgICAgICBdCiAgICAgICAgfSwKICAgICAgICAiZGV2IjogewogICAgICAgICAgICAiY2FjaGUiOiBmYWxzZSwKICAgICAgICAgICAgInBlcnNpc3RlbnQiOiB0cnVlCiAgICAgICAgfSwKICAgICAgICAiY2xlYW4iOiB7CiAgICAgICAgICAgICJjYWNoZSI6IGZhbHNlCiAgICAgICAgfSwKICAgICAgICAibGludCI6IHt9CiAgICB9Cn0=" | base64 -d > turbo.json
    fi
    if [ ! -f tsconfig.base.json ]; then
        echo "Restoring tsconfig.base.json..."
        echo "ewogICAgImNvbXBpbGVyT3B0aW9ucyI6IHsKICAgICAgICAidGFyZ2V0IjogIkVTMjAyMCIsCiAgICAgICAgImxpYiI6IFsKICAgICAgICAgICAgImRvbSIsCiAgICAgICAgICAgICJkb20uaXRlcmFibGUiLAogICAgICAgICAgICAiZXNuZXh0IgogICAgICAgIF0sCiAgICAgICAgInN0cmljdCI6IHRydWUsCiAgICAgICAgImVzTW9kdWxlSW50ZXJvcCI6IHRydWUsCiAgICAgICAgIm1vZHVsZSI6ICJlc25leHQiLAogICAgICAgICJza2lwTGliQ2hlY2siOiB0cnVlLAogICAgICAgICJiYXNlVXJsIjogIi4iLAogICAgICAgICJwYXRocyI6IHsKICAgICAgICAgICAgIkBtZWdhLXRpY2tldC9zaGFyZWQtdHlwZXMiOiBbCiAgICAgICAgICAgICAgICAicGFja2FnZXMvc2hhcmVkLXR5cGVzL3NyYyIKICAgICAgICAgICAgXSwKICAgICAgICAgICAgIkBtZWdhLXRpY2tldC9zaGFyZWQtdXRpbHMiOiBbCiAgICAgICAgICAgICAgICAicGFja2FnZXMvc2hhcmVkLXV0aWxzL3NyYyIKICAgICAgICAgICAgXQogICAgICAgIH0KICAgIH0KfQ==" | base64 -d > tsconfig.base.json
    fi
)' || true


# 7. 의존성 설치
echo "=== Installing Dependencies ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && cd $HOME/megaticket && npm install'

# 8. 환경변수 설정 (로그인용)
echo "=== Setting Environment Variables ==="
echo "export AWS_REGION=${aws_region}" >> /home/ec2-user/.bashrc
echo "export DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations" >> /home/ec2-user/.bashrc
echo "export DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances" >> /home/ec2-user/.bashrc
echo "export DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues" >> /home/ec2-user/.bashrc
echo "export DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules" >> /home/ec2-user/.bashrc
chown ec2-user:ec2-user /home/ec2-user/.bashrc

# 9. App 빌드
echo "=== Building App ==="
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket && npm run build:app"

# 10. PM2로 App 서비스 시작 (Inline 환경변수 사용)
echo "=== Starting App Service with PM2 ==="
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/app && \
PORT=3001 \
AWS_REGION=${aws_region} \
DYNAMODB_RESERVATIONS_TABLE=${dynamodb_table_prefix}-reservations \
DYNAMODB_PERFORMANCES_TABLE=${dynamodb_table_prefix}-performances \
DYNAMODB_VENUES_TABLE=${dynamodb_table_prefix}-venues \
DYNAMODB_SCHEDULES_TABLE=${dynamodb_table_prefix}-schedules \
pm2 start npm --name 'app-backend' -- start"

# 11. PM2 저장 및 startup 설정
echo "=== Setting up PM2 Startup ==="
sudo -u ec2-user bash -c 'source $HOME/.nvm/nvm.sh && pm2 save'

# PM2 startup - Hardcoded Node Path for stability (v24.12.0)
NODE_BIN_DIR="/home/ec2-user/.nvm/versions/node/v24.12.0/bin"
sudo env PATH=$NODE_BIN_DIR:$PATH $NODE_BIN_DIR/pm2 startup systemd -u ec2-user --hp /home/ec2-user --service-name pm2-ec2-user || true

echo "=== User Data Script Completed: $(date) ==="
