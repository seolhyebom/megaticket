import { bedrockClient } from "@/lib/bedrock";
export const dynamic = 'force-dynamic';
import { ConverseStreamCommand, Message, ToolResultBlock, ContentBlock, ToolUseBlock, ConverseStreamCommandInput, BedrockRuntimeServiceException } from "@aws-sdk/client-bedrock-runtime";
import { NextRequest, NextResponse } from "next/server";
import { BEDROCK_TOOLS, executeTool } from "@/lib/bedrock-tools";
import {
    composeSystemPrompt,
    getState,
    updateState,
    extractContextFromMessage,
    extractContextFromToolResults,
    estimateTokenCount,
} from '@/lib/prompts';
import { ThinkingTagFilter } from "@/lib/utils/stream-filter";

import { BEDROCK_MODELS, FALLBACK_CONFIG } from "@/lib/constants/bedrock-config";

// --- Helpers ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper for Bedrock Invocation with Retry & Timeout logic
async function invokeBedrockWithRetry(
    input: ConverseStreamCommandInput,
    modelId: string,
    attempt = 1
): Promise<any> {
    const isPrimary = modelId === BEDROCK_MODELS.PRIMARY.id;
    const timeoutMs = isPrimary ? FALLBACK_CONFIG.PRIMARY_TIMEOUT_MS : FALLBACK_CONFIG.SECONDARY_TIMEOUT_MS;

    try {
        // Timeout Wrapper
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const command = new ConverseStreamCommand(input);
            const response = await bedrockClient.send(command, { abortSignal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw error;
        }

    } catch (error: any) {
        const statusCode = error.$metadata?.httpStatusCode || 500;
        const errorCode = error.name || "UnknownError";

        console.log(JSON.stringify({
            service: 'MegaTicket-Chatbot',
            event: 'BedrockInvokeError',
            model: modelId,
            attempt,
            errorCode,
            statusCode,
            // [V8.2] ValidationException 상세 원인 파악용
            errorMessage: error.message || 'No message',
            errorDetails: error.toString()
        }));

        // Check if we should retry
        if (
            attempt <= FALLBACK_CONFIG.MAX_RETRIES &&
            FALLBACK_CONFIG.RETRY_CODES.includes(statusCode)
        ) {
            const delay = FALLBACK_CONFIG.RETRY_DELAY_MS * Math.pow(FALLBACK_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt - 1);
            console.log(`Retrying ${modelId} in ${delay}ms... (Attempt ${attempt + 1})`);
            await sleep(delay);
            return invokeBedrockWithRetry(input, modelId, attempt + 1);
        }

        throw error; // Propagate to Fallback logic
    }
}


async function processConverseStream(
    messages: Message[],
    systemPrompt: string,
    controller: ReadableStreamDefaultController,
    modelId: string,
    depth = 0,
    isFallback = false
) {
    if (depth > 5) {
        console.warn("Max recursion depth reached");
        return;
    }

    const startTime = Date.now();
    let usedModel = modelId;

    const commandInput: ConverseStreamCommandInput = {
        modelId: usedModel,
        messages: messages,
        system: [{ text: systemPrompt }],
        toolConfig: { tools: BEDROCK_TOOLS },
        inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            // [V8.2] Cross-Region Inference에서는 temperature와 top_p 동시 사용 불가
            // top_p: 0.9, // 제거됨
        },
    };

    if (usedModel === BEDROCK_MODELS.PRIMARY.id && BEDROCK_MODELS.PRIMARY.supportsPromptCaching) {
        commandInput.additionalModelRequestFields = {
            "anthropic_beta": ["prompt-caching-2024-07-31"]
        };
    }

    const filter = new ThinkingTagFilter();
    let hasStreamed = false;

    try {
        const response = await invokeBedrockWithRetry(commandInput, usedModel);

        if (!response.stream) throw new Error("No stream in response");

        let stopReason = "";
        let currentToolUse: Partial<ToolUseBlock> | null = null;
        const generatedContentBlocks: ContentBlock[] = [];
        let currentText = "";

        let toolUseDetected = false;
        let textBuffer = ""; // Buffer for One Turn = One Response logic

        // [V7.14] EMF: Token Usage Capture
        let usage = { inputTokens: 0, outputTokens: 0 };

        // @ts-ignore
        for await (const event of response.stream) {
            if (event.contentBlockStart) {
                const start = event.contentBlockStart.start;
                if (start?.toolUse) {
                    toolUseDetected = true; // [V7.10] Mark tool use detected
                    currentToolUse = {
                        toolUseId: start.toolUse.toolUseId,
                        name: start.toolUse.name,
                        input: ""
                    };
                }
            }

            if (event.contentBlockDelta) {
                if (event.contentBlockDelta.delta?.text) {
                    const txt = event.contentBlockDelta.delta.text;
                    currentText += txt;

                    // [V7.12] 실시간 스트리밍 - 즉시 출력
                    if (!toolUseDetected) {
                        const filtered = filter.process(txt);
                        if (filtered) {
                            (controller as any)._generatedText = ((controller as any)._generatedText || "") + filtered;
                            controller.enqueue(new TextEncoder().encode(filtered));
                            hasStreamed = true;
                        }
                    }
                }
                if (event.contentBlockDelta.delta?.toolUse && currentToolUse) {
                    currentToolUse.input = (currentToolUse.input || "") + (event.contentBlockDelta.delta.toolUse.input || "");
                }
            }

            if (event.contentBlockStop) {
                if (currentToolUse) {
                    // Bedrock requires toolUse.input to be an object in message history.
                    // Since it's accumulated as a string from chunks, we MUST parse it.
                    if (typeof currentToolUse.input === "string") {
                        try {
                            currentToolUse.input = JSON.parse(currentToolUse.input);
                        } catch (e) {
                            console.warn(`[ToolInputParseWarning] ${currentToolUse.name}: JSON input incomplete (streaming chunk), fallback to empty object.`);
                            // Fallback to empty object if parsing fails to avoid fatal validation error
                            currentToolUse.input = {};
                        }
                    }
                    generatedContentBlocks.push({ toolUse: currentToolUse as ToolUseBlock });
                    currentToolUse = null;
                }
            }

            if (event.messageStop) {
                stopReason = event.messageStop.stopReason || "";
            }

            // [V7.14] EMF: Capture usage from metadata event
            if (event.metadata?.usage) {
                usage = {
                    inputTokens: event.metadata.usage.inputTokens ?? 0,
                    outputTokens: event.metadata.usage.outputTokens ?? 0
                };
            }
        }

        // [V7.12] 실시간 스트리밍 마무리 - 잘린 필터링 flush
        if (!toolUseDetected) {
            const remaining = filter.flush();
            if (remaining) {
                (controller as any)._generatedText = ((controller as any)._generatedText || "") + remaining;
                controller.enqueue(new TextEncoder().encode(remaining));
                hasStreamed = true;
            }
        } else {
            console.log(`[OneTurnResponse] Tool use detected, text suppressed.`);
        }

        // [V7.14] EMF: Log Success with Token Usage
        const latencyMs = Date.now() - startTime;
        // [TEST MODE] CloudWatch EMF 메트릭 비활성화 - 프로덕션 배포 시 주석 해제
        /*
        console.log(JSON.stringify({
            service: "MegaTicket-Chatbot",
            event: "BedrockInvokeSuccess",
            Model: usedModel,
            IsFallback: isFallback,
            Latency: latencyMs,
            InputTokens: usage.inputTokens,
            OutputTokens: usage.outputTokens,
            _aws: {
                Timestamp: Date.now(),
                CloudWatchMetrics: [{
                    Namespace: "MegaTicket/Bedrock",
                    Dimensions: [["Model"], ["Model", "IsFallback"]],
                    Metrics: [
                        { Name: "Latency", Unit: "Milliseconds" },
                        { Name: "InputTokens", Unit: "Count" },
                        { Name: "OutputTokens", Unit: "Count" }
                    ]
                }]
            }
        }));
        */

        // Logic for Tools
        const toolUseBlocks = generatedContentBlocks.filter(b => b.toolUse);
        if (toolUseBlocks.length > 0) {
            const assistantMessage: Message = {
                role: "assistant",
                content: []
            };
            if (currentText) assistantMessage.content?.push({ text: currentText });
            toolUseBlocks.forEach(b => assistantMessage.content?.push(b));

            const nextMessages = [...messages, assistantMessage];
            const toolResults: ToolResultBlock[] = [];

            for (const block of toolUseBlocks) {
                if (block.toolUse) {
                    const { toolUseId, name, input } = block.toolUse;
                    let parsedInput: any = {};
                    try {
                        parsedInput = typeof input === 'string' ? JSON.parse(input) : input;
                    } catch (e) {
                        console.error(`[ToolInputParseError] ${name}:`, e);
                    }

                    try {
                        const result = await executeTool(name || "unknown", parsedInput);
                        // [TEST MODE] 도구 성공 로그 비활성화 - 프로덕션 배포 시 주석 해제
                        // console.log(`[ToolSuccess] ${name} result size:`, JSON.stringify(result).length);

                        // [V8.22] FAIL-SAFE UI Injection
                        const isHoldingTool = (name === 'hold_seats' || name === 'create_holding');

                        if (isHoldingTool && result.success && result.holdingId) {
                            if (result._actionDataForResponse) {
                                // 정상 케이스
                                console.log('[UI_INJECT] ACTION_DATA found from tool result.');
                                (controller as any)._pendingActionData = result._actionDataForResponse;
                            } else {
                                // ⚠️ Fail-safe: 데이터 누락 시 강제 생성
                                console.warn('[FAIL-SAFE] ACTION_DATA missing! Generating fallback UI data.');
                                const perfId = parsedInput.performanceId || 'unknown';
                                const date = parsedInput.date || '';
                                const time = parsedInput.time || '';
                                (controller as any)._pendingActionData = generateActionData(result, perfId, date, time);
                            }
                        }

                        toolResults.push({
                            toolUseId: toolUseId || "unknown",
                            content: [{ json: result }],
                            status: "success"
                        });
                    } catch (toolError: any) {
                        console.error(`[ToolExecError] ${name}:`, toolError);
                        toolResults.push({
                            toolUseId: toolUseId || "unknown",
                            content: [{ json: { error: "도구 실행 중 오류가 발생했습니다.", details: toolError.message } }],
                            status: "error"
                        });
                    }
                }
            }

            nextMessages.push({ role: "user", content: toolResults.map(r => ({ toolResult: r })) });
            await processConverseStream(nextMessages, systemPrompt, controller, usedModel, depth + 1, isFallback);

            // [V8.17 FIX] 재귀 완료 후 depth 관계없이 pendingActionData 스트림 주입
            // (재귀 가장 마지막에 실행되므로 AI 응답 끝에 추가됨)
            const pendingActionData = (controller as any)._pendingActionData;
            // [V8.22] 중복 주입 방지 Check
            const fullText = (controller as any)._generatedText || "";

            if (pendingActionData && !fullText.includes('[[ACTION_DATA]]')) {
                console.log('[AUTO_INJECT] Appending ACTION_DATA to stream (depth=' + depth + ')');
                controller.enqueue(new TextEncoder().encode('\n\n' + pendingActionData));
                (controller as any)._pendingActionData = null; // 중복 방지
            } else if (pendingActionData) {
                console.log('[UI_INJECT] Injection skipped - ACTION_DATA already exists.');
                (controller as any)._pendingActionData = null;
            }
        }

    } catch (e: any) {
        // Fallback Logic
        if (depth === 0 && !isFallback && !hasStreamed) {
            const statusCode = e.$metadata?.httpStatusCode || 500;
            const isValidFallbackTrigger =
                FALLBACK_CONFIG.IMMEDIATE_FALLBACK_CODES.includes(statusCode) ||
                FALLBACK_CONFIG.RETRY_CODES.includes(statusCode) ||
                e.name === 'TimeoutError' || e.name === 'ModelTimeoutException'; // AbortSignal timeout

            if (isValidFallbackTrigger) {
                // [TEST MODE] Fallback EMF 메트릭 비활성화 - 프로덕션 배포 시 주석 해제
                /*
                console.warn(JSON.stringify({
                    service: "MegaTicket-Chatbot",
                    event: "FallbackTriggered",
                    primaryModel: BEDROCK_MODELS.PRIMARY.id,
                    fallbackModel: BEDROCK_MODELS.SECONDARY.id,
                    Reason: e.name || "Unknown",
                    statusCode: statusCode,
                    FallbackCount: 1,
                    _aws: {
                        Timestamp: Date.now(),
                        CloudWatchMetrics: [{
                            Namespace: "MegaTicket/Bedrock",
                            Dimensions: [["Reason"]],
                            Metrics: [
                                { Name: "FallbackCount", Unit: "Count" }
                            ]
                        }]
                    }
                }));
                */

                await processConverseStream(messages, systemPrompt, controller, BEDROCK_MODELS.SECONDARY.id, depth + 1, true);
                return;
            }
        }

        console.error("[Stream Error]", e);
        if (!hasStreamed) {
            const errorMsg = "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            controller.enqueue(new TextEncoder().encode(errorMsg));
        }
    }
}

