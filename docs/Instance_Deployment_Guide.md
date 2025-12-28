# MegaTicket 인스턴스 배포 가이드 (Node.js)

Docker를 사용하지 않고, AWS EC2 등 일반적인 리눅스 인스턴스에서 Node.js 환경으로 직접 배포하는 절차입니다.

---

## 1. 사전 준비: Node.js 설치 (NVM 사용)

Node.js가 설치되어 있지 않은 경우, 가장 안정적인 **NVM (Node Version Manager)** 을 통해 설치합니다. (권장 버전: v24.12.0)

```bash
# 1. NVM 설치 스크립트 실행
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 2. NVM 활성화 (터미널 재시작 없이 바로 적용)
. ~/.nvm/nvm.sh

# 3. Node.js 설치 (로컬 개발 환경과 동일한 버전 권장)
nvm install 24.12.0

# 4. 설치 확인 (버전이 출력되면 성공)
node -v
npm -v
```

---

## 2. 공통 준비: 소스 코드 및 의존성 설치

Web, App 인스턴스 모두 공통적으로 수행해야 하는 단계입니다.

### ⚠️ 중요: Swap 메모리 설정 (저사양 인스턴스 필수)
t2.micro 등 메모리가 작은(1GB) 인스턴스에서는 `npm install` 도중 서버가 멈출 수 있습니다.
**배포를 시작하기 전에 아래 명령어로 Swap(가상 메모리)을 반드시 설정해 주세요.**

```bash
# 1. 2GB 스왑 파일 생성 및 활성화
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 2. 확인 (Swap 항목에 2.0Gi가 보이면 성공)
free -h
```

### 소스 코드 복제 및 설치
```bash
# 1. 홈 디렉터리로 이동 및 기존 폴더 정리
cd ~
rm -rf megaticket 

# 2. 소스 코드 복제
git clone https://github.com/seolhyebom/megaticket.git
cd megaticket

# 3. 전체 의존성 설치 (필수: 여기서 해야 모든 앱이 연결됨!)
npm install
```

---

## 3. 인스턴스별 실행 가이드

위에서 PM2를 설치했으므로, 빌드 후 바로 PM2로 실행합니다.

### A. Web 인스턴스 (Frontend) - Port 3000
```bash
# 1. Web 폴더로 이동 (또는 이미 있다면 생략)
cd ~/megaticket/apps/web

# 2. 환경변수 설정
export AWS_REGION=ap-northeast-2

# ★ App 인스턴스 API 연결을 위한 환경변수 (필수!)
# [테스트 환경] 단일 인스턴스 - Private IP 사용
export INTERNAL_API_URL=http://<App_Private_IP>:3001

# [프로덕션 환경] Route 53 + ALB + Auto Scaling - 도메인 사용
# export INTERNAL_API_URL=https://pilotlight-test.click

# 영구 설정 (재접속 시에도 유지)
echo 'export INTERNAL_API_URL=https://pilotlight-test.click' >> ~/.bashrc

# 3. 빌드
npm run build

# 4. 실행 (PM2)
pm2 start npm --name "web-frontend" -- start

# 5. 재부팅 대비 저장 (필수)
pm2 save
pm2 startup
```

> ⚠️ **중요**: `INTERNAL_API_URL`이 설정되지 않으면 Web에서 API 호출 시 `localhost:3001`로 요청하여 404 에러가 발생합니다!

### B. App 인스턴스 (Backend) - Port 3001
```bash
# 1. App 폴더로 이동
cd ~/megaticket/apps/app

# 2. 환경변수 설정
export AWS_REGION=ap-northeast-2

# (선택) 장애 복구 테스트 시
# export DR_RECOVERY_MODE=true

# 3. 빌드
npm run build

# 4. 실행 (PM2)
pm2 start npm --name "app-backend" -- start

# 5. 재부팅 대비 저장 (필수)
pm2 save
pm2 startup
# (주의: 출력된 sudo env 명령어를 복사할 때, 끝부분 '--hp'와 '/home' 사이에 띄어쓰기가 있는지 꼭 확인하세요!)
# 예: ... --hp /home/ssm-user (O)
# 예: ... --hp/home/ssm-user (X -> 에러남)
```

---

---

## 4. (필수) 인스턴스 재부팅 시 자동 실행 설정

AWS 인스턴스를 중지(Stop) 후 시작(Start)하거나 재부팅해도 서버가 자동으로 켜지게 하려면 **PM2 Startup 설정**이 필요합니다.

```bash
# 1. PM2가 부팅 시 자동 실행되도록 스크립트 생성
pm2 startup

# 2. 위 명령어를 치면 터미널에 "sudo env PATH=..." 로 시작하는 명령어가 뜹니다.
#    그 명령어를 그대로 복사해서 붙여넣고 실행하세요.

# 3. 현재 켜져 있는 서버 리스트를 저장 (이 상태대로 부팅 시 켜짐)
pm2 save
```

이제 인스턴스를 재부팅해도 서버가 자동으로 살아납니다.


---

## 5. PM2 관리 및 유용한 명령어

