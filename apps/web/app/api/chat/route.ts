import { bedrockClient } from "@/lib/bedrock";
import { searchPerformances } from "@/lib/rag";
import { ConverseStreamCommand, Message, ToolResultBlock, ContentBlock, ToolUseBlock } from "@aws-sdk/client-bedrock-runtime";
import { NextRequest, NextResponse } from "next/server";
import { BEDROCK_TOOLS, executeTool } from "@/lib/bedrock-tools";

// System prompt as defined in requirements
const BASE_SYSTEM_PROMPT = `당신은 유용한 AI 어시스턴트입니다. 
당신은 사용자의 질문에 대해 친절하고 정확하게 답변해야 합니다. 
만약 답변에 확신이 없다면, 솔직하게 모른다고 대답하세요.
Markdown 형식을 사용하여 가독성 좋은 답변을 제공하세요.

[중요 기능 안내]
- 당신은 공연 좌석 조회, 좌석 선점(Holding), 예약 확정 도구를 사용할 수 있습니다.
- 좌석 선점(create_holding)은 **1분간만 유지(TTL 1분)**됨을 사용자에게 명확히 안내해야 합니다.

[공연 정보 사용 규칙 - 매우 중요]
- **도구 호출 시 반드시 [Performance Data]에서 제공된 <id>, <date>, <time> 값을 사용하세요!**
- 예: 킹키부츠 2월 10일 → performanceId: "perf-kinky-1", date: "2026-02-10", time: "19:30"
- **절대로 performanceId를 추측하거나 "perf-1" 같은 다른 ID를 사용하지 마세요.**
- 공연명으로 검색하여 [Performance Data]에서 해당 공연의 정확한 id를 찾아 사용하세요.

[좌석 형식 안내 - 매우 중요]
- 현재 공연장(샤롯데시어터)의 좌석 ID 형식: "1층-B-2-21" (층-구역-열-좌석번호)
- 사용자에게 좌석을 안내할 때는 반드시 다음 형식으로 표시하세요:
  - 예시: "1층 B구역 2열 21번 ~ 24번" 또는 "2층 A구역 3열 5번, 6번"
- 구역: 1층은 A, B, C 구역, 2층은 D, E, F 구역입니다. (B, E 구역이 무대 정면)
- 좌석 등급: OP석(17만원), VIP석(17만원), R석(14만원), S석(11만원), A석(8만원)
- **[필독] 정확한 좌석 등급 판단을 위해 도구 출력의 "좌석 등급 분포"를 반드시 참조하세요.**
  - 예: "B구역 1~10열"이 VIP석인 경우, 7열을 R석이라고 안내하면 안 됩니다.

[샤롯데시어터 좌석 배치도 - 좌석 번호 기준]
- **B, E구역 (정면)**: 각 열마다 15번 ~ 30번 좌석 (총 16석)
  - 왼쪽 통로 쪽: 15~18번
  - **가운데**: 20~25번 (권장)
  - 오른쪽 통로 쪽: 27~30번
- **A, D구역 (좌측)**: 각 열마다 5번 ~ 14번 좌석
  - 통로 쪽: 5~7번
  - 가운데: 9~12번
- **C, F구역 (우측)**: 각 열마다 31번 ~ 40번 좌석
  - 가운데: 33~36번
  - 통로 쪽: 38~40번
- **"가운데 좌석"** 요청 시: B/E구역 20~25번 좌석 추천
- **"통로 쪽 좌석"** 요청 시: 각 구역의 끝 번호 좌석 추천


[좌석 조회 및 추천 절차 (필수 준수)]
1. 먼저 사용자가 선택한 공연의 **등급별 가격과 잔여석 정보**를 요약해서 알려주세요.
2. 그 다음, **"몇 분이서 관람하시나요? (최대 4매까지 가능)"** 라고 먼저 물어보세요.
3. 인원을 확인한 후, **"어떤 등급의 좌석을 원하시나요?"** 라고 물어보세요.
4. **[중요] 좌석 추천 시 절대로 좌석 번호를 추측하지 마세요!**
   - 반드시 \`get_ticket_availability\` 도구의 결과에 포함된 \`recommendedOptions\` (또는 \`recommendedSeats\`, \`centerSeats\`) 데이터를 사용하세요.
   - **다중 추천 제공**: \`recommendedOptions\`에 여러 개의 옵션이 있다면, 사용자가 선택할 수 있도록 **상위 3개 옵션**을 번호 매겨 목록으로 제시하세요.
     - 예: 
       1. 2층 E구역 4열 20~22번 (가운데, 11만원)
       2. 2층 E구역 5열 20~22번 (가운데, 11만원)
       3. 2층 E구역 6열 20~22번 (가운데, 11만원)
   - 만약 옵션이 하나뿐이라면 하나만 추천해도 좋습니다.
   - **"가운데 좌석" 요청 시:** \`recommendedOptions\` 내의 \`label: '가운데'\` 항목을 우선적으로 보여주세요.
   - **[필수] 특정 위치(예: "3열") 요청 시:**
     - 만약 \`recommendedOptions\`에 해당 위치가 없다면, 반드시 \`availableRows\` 데이터를 확인하세요.
     - \`availableRows\`에 해당 열이 존재하면(예: "VIP석 3열(4석)"), "추천 목록에는 없지만 3열에도 좌석이 남아있습니다."라고 안내하고 예약을 진행해 주세요.
     - 절대 "좌석이 없다"고 거짓 안내를 하지 마세요.
5. 사용자가 특정 옵션을 선택하면 그제서야 \`create_holding\` 도구로 선점(Holding)을 진행하세요.
   - **create_holding 호출 시에도 선택된 옵션의 \`seats\` 배열(실제 좌석 ID 목록)을 정확히 사용하세요.**

[주의사항 (Hallucination 및 오류 방지)]
- **절대 금지:** 좌석 번호를 추측하거나 만들어내지 마세요. 반드시 도구 결과의 실제 데이터만 사용하세요.
- 사용자가 "R석" 등 **좌석 등급**을 언급했을 때, 이를 **좌석 번호**로 착각하여 존재하지 않는 좌석을 만들어내지 마십시오.
- **도구 출력의 "좌석 등급 분포"를 무시하고 엉뚱한 등급의 좌석을 추천하지 마십시오.** (예: VIP석 구역의 좌석을 R석으로 추천 금지)
- 사용자의 요청이 "좌석 등급"인지 "특정 좌석 번호"인지 모호하다면, 추측하지 말고 확인 질문을 하십시오.
- \`create_holding\` 성공은 예약 완료가 아닙니다. **"선점"** 상태일 뿐입니다.

[좌석 선점 후 안내]
- "선점이 완료되었습니다. 1분 내에 '예약 확정'이라고 말씀해 주세요."라고 안내하십시오.
- **[중요]** 좌석 선점이 완료되면 UI에 **[좌석 배치도 보기] 버튼**이 자동으로 표시됩니다. **절대로 텍스트 링크(Markdown link)를 생성하여 제공하지 마십시오.** (예: "[좌석 배치도 보기](...)" 금지)
- 오직 텍스트로만 선점 완료 사실과 주의사항을 안내하십시오.
- 예약 확정 요청이 오면 \`confirm_reservation\` 도구를 사용하세요.

[좌석 변경 요청 시 처리 절차 (엄격 준수)]
1. **새로운 좌석 확인(검증)**: 먼저 변경하려는 새로운 좌석(등급/위치)이 가용한지 \`get_ticket_availability\` 등으로 확인하십시오.
2. **변경 진행 안내**: 가용성이 확인되면, "원하시는 좌석이 확인되었습니다. 기존 좌석 선점을 해제하고 변경을 진행하겠습니다."라고 안내하십시오.
3. **해제 수행**: 기존 선점 건에 대해 \`release_holding\`을 수행하십시오.
4. **재선점 수행**: 해제가 완료된 후, 즉시 새로운 좌석에 대해 \`create_holding\`을 수행하십시오.
5. **결과 안내**: "이전 좌석의 선점을 해제하고, 새로운 좌석을 선점했습니다."라고 명확히 안내하십시오.`;

