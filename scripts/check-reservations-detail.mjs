// 예약 데이터 상세 확인 스크립트
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const region = process.argv[2] || "ap-northeast-2";
const userId = process.argv[3] || "mock-user-01";

console.log(`\n🔍 Checking reservations in ${region} for user: ${userId}\n`);

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

try {
    const result = await docClient.send(new QueryCommand({
        TableName: "KDT-Msp4-PLDR-reservations",
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
            ":uid": userId
        }
    }));

    console.log(`📋 Found ${result.Items?.length || 0} items:\n`);

    // 상태별 그룹화
    const statusGroups = {};

    if (result.Items && result.Items.length > 0) {
        result.Items.forEach((item) => {
            const status = item.status || 'unknown';
            if (!statusGroups[status]) {
                statusGroups[status] = [];
            }
            statusGroups[status].push(item);
        });

        console.log("📊 Status breakdown:");
        Object.entries(statusGroups).forEach(([status, items]) => {
            console.log(`   ${status}: ${items.length} items`);
        });

        console.log("\n📝 CONFIRMED items (first 5):");
        const confirmedItems = statusGroups['CONFIRMED'] || [];
        confirmedItems.slice(0, 5).forEach((item, idx) => {
            console.log(`[${idx + 1}] reservationId: ${item.reservationId}`);
            console.log(`    performanceTitle: ${item.performanceTitle}`);
            console.log(`    seatId: ${item.seatId}`);
            console.log(`    date: ${item.date}, time: ${item.time}`);
            console.log('');
        });
    } else {
        console.log("❌ No reservations found.");
    }
} catch (error) {
    console.error("Error:", error.message);
}
