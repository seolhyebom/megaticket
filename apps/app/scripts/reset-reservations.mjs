/**
 * V7.14: 예약 테이블 초기화 및 캐시 버전 업데이트 스크립트
 * 
 * 사용법: npx tsx apps/app/scripts/reset-reservations.mjs
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const RESERVATIONS_TABLE = process.env.DYNAMODB_RESERVATIONS_TABLE || "KDT-Msp4-PLDR-reservations";

async function deleteAllReservations() {
    console.log("🗑️ 기존 예약/선점 데이터 삭제 시작...\n");

    try {
        // 모든 항목 스캔
        const result = await docClient.send(new ScanCommand({
            TableName: RESERVATIONS_TABLE
        }));

        const items = result.Items || [];
        console.log(`📊 총 ${items.length}개의 레코드 발견\n`);

        if (items.length === 0) {
            console.log("✅ 삭제할 레코드가 없습니다.");
            return;
        }

        // 각 항목 삭제
        let deleted = 0;
        for (const item of items) {
            await docClient.send(new DeleteCommand({
                TableName: RESERVATIONS_TABLE,
                Key: { PK: item.PK, SK: item.SK }
            }));
            deleted++;

            // 진행 상황 출력
            if (deleted % 10 === 0 || deleted === items.length) {
                console.log(`   삭제 중... ${deleted}/${items.length}`);
            }
        }

        console.log(`\n✅ ${deleted}개의 레코드가 삭제되었습니다.`);

    } catch (e) {
        console.error("❌ 오류 발생:", e);
    }
}

async function main() {
    console.log("=".repeat(50));
    console.log("V7.14: 예약 테이블 초기화");
    console.log("=".repeat(50) + "\n");

    await deleteAllReservations();

    console.log("\n" + "=".repeat(50));
    console.log("📌 캐시 초기화 안내:");
    console.log("   - 서버 재시작 시 인메모리 캐시 자동 초기화");
    console.log("   - 또는 performance-service.ts의 캐시 버전 증가");
    console.log("     (현재: v83 → v84, v80 → v81)");
    console.log("=".repeat(50));
}

main();