서버가 켜진 상태에서 상태를 확인하거나 로그를 볼 때 사용하는 명령어입니다.
(명령어가 없다고 나오면 `. ~/.nvm/nvm.sh`를 먼저 입력하세요)

```bash
# 상태 확인 (서버 리스트 및 메모리 사용량)
pm2 list

# 로그 확인 (실시간 로그)
pm2 logs
# 특정 앱 로그만 보기
pm2 logs web-frontend
pm2 logs app-backend

# 서버 재시작
pm2 restart web-frontend
pm2 restart app-backend

# 서버 중지/삭제
pm2 stop web-frontend
pm2 delete web-frontend
```


---

## 6. 상황별 운영 가이드

이미 PM2로 서버가 실행 중인 상태에서 **코드 업데이트** 등을 할 때 사용하는 명령어입니다.

### B. 코드를 수정했거나 최신 코드를 받은 경우 (`git pull`)
코드가 바뀌었으므로 **반드시 빌드**를 새로 해야 반영됩니다.
Monorepo 구조이므로 **루트 폴더**에서 의존성을 설치하는 것이 가장 안전합니다.

```bash
# 0. 접속 후 필수 실행
cd ~/megaticket
. ~/.nvm/nvm.sh
source ~/.bashrc

# 1. 최신 코드 받기 & 의존성 전체 설치 (루트에서!)
git pull
npm install

# 2. Web 업데이트 및 빌드
cd apps/web
npm run build      # (★필수)
pm2 restart web-frontend

# 3. App 업데이트 및 빌드
cd ~/megaticket/apps/app   # (경로 이동 주의)
npm run build      # (★필수)
pm2 restart app-backend
```

### B. 단순히 껐다 켜고 싶을 때 (재부팅 등)
```bash
# 죽은 서버 살리기
pm2 resurrect

# 또는 개별 시작
pm2 start web-frontend
pm2 start app-backend
```

---

## 7. (권장) AWS 로드밸런서(ALB) 포트 연결 설정

인스턴스 내부에서 Nginx 등을 사용하는 것보다, AWS 로드밸런서(ALB)가 직접 Node.js 포트(3000/3001)로 연결해주는 것이 가장 깔끔합니다.

### 1단계: 인스턴스에서 Nginx 끄기
Nginx가 80번 포트를 잡고 있으면 혼선이 생길 수 있으므로 중지합니다.

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### 2단계: AWS 콘솔에서 대상 그룹(Target Group) 수정
AWS 웹 콘솔에 접속하여 아래 작업을 수행합니다.

1.  **EC2 > 대상 그룹 (Target Groups)** 메뉴로 이동
2.  수정할 대상 그룹 선택 (Web용 또는 App용)
3.  **Targets (대상)** 탭 클릭 -> 현재 등록된 인스턴스(Port 80) 선택 -> **Deregister (등록 취소)**
4.  잠시 후 인스턴스가 목록에서 사라지면 **Register targets (대상 등록)** 버튼 클릭
5.  아래의 **Available instances** 목록에서 해당 인스턴스 선택
6.  **Ports** 입력란에 포트 번호 직접 입력 (중요!)
    *   **Web 인스턴스**: `3000` 입력
    *   **App 인스턴스**: `3001` 입력
7.  **Include as pending below** 버튼 클릭
8.  **Register pending targets** 버튼 눌러서 저장

### 3단계: 확인
이제 브라우저에서 도메인 주소(`http://...`)로 접속하면 포트 번호 없이도 잘 열려야 합니다.

---

## 8. 트러블슈팅: EADDRINUSE (포트 충돌)

`npm start` 실행 시 `Error: listen EADDRINUSE: address already in use :::3001` 에러가 난다면, 이미 해당 포트에서 서버가 돌고 있다는 뜻입니다.

**해결 방법:**

1.  **실행 중인 프로세스 찾기**
    ```bash
    # 3001번 포트 쓰는 녀석 찾기
    lsof -i :3001
    # 또는
    netstat -nlp | grep 3001
    ```

2.  **프로세스 강제 종료**
    ```bash
    # 위에서 찾은 PID(숫자)를 입력
    kill -9 <PID>
    
    # 또는 한방에 종료 (nodejs 프로세스)
    pkill -f next-server
    # 또는
    npx kill-port 3001
    ```

---

## 9. 트러블슈팅: Docker와 포트 충돌

만약 `EADDRINUSE` 에러가 나는데 `lsof`나 `netstat`으로 확인했을 때 `docker-proxy`가 나온다면, 예전에 실행해둔 도커 컨테이너가 포트를 잡고 있는 것입니다.

**해결 방법: 실행 중인 도커 컨테이너 중지**

```bash
# 1. 실행 중인 도커 컨테이너 확인
sudo docker ps

# 2. 모든 컨테이너 중지 (가장 확실함)
sudo docker stop $(sudo docker ps -q)

# 3. (필요시) 모든 컨테이너 삭제
sudo docker rm $(sudo docker ps -aq)
```

이제 다시 `npm start`를 해보세요.

