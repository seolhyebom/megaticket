# Bedrock Young & Hip Chatbot 사용 가이드

현재 적용된 디자인과 기능은 소스 코드 파일(`page.tsx`, `globals.css` 등)에 모두 저장되어 있으므로, 컴퓨터를 껐다 켜거나 나중에 다시 실행해도 **항상 똑같이 예쁜 화면**을 다시 보실 수 있습니다! 걱정하지 마세요.

## 🚀 실행 방법 (Docker 사용 시 - 권장)

현재 터미널 환경에서 사용하시던 방법입니다. 가장 간편하고 확실합니다.

1. **터미널 열기**: VS Code나 터미널을 엽니다.
2. **폴더 이동**: `web-ui` 폴더로 이동합니다.
   ```bash
   cd c:\bedrock_space\web-ui
   ```
3. **실행 명령어 입력**:
   ```bash
   docker-compose up --build
   ```
   * `--build` 옵션은 코드가 변경되었을 때 확실하게 반영하여 실행해 줍니다.
4. **접속**: 브라우저 주소창에 아래 주소를 입력하세요.
   * [http://localhost:3000](http://localhost:3000)

## 🛑 종료 방법

1. 실행 중인 터미널에서 `Ctrl` 키를 누른 상태에서 `C`를 누르면 종료됩니다. (`Ctrl + C`)
2. 또는 확실하게 끄고 싶다면 아래 명령어를 입력하세요.
   ```bash
   docker-compose down
   ```

## 💻 (선택) 로컬 개발 모드로 실행하기

Docker를 켜지 않고 Node.js로 바로 실행하고 싶으신 경우입니다.

1. **폴더 이동**: `cd c:\bedrock_space\web-ui`
2. **의존성 설치** (최초 1회만): `npm install`
3. **실행**: `npm run dev`
4. **접속**: [http://localhost:3000](http://localhost:3000)

---

### ✨ 적용된 주요 디자인 포인트
- **Cosmic 배경**: 깊은 우주 검정색 배경 + Aurora Gradients (Indigo, Teal, Fuchsia)
- **Outer Glowing Border**: 회전하는 네온 그라데이션 테두리
- **Shimmering Text**: "오늘 무엇을 도와드릴까요?" 텍스트에 흐르는 빛 효과
- **Custom Scrollbar**: 평소엔 숨겨졌다가 나타나는 보석 같은 그라데이션 스크롤바
