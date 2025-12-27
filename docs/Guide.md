# Hands-on Lab: AWS Bedrock & Next.js 챗봇 만들기 가이드

이 문서는 AWS Bedrock API와 Next.js 15를 활용하여 실시간 스트리밍 답변이 가능한 AI 챗봇 애플리케이션을 구축하는 전체 과정을 실습 형식으로 정리한 가이드입니다. Notion 등 학습 자료로 활용하기 적합하도록 구성되었습니다.

---

## 🚀 1. 사전 준비 (Prerequisites)

실습을 시작하기 전에 다음 환경이 준비되어 있어야 합니다.

1.  **Node.js 설치**: v18.17.0 이상 (LTS 버전 권장)
2.  **AWS 계정 및 권한**:
    *   AWS 계정 필요
    *   Bedrock 모델 접근 권한 활성화 (Console > Bedrock > Model access)
    *   로컬 개발용 AWS 자격 증명 설정 (`~/.aws/credentials` 또는 환경 변수)

---

## 🛠️ 2. 프로젝트 초기화 (Project Setup)

Next.js 15 프로젝트를 생성하고 기본 설정을 진행합니다.

### 2.1 Next.js 프로젝트 생성
터미널에서 다음 명령어를 실행하여 프로젝트를 생성합니다.

```bash
npx create-next-app@latest web-ui
# 설정 옵션:
# - TypeScript: Yes
# - ESLint: Yes
# - Tailwind CSS: Yes
# - `src/` directory: No (App Router 사용)
# - App Router: Yes
# - Import alias: @/*
```

### 2.2 Shadcn UI 설정
모던하고 아름다운 UI 컴포넌트를 위해 Shadcn UI를 초기화합니다.

```bash
cd web-ui
npx shadcn-ui@latest init
# 설정 옵션:
# - Style: Default
# - Base Color: Slate
# - CSS Variables: Yes
```

필요한 UI 컴포넌트(버튼, 입력창, 카드 등)를 추가합니다.

```bash
npx shadcn-ui@latest add button input card avatar
npm install lucide-react framer-motion clsx tailwind-merge
```

---

## ☁️ 3. AWS Bedrock 연동 (Backend)

AWS Bedrock API를 노드 환경에서 호출하기 위한 설정을 진행합니다.

### 3.1 AWS SDK 설치
AWS Bedrock Runtime 클라이언트를 설치합니다.

```bash
npm install @aws-sdk/client-bedrock-runtime
```

### 3.2 Bedrock 클라이언트 설정 (`lib/bedrock.ts`)
SDK 클라이언트 인스턴스를 생성하는 유틸리티 파일을 작성합니다. 리전은 `ap-northeast-2` (서울)를 사용합니다.

```typescript
// lib/bedrock.ts
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

export const bedrockClient = new BedrockRuntimeClient({
  region: "ap-northeast-2", // 서울 리전 사용
});
```

### 3.3 Chat API 라우트 구현 (`app/api/chat/route.ts`)
Next.js의 App Router 기능을 이용해 프론트엔드와 통신할 API 엔드포인트를 만듭니다. `ConverseStreamCommand`를 사용하여 스트리밍 응답을 구현합니다.

```typescript
// app/api/chat/route.ts
import { bedrockClient } from "@/lib/bedrock";
import { ConverseStreamCommand, Message } from "@aws-sdk/client-bedrock-runtime";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { messages, modelId } = await req.json();

    const command = new ConverseStreamCommand({
        modelId: modelId || "anthropic.claude-3-5-sonnet-20240620-v1:0", // 기본 모델
        messages: messages as Message[],
        inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9,
        }
    });

    const response = await bedrockClient.send(command);

    // Streaming 응답 처리
    const stream = new ReadableStream({
        async start(controller) {
            // @ts-ignore
            for await (const event of response.stream) {
                if (event.contentBlockDelta) {
                    const text = event.contentBlockDelta.delta?.text || "";
                    controller.enqueue(new TextEncoder().encode(text));
                }
            }
            controller.close();
        },
    });

    return new NextResponse(stream);
}
```

---

## 🎨 4. 프론트엔드 UI 구현 (Frontend)

사용자가 채팅을 입력하고 결과를 볼 수 있는 인터페이스를 구현합니다.

### 4.1 Chat Interface 컴포넌트 (`components/chat-interface.tsx`)
채팅 상태 관리(메시지 목록, 로딩 상태 등)와 API 호출 로직을 포함합니다.

*   **주요 로직**:
    *   `messages` 상태 배열로 대화 이력 관리
    *   `fetch` API 호출 시 스트리밍(`response.body.getReader()`) 데이터 처리
    *   Shadcn UI 컴포넌트(`Card`, `Input`, `Button`)를 활용한 레이아웃

### 4.2 메인 페이지 (`app/page.tsx`)
전체 레이아웃을 잡고 배경 효과를 추가합니다.