// [V8.22] Helper for Fail-safe UI Data Generation
function generateActionData(result: any, performanceId: string, date: string, time: string) {
    const region = process.env.AWS_REGION || 'ap-northeast-2';
    const expiresAt = result.expiresAt || new Date(Date.now() + 600 * 1000).toISOString();
    const holdingId = result.holdingId;

    // URL 생성
    const payUrl = `/reservation/confirm?holdingId=${holdingId}&expiresAt=${encodeURIComponent(expiresAt)}&region=${region}`;
    const seatMapUrl = `/performances/${performanceId}/seats?date=${date}&time=${time}&region=${region}`;

    // JSON 구성
    const data = {
        timer: {
            expiresAt,
            holdingId,
            message: "선점 시간 (Fail-safe Generated)",
            warningThreshold: 30
        },
        actions: [
            { id: "pay", label: "결제 진행", action: "navigate", url: payUrl, target: "_blank", style: "primary" },
            { id: "cancel", label: "선점 취소", action: "send", text: "선점 취소할래", style: "danger" },
            { id: "seat_map", label: "좌석 배치도 보기", action: "navigate", url: seatMapUrl, target: "_blank", style: "default" }
        ]
    };

    return `[[ACTION_DATA]]\n${JSON.stringify(data)}\n[[/ACTION_DATA]]`;
}

