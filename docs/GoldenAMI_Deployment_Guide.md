# Golden AMI 기반 도쿄 DR 배포 가이드

본 문서는 서울 리전에서 생성한 Golden AMI를 사용하여 도쿄(Secondary) 리전에 인스턴스를 배포할 때 필요한 설정과 환경변수 가이드를 제공합니다.

---

## 1. 빌드 오류가 발생하지 않는 이유
서울 리전의 초기 배포와 달리, 도쿄 리전 배포 시에는 `npm install`이나 `npm run build` 과정에서 발생하는 오류(에러 502, 빌드 실패 등)를 걱정할 필요가 없습니다.

*   **이유**: Golden AMI는 이미 서울 리전에서 **빌드가 완료된 상태의 소스 코드와 실행 바이너리**를 포함하고 있기 때문입니다.
*   **핵심**: 도쿄에서는 새로 빌드할 필요 없이, **도쿄 환경에 맞는 환경변수만 바꿔주고 실행 중인 프로세스(PM2)만 재시작**하면 즉시 서비스가 가능합니다.

---

## 2. Web 서비스 (Frontend) 배포 가이드

Web 인스턴스는 사용자의 요청을 받아 백엔드(App)로 전달하는 역할을 합니다.

> [!NOTE]
> **왜 `pilotlight-test.click` 대신 `INTERNAL_API_URL`을 쓰나요?**
> *   `pilotlight-test.click`: 사용자가 외부(브라우저)에서 접속하는 **외부 통로(ALB)**입니다.
> *   `INTERNAL_API_URL`: 웹 서버가 소스 코드 내부에서 백엔드 API와 통신하는 **내부 통로(NLB)**입니다.
> *   내부 통로를 사용하면 외부 인터넷을 거치지 않아 **속도가 훨씬 빠르고, 불필요한 데이터 전송 비용(NAT GW 비용 등)을 아낄 수 있습니다.**

### 필수 환경변수
| 변수명 | 설명 | 예시 값 |
| :--- | :--- | :--- |
| `AWS_REGION` | 현재 구동되는 리전 정보 | `ap-northeast-1` |
| `INTERNAL_API_URL` | 백엔드(NLB)의 내부 접속 주소 | `http://MegaTicket-NLB-xxx.elb.ap-northeast-1.amazonaws.com:3001` |

### 추천 User Data (Web)
```bash
#!/bin/bash
# 1. 도쿄 환경에 맞는 환경변수 설정
export AWS_REGION=ap-northeast-1
export INTERNAL_API_URL=http://<도쿄_NLB_DNS>:3001

# 2. PM2 기존 프로세스 제거 후 환경변수와 함께 재시작
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/web && \
AWS_REGION=$AWS_REGION INTERNAL_API_URL=$INTERNAL_API_URL pm2 start npm --name 'web-frontend' -- start"

# 3. 설정 저장 (재부팅 시 자동 시작용)
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && pm2 save"
```

---

## 3. App 서비스 (Backend) 배포 가이드

App 인스턴스는 데이터베이스(DynamoDB)와 통신하며 실제 비즈니스 로직을 처리합니다.

### 필수 환경변수
| 변수명 | 설명 | 예시 값 |
| :--- | :--- | :--- |
| `AWS_REGION` | 현재 구동되는 리전 정보 | `ap-northeast-1` |
| `PORT` | 서비스 포트 | `3001` |
| `DYNAMODB_PERFORMANCES_TABLE` | 공연 정보 테이블명 | `KDT-Msp4-PLDR-performances` |
| `DYNAMODB_RESERVATIONS_TABLE` | 예약 정보 테이블명 | `KDT-Msp4-PLDR-reservations` |
| `DYNAMODB_SCHEDULES_TABLE` | 스케줄 테이블명 (추가) | `KDT-Msp4-PLDR-schedules` |
| `DYNAMODB_VENUES_TABLE` | 공연장 테이블명 (추가) | `KDT-Msp4-PLDR-venues` |
| `DR_RECOVERY_MODE` | DR 복구 모드 활성화 여부 | `true` |

> [!TIP]
> **`DR_RECOVERY_MODE=true` 설정 시 작동 원리**
> *   **30분 유예 기간**: 서울 리전에서 장애 발생 전 "선점 중(HOLDING)"이었던 데이터가 도쿄 리전으로 넘어올 때, 원래의 10분 만료 시간을 무시하고 **도쿄 서버 시작 시점부터 30분 동안 유예 기간**을 줍니다.
> *   **결과**: 사용자는 서울에서 잡았던 좌석을 도쿄 리전에 접속하여 '내 예약' 페이지에서 확인하고, 30분 내에 결제를 완료하여 예약을 확정할 수 있습니다.

> [!NOTE]
> 테이블명은 테라폼의 `dynamodb_table_prefix` 변수 값에 따라 달라질 수 있습니다.

### 추천 User Data (App)
```bash
#!/bin/bash
# 1. 도쿄 환경에 맞는 환경변수 설정
export AWS_REGION=ap-northeast-1
export PORT=3001
export DYNAMODB_PERFORMANCES_TABLE=KDT-Msp4-PLDR-performances
export DYNAMODB_RESERVATIONS_TABLE=KDT-Msp4-PLDR-reservations
export DYNAMODB_SCHEDULES_TABLE=KDT-Msp4-PLDR-schedules
export DYNAMODB_VENUES_TABLE=KDT-Msp4-PLDR-venues
export DR_RECOVERY_MODE=true

# 2. PM2 기존 프로세스 제거 후 환경변수와 함께 재시작
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && cd \$HOME/megaticket/apps/app && \
AWS_REGION=$AWS_REGION PORT=$PORT \
DYNAMODB_PERFORMANCES_TABLE=$DYNAMODB_PERFORMANCES_TABLE \
DYNAMODB_RESERVATIONS_TABLE=$DYNAMODB_RESERVATIONS_TABLE \
DYNAMODB_SCHEDULES_TABLE=$DYNAMODB_SCHEDULES_TABLE \
DYNAMODB_VENUES_TABLE=$DYNAMODB_VENUES_TABLE \
DR_RECOVERY_MODE=$DR_RECOVERY_MODE pm2 start npm --name 'app-backend' -- start"

# 3. 설정 저장
sudo -u ec2-user bash -c "source \$HOME/.nvm/nvm.sh && pm2 save"
```

---

## 4. 요약 및 주의사항
1.  **Golden AMI 복사**: 서울 리전에서 빌드가 성공한 인스턴스의 이미지를 떠서 도쿄 리전으로 복사하는 것이 선행되어야 합니다.
2.  **No Build, Just Run**: 도쿄에서는 `npm install` 등을 실행하지 마세요. 오직 **환경변수 주입과 PM2 재시작**만 수행합니다.
3.  **NLB 주소**: Web 배포 전에 반드시 도쿄 리전의 NLB DNS 주소를 확인하여 `INTERNAL_API_URL`에 올바르게 입력해야 합니다.