async function processConverseStream(
    messages: Message[],
    systemPrompt: string,
    controller: ReadableStreamDefaultController,
    depth = 0
) {
    if (depth > 5) {
        console.warn("Max recursion depth reached");
        return;
    }

    const command = new ConverseStreamCommand({
        modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        messages: messages,
        system: [{ text: systemPrompt }],
        toolConfig: { tools: BEDROCK_TOOLS },
        inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9,
        },
    });

    try {
        const response = await bedrockClient.send(command);

        if (!response.stream) throw new Error("No stream in response");

        let stopReason = "";

        // Track blocks to reconstruct the assistant's message
        // ConverseStream sends parts. We need to assemble them.
        // Simplified Logic: We will accumulate text for streaming, and tool use details for execution.
        let currentToolUse: Partial<ToolUseBlock> | null = null;
        const generatedContentBlocks: ContentBlock[] = [];
        let currentText = "";

        // @ts-ignore
        for await (const event of response.stream) {
            // 1. Block Start
            if (event.contentBlockStart) {
                if (event.contentBlockStart.start?.toolUse) {
                    currentToolUse = event.contentBlockStart.start.toolUse;
                } else {
                    currentToolUse = null; // Text block start
                }
            }

            // 2. Block Delta
            if (event.contentBlockDelta) {
                if (event.contentBlockDelta.delta?.text) {
                    const txt = event.contentBlockDelta.delta.text;
                    currentText += txt;
                    // Stream text to client
                    controller.enqueue(new TextEncoder().encode(txt));
                }
                if (event.contentBlockDelta.delta?.toolUse && currentToolUse) {
                    // Accumulate JSON input string
                    currentToolUse.input = (currentToolUse.input || "") + event.contentBlockDelta.delta.toolUse.input;
                }
            }

            // 3. Block Stop
            if (event.contentBlockStop) {
                if (currentToolUse) {
                    // Finalize Tool Use Block
                    try {
                        // Input comes as string, need to ensure it's valid for history
                        // But for history 'input' should be JSON object (document-like) or string?
                        // SDK types say `input: any`.
                        // However, when *receiving* from stream, it is string partials.
                        // We must parse it to store in `generatedContentBlocks` as a proper object if needed, 
                        // OR keep as is. The Message format expects parsed JSON in `input`.
                        if (typeof currentToolUse.input === 'string') {
                            currentToolUse.input = JSON.parse(currentToolUse.input);
                        }
                        generatedContentBlocks.push({ toolUse: currentToolUse as ToolUseBlock });
                        currentToolUse = null;
                    } catch (e) {
                        console.error("Failed to parse tool input json", e);
                    }
                } else if (currentText) {
                    generatedContentBlocks.push({ text: currentText });
                    currentText = "";
                }
            }

            // 4. Message Stop
            if (event.messageStop) {
                stopReason = event.messageStop.stopReason || "";
            }
        }

        // Add the assistant's response to history
        if (generatedContentBlocks.length > 0) {
            messages.push({ role: 'assistant', content: generatedContentBlocks });
        }

        // Handle Tool Use
        if (stopReason === 'tool_use') {
            const toolResults: ToolResultBlock[] = [];

            // Collect all actions to inject (Release + Create supported)
            const actionsToInject: any[] = [];

            for (const block of generatedContentBlocks) {
                if (block.toolUse) {
                    const toolName = block.toolUse.name;
                    const toolInput = block.toolUse.input;
                    const toolUseId = block.toolUse.toolUseId;

                    if (toolName && toolUseId) {
                        // Execute
                        const result = await executeTool(toolName, toolInput);

                        // Capture metadata if release_holding
                        if (toolName === 'release_holding' && result.success) {
                            actionsToInject.push({
                                type: "HOLDING_RELEASED",
                                holdingId: result.holdingId // Now available from tool result
                            });
                        }

                        // Capture metadata if create_holding
                        // Capture metadata if create_holding
                        if (toolName === 'create_holding') {
                            // [Fix] Inject auto-released holdings first (Run even if create failed)
                            if (result.releasedHoldings && Array.isArray(result.releasedHoldings)) {
                                result.releasedHoldings.forEach((releasedId: string) => {
                                    actionsToInject.push({
                                        type: "HOLDING_RELEASED",
                                        holdingId: releasedId
                                    });
                                });
                            }

                            // Only inject created if success
                            if (result.success) {
                                const expiresAtTime = new Date(result.expiresAt).getTime();
                                const nowTime = Date.now();
                                const remainingMs = expiresAtTime - nowTime;

                                actionsToInject.push({
                                    type: "HOLDING_CREATED",
                                    holdingId: result.holdingId,
                                    expiresAt: result.expiresAt,
                                    remainingMs: remainingMs > 0 ? remainingMs : 60000, // Fallback to 60s if invalid
                                    seatMapUrl: result.seatMapUrl
                                });
                            }
                        }

                        // Capture metadata if confirm_reservation
                        if (toolName === 'confirm_reservation' && result.success) {
                            actionsToInject.push({
                                type: "RESERVATION_CONFIRMED",
                                reservationId: result.reservationId
                            });
                        }

                        toolResults.push({
                            toolUseId: toolUseId,
                            content: [{ json: result }]
                        });
                    }
                }
            }

            if (toolResults.length > 0) {
                // Add tool results to history
                messages.push({ role: 'user', content: toolResults.map(r => ({ toolResult: r })) });

                // Inject ACTION_DATA immediately for THIS turn's tools (e.g. Release)
                // This ensures "Release" event is streamed BEFORE the recursive call generates the "Create" event.
                if (actionsToInject.length > 0) {
                    for (const actionData of actionsToInject) {
                        // Recalculate remainingMs for created holdings
                        if (actionData.expiresAt) {
                            const expiresAtTime = new Date(actionData.expiresAt).getTime();
                            const nowTime = Date.now();
                            const remainingMs = expiresAtTime - nowTime;
                            actionData.remainingMs = remainingMs > 0 ? remainingMs : 0;
                        }

                        // Stream each action individually with a small delay to ensure UI updates are perceived
                        const metadataString = `\n<!-- ACTION_DATA: ${JSON.stringify(actionData)} -->`;
                        controller.enqueue(new TextEncoder().encode(metadataString));

                        // Add 1000ms delay between actions (e.g. Release -> Create) so user clearly sees the transition
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            // Recurse to generate next steps (e.g. Create holding text + action)
            await processConverseStream(messages, systemPrompt, controller, depth + 1);
        }
    } catch (e) {
        console.error("Stream Loop Error:", e);
        controller.error(e);
    }
}

export async function POST(req: NextRequest) {
    try {
        const { messages, modelId, userId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            );
        }

        // RAG Injection
        let systemPromptText = BASE_SYSTEM_PROMPT;

        // Inject User Context (for Booking)
        if (userId) {
            systemPromptText += `\n\n[User Context]\n- Current User ID: "${userId}"\n- 도구 호출 시 create_holding 등의 userId 필드에 이 값을 사용하세요.`;
        }

        // Inject Current Time
        systemPromptText += `\n\n[Current Time]: ${new Date().toISOString()}`;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            let query = "";
            if (typeof lastMessage.content === 'string') {
                query = lastMessage.content;
            } else if (Array.isArray(lastMessage.content)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = lastMessage.content.map((c: any) => c.text || "").join(" ");
            }

            if (query) {
                const context = await searchPerformances(query);
                if (context) {
                    systemPromptText += `\n\n[Performance Data]\n${context}`;
                    console.log("RAG Context injected");
                }
            }
        }

        const stream = new ReadableStream({
            async start(controller) {
                await processConverseStream(messages, systemPromptText, controller);
                controller.close();
            },
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
        });

    } catch (error: any) {
        console.error("Bedrock API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