export async function POST(req: NextRequest) {
    try {
        const { messages, userId, modelId, sessionId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
        }

        // [V7.11] 세션 종료/빈 메시지 검증 - Bedrock 호출 전 차단하여 Fallback 미발동 및 메트릭 오염 방지
        if (messages.length === 0) {
            return NextResponse.json({
                error: "세션이 종료되었습니다.",
                sessionExpired: true
            }, { status: 400 });
        }

        // 마지막 메시지가 비어있는지 확인
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage?.content || (Array.isArray(lastMessage.content) && lastMessage.content.length === 0)) {
            return NextResponse.json({
                error: "빈 메시지는 전송할 수 없습니다.",
                sessionExpired: true
            }, { status: 400 });
        }

        // [V8.0] 세션 상태 기반 프롬프트 조립
        const effectiveSessionId = sessionId || `anonymous_${Date.now()}`;
        const state = getState(effectiveSessionId);

        // 마지막 사용자 메시지에서 컨텍스트 추출
        const lastUserText = lastMessage?.content?.[0]?.text || lastMessage?.content || '';
        const messageContext = extractContextFromMessage(state.currentStep, lastUserText as string);

        // 단계별 시스템 프롬프트 조립
        let systemPromptText = composeSystemPrompt(
            state.currentStep,
            { ...state.context, ...messageContext }
        );

        // 기존 컨텍스트 추가 (userId, 시간)
        if (userId) systemPromptText += `\n\n[User Context]\n- Current User ID: "${userId}"`;
        systemPromptText += `\n\n[Current Time]: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

        // [V8.0] 토큰 추정 로깅 (CloudWatch EMF 형식)
        const estimatedTokens = estimateTokenCount(systemPromptText);
        // [TEST MODE] 프롬프트 구성 로그 비활성화 - 프로덕션 배포 시 주석 해제
        /*
        console.log(JSON.stringify({
            service: "MegaTicket-Chatbot",
            event: "PromptComposed",
            sessionId: effectiveSessionId,
            currentStep: state.currentStep,
            estimatedTokens,
            contextSize: Object.keys(state.context).length,
        }));
        */

        // Model Selection Logic
        let initialModel = modelId || BEDROCK_MODELS.PRIMARY.id;

        const headers = new Headers({
            "Content-Type": "text/plain; charset=utf-8",
            "X-Bedrock-Region": process.env.AWS_REGION || "ap-northeast-2",
            "X-Bedrock-Model": initialModel,
            "X-Bedrock-Fallback": "false"
        });

        const stream = new ReadableStream({
            async start(controller) {
                await processConverseStream(messages, systemPromptText, controller, initialModel);

                // [V8.23 FIX] 스트림 종료 직전 최종 안전장치: pendingActionData가 남아있으면 강제 주입
                const pendingActionData = (controller as any)._pendingActionData;
                const fullText = (controller as any)._generatedText || "";

                if (pendingActionData && !fullText.includes('[[ACTION_DATA]]')) {
                    console.log('[FINAL_INJECT] ACTION_DATA injected at stream close');
                    controller.enqueue(new TextEncoder().encode('\n\n' + pendingActionData));
                    (controller as any)._pendingActionData = null;
                }

                controller.close();
            },
        });

        return new NextResponse(stream, { headers });

    } catch (error: any) {
        console.error("Chat API Fatal Error Details:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        }); // [V7.9] Enhanced Logging
        return NextResponse.json(
            { error: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
            { status: 500 }
        );
    }
}

