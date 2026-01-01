// 예약 데이터 확인 스크립트
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

    if (result.Items && result.Items.length > 0) {
        result.Items.forEach((item, idx) => {
            console.log(`[${idx + 1}] reservationId: ${item.reservationId}`);
            console.log(`    status: ${item.status}`);
            console.log(`    performanceTitle: ${item.performanceTitle}`);
            console.log(`    seatId: ${item.seatId}`);
            console.log(`    date: ${item.date}, time: ${item.time}`);
            console.log('');
        });
    } else {
        console.log("❌ No reservations found for this user in this region.");
    }
} catch (error) {
    console.error("Error:", error.message);
}
