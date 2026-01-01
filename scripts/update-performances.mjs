// performances 테이블 필드 업데이트 스크립트
// venue 비정규화 필드 추가, schedules 필드 제거

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";

async function updatePerformances() {
    console.log("🔍 Scanning performances table...");

    const result = await docClient.send(new ScanCommand({
        TableName: PERFORMANCES_TABLE
    }));

    if (!result.Items || result.Items.length === 0) {
        console.log("❌ No performances found.");
        return;
    }

    for (const perf of result.Items) {
        console.log(`\n📦 Processing performance: ${perf.performanceId}`);
        console.log(`  Current fields: ${Object.keys(perf).join(", ")}`);

        // Check if venue field exists
        const hasVenue = !!perf.venue;
        const hasSchedules = !!perf.schedules;

        console.log(`  venue field: ${hasVenue ? "✅ exists" : "❌ missing"}`);
        console.log(`  schedules field: ${hasSchedules ? "⚠️ exists (should remove)" : "✅ not present"}`);

        // Update: Add venue, remove schedules if exists
        let updateExpression = "SET venue = :venue";
        const expressionAttributeValues = {
            ":venue": "샤롯데씨어터"
        };

        if (hasSchedules) {
            updateExpression += " REMOVE schedules";
        }

        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: perf.performanceId },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues
        }));

        console.log(`  ✅ Updated performance: ${perf.performanceId}`);
    }

    console.log("\n✅ Performances update complete!");
}

updatePerformances().catch(console.error);