```tsx
// app/page.tsx
import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  return (
    <main className="flex h-screen flex-col items-center justify-center relative overflow-hidden bg-[#05050A]">
      {/* 배경 데코레이션 (Aurora Effects) */}
      <div className="absolute ... bg-indigo-600/30 blur-[120px]" />
      
      <div className="z-10 w-full flex justify-center h-full">
        <ChatInterface />
      </div>
    </main>
  );
}
```

---

## 🧪 5. 실행 및 테스트

개발 서버를 실행하여 챗봇을 테스트합니다.

```bash
npm run dev
```
브라우저에서 `http://localhost:3000`에 접속하여 다음을 확인합니다:
1.  메시지 전송 및 실시간 응답(파란색 깜빡임 없이 글자가 타닥타닥 찍히는지 확인)
2.  모델 변경 기능 동작 여부
3.  초기화 버튼 동작 여부

---

## 🐳 6. (선택) Docker 환경에서 실행

이 섹션은 선택 사항(Advanced)입니다. 앞선 **5. 실행 및 테스트** 단계에서 `npm run dev`를 통해 로컬에서 성공적으로 실행했다면 이 과정은 건너뛰셔도 됩니다.

> **Docker 동작 원리 (Conceptual Understanding)**
> 1.  **가상 컴퓨터 생성 (Container)**: Docker가 리눅스(Alpine Linux)가 설치된 아주 가벼운 가상 환경을 만듭니다.
> 2.  **환경 구축 (Node.js)**: 그 안에서 `Dockerfile` 주문서에 따라 Node.js(자바스크립트 실행기)를 설치합니다.
> 3.  **Next.js 설치 및 실행**: 작성한 코드를 컨테이너로 복사하고, `npm install` 및 `npm run dev`를 수행하여 서버를 띄웁니다.
>
> 결론적으로, 내 컴퓨터(Host)에 Node.js 등 복잡한 설정이 없어도 **"도커라는 상자 안에서"** 애플리케이션이 독립적으로 실행되는 방식입니다.

로컬 환경뿐만 아니라 Docker를 사용하여 컨테이너 기반으로 애플리케이션을 실행하는 방법을 안내합니다.

### 6.1 Dockerfile 작성
`Dockerfile`은 이미지를 빌드하는 명세서입니다. Node.js 20 Alpine 버전을 기반으로 생성합니다.

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# node_modules 호환성을 위한 라이브러리 설치
RUN apk add --no-cache libc6-compat

# 소스 코드 복사
COPY . .

# 포트 개방
EXPOSE 3000

# 개발 서버 실행
CMD ["npm", "run", "dev"]
```

### 6.2 Docker Compose 설정 (`docker-compose.yml`)
AWS 자격 증명을 컨테이너 내부로 안전하게 전달하고, 개발 편의성을 위해 핫 리로딩(Volume Mount)을 설정합니다.

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bedrock-chatbot-web
    ports:
      - "3000:3000"
    volumes:
      - .:/app             # 소스 코드 변경 사항 실시간 반영
      - /app/node_modules  # 컨테이너 내부 종속성 보존
      # 호스트의 AWS 자격 증명 파일을 컨테이너의 root 경로에 읽기 전용으로 마운트
      - ${USERPROFILE}/.aws:/root/.aws:ro 
    environment:
      - WATCHPACK_POLLING=true       # 윈도우/맥 파일 변경 감지 최적화
      - AWS_PROFILE=BedrockDevUser-hyebom  # 사용할 AWS 프로필 이름 지정
      - AWS_SDK_LOAD_CONFIG=1        # 설정 파일 로드 활성화
    command: sh -c "npm install && npm run dev -- -H 0.0.0.0"
```

> **주의**: Windows 사용자의 경우 `${USERPROFILE}`을 사용하며, Mac/Linux 사용자는 `~` 또는 `$HOME`으로 변경해야 할 수 있습니다.

### 6.3 실행 및 확인

```bash
# 컨테이너 빌드 및 백그라운드 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f
```
이제 `http://localhost:3000`에 접속하여 로컬 실행과 동일하게 동작하는지 확인합니다.

---

## �📚 참고 자료 (References)

### AWS Bedrock Model IDs (서울 리전)
| 모델 이름 | Model ID |
| :--- | :--- |
| **Claude 3.5 Sonnet** | `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| **Claude 3 Haiku** | `anthropic.claude-3-haiku-20240307-v1:0` |
| **Amazon Nova Lite** | `apac.amazon.nova-lite-v1:0` |
| **Amazon Nova Micro** | `apac.amazon.nova-micro-v1:0` |

> **Note**: Nova 모델의 경우 서울 리전(`ap-northeast-2`)에서는 `apac.` 접두사가 붙은 리전 전용 ID를 사용해야 할 수 있습니다.

### 주요 라이브러리 공식 문서
- [Next.js Documentation](https://nextjs.org/docs)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
