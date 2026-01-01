// performances 테이블에서 sections 필드를 제거하는 스크립트
// venues 테이블에 sections가 이미 있으므로 중복 제거

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = process.argv[2] || "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";

async function removeSectionsField() {
    console.log("🔍 Scanning performances table...");

    const result = await docClient.send(new ScanCommand({
        TableName: PERFORMANCES_TABLE
    }));

    if (!result.Items || result.Items.length === 0) {
        console.log("❌ No performances found.");
        return;
    }

    console.log(`📋 Found ${result.Items.length} performances`);

    let updated = 0;
    for (const perf of result.Items) {
        const performanceId = perf.performanceId;

        if (perf.sections) {
            console.log(`  Removing sections from: ${performanceId}`);

            await docClient.send(new UpdateCommand({
                TableName: PERFORMANCES_TABLE,
                Key: { performanceId: performanceId },
                UpdateExpression: "REMOVE sections",
            }));

            updated++;
        }
    }

    console.log(`\n✅ Done! Removed sections field from ${updated} performances.`);
}

removeSectionsField().catch(console.error);
