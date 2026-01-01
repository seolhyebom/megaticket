/**
 * migrate-performances-status.mjs
 * 
 * performances 테이블의 모든 기존 데이터에 status: "ACTIVE" 속성을 추가하는 마이그레이션 스크립트
 * 
 * 왜 필요한가?
 * - V7.17에서 getAllPerformances() 쿼리 최적화를 위해 status-index GSI가 추가됨
 * - 기존 공연 데이터에는 status 필드가 없어 GSI 쿼리 결과에 포함되지 않음
 * - 따라서 기존 모든 레코드에 status: "ACTIVE"를 추가해야 함
 * 
 * 사용법:
 *   node scripts/migrate-performances-status.mjs                    # 드라이런 (실제 변경 없음)
 *   node scripts/migrate-performances-status.mjs --execute          # 실제 마이그레이션 실행
 *   node scripts/migrate-performances-status.mjs --rollback         # 롤백 (status 속성 제거)
 *   node scripts/migrate-performances-status.mjs --rollback --execute
 * 
 * 환경변수:
 *   AWS_PROFILE: AWS 프로필 (기본: BedrockDevUser-hyebom)
 *   AWS_REGION: AWS 리전 (기본: ap-northeast-2)
 *   DYNAMODB_PERFORMANCES_TABLE: 테이블명 (기본: KDT-Msp4-PLDR-performances)
 * 
 * @version V7.18
 * @date 2026-01-01
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

// ═══════════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════════
const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TABLE_NAME = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";
const STATUS_VALUE = "ACTIVE";

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--execute");
const ROLLBACK = args.includes("--rollback");

// ═══════════════════════════════════════════════════════════════
// DynamoDB 클라이언트 초기화
// ═══════════════════════════════════════════════════════════════
let clientConfig = { region: REGION };

// 로컬 개발 환경에서 AWS 프로필 사용
try {
    const profile = process.env.AWS_PROFILE || "BedrockDevUser-hyebom";
    clientConfig.credentials = fromIni({ profile });
    console.log(`📝 Using AWS profile: ${profile}`);
} catch (e) {
    console.log("⚠️ No AWS profile found, using default credentials");
}

const dynamoDbClient = new DynamoDBClient(clientConfig);
const dynamoDb = DynamoDBDocumentClient.from(dynamoDbClient);

// ═══════════════════════════════════════════════════════════════
// 메인 마이그레이션 함수
// ═══════════════════════════════════════════════════════════════
async function migrate() {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  performances 테이블 status 필드 마이그레이션");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log(`📌 테이블: ${TABLE_NAME}`);
    console.log(`📌 리전: ${REGION}`);
    console.log(`📌 모드: ${DRY_RUN ? "🔍 드라이런 (실제 변경 없음)" : "🚀 실행 모드"}`);
    console.log(`📌 작업: ${ROLLBACK ? "❌ 롤백 (status 제거)" : "✅ 마이그레이션 (status: ACTIVE 추가)"}`);
    console.log("\n");

    try {
        // 1. 전체 스캔
        console.log("📊 Step 1: 테이블 스캔 중...");
        let items = [];
        let lastEvaluatedKey = undefined;

        do {
            const scanResult = await dynamoDb.send(new ScanCommand({
                TableName: TABLE_NAME,
                ExclusiveStartKey: lastEvaluatedKey
            }));

            if (scanResult.Items) {
                items.push(...scanResult.Items);
            }
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`   ✅ 총 ${items.length}개 레코드 발견\n`);

        // 2. 마이그레이션 대상 필터링
        let targetItems;
        if (ROLLBACK) {
            // 롤백: status 필드가 있는 항목만
            targetItems = items.filter(item => item.status !== undefined);
            console.log(`📊 Step 2: 롤백 대상 (status 필드 있음): ${targetItems.length}개\n`);
        } else {
            // 마이그레이션: status 필드가 없거나 ACTIVE가 아닌 항목
            targetItems = items.filter(item => item.status !== STATUS_VALUE);
            console.log(`📊 Step 2: 마이그레이션 대상 (status 없음/다름): ${targetItems.length}개\n`);
        }

        if (targetItems.length === 0) {
            console.log("✨ 변경이 필요한 레코드가 없습니다. 마이그레이션 완료!\n");
            return;
        }

        // 3. 변경 미리보기
        console.log("📋 Step 3: 변경 대상 목록:");
        console.log("─────────────────────────────────────────────────────────");
        targetItems.forEach((item, idx) => {
            const currentStatus = item.status || "(없음)";
            const newStatus = ROLLBACK ? "(삭제)" : STATUS_VALUE;
            console.log(`   ${idx + 1}. ${item.performanceId} (${item.title || "제목 없음"})`);
            console.log(`      현재 status: ${currentStatus} → 변경 후: ${newStatus}`);
        });
        console.log("─────────────────────────────────────────────────────────\n");

        // 4. 드라이런이면 여기서 종료
        if (DRY_RUN) {
            console.log("⚠️  드라이런 모드입니다. 실제 변경은 수행되지 않았습니다.");
            console.log("   실제 마이그레이션을 수행하려면 --execute 플래그를 추가하세요.\n");
            console.log("   예: node scripts/migrate-performances-status.mjs --execute\n");
            return;
        }

        // 5. 실제 마이그레이션 수행
        console.log("📊 Step 4: 마이그레이션 수행 중...");
        let successCount = 0;
        let errorCount = 0;

        for (const item of targetItems) {
            try {
                if (ROLLBACK) {
                    // 롤백: status 속성 제거
                    await dynamoDb.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { performanceId: item.performanceId },
                        UpdateExpression: "REMOVE #status",
                        ExpressionAttributeNames: { "#status": "status" }
                    }));
                } else {
                    // 마이그레이션: status = "ACTIVE" 설정
                    await dynamoDb.send(new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { performanceId: item.performanceId },
                        UpdateExpression: "SET #status = :status",
                        ExpressionAttributeNames: { "#status": "status" },
                        ExpressionAttributeValues: { ":status": STATUS_VALUE }
                    }));
                }
                successCount++;
                console.log(`   ✅ ${item.performanceId}`);
            } catch (e) {
                errorCount++;
                console.log(`   ❌ ${item.performanceId}: ${e.message}`);
            }
        }

        console.log("\n");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("  마이그레이션 완료!");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log(`   ✅ 성공: ${successCount}개`);
        if (errorCount > 0) {
            console.log(`   ❌ 실패: ${errorCount}개`);
        }
        console.log("\n");

    } catch (error) {
        console.error("\n❌ 마이그레이션 중 오류 발생:", error.message);
        console.error(error);
        process.exit(1);
    }
}

// 실행
migrate();
