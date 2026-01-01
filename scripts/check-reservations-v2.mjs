// 예약 데이터 상세 확인 스크립트 v2
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import fs from 'fs';

const region = process.argv[2] || "ap-northeast-2";
const userId = process.argv[3] || "mock-user-01";

console.log(`Checking ${region} for ${userId}...`);

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

    const items = result.Items || [];

    // 상태별 그룹화
    const statusGroups = {};
    items.forEach((item) => {
        const status = item.status || 'unknown';
        if (!statusGroups[status]) {
            statusGroups[status] = 0;
        }
        statusGroups[status]++;
    });

    const output = {
        region,
        userId,
        totalCount: items.length,
        statusBreakdown: statusGroups,
        confirmedItems: items.filter(i => i.status === 'CONFIRMED').slice(0, 3).map(i => ({
            reservationId: i.reservationId,
            performanceTitle: i.performanceTitle,
            date: i.date,
            time: i.time,
            seatId: i.seatId
        }))
    };

    // 출력과 파일 저장
    console.log(JSON.stringify(output, null, 2));
    fs.writeFileSync(`reservation-check-${region}.json`, JSON.stringify(output, null, 2));
} catch (error) {
    console.error("Error:", error.message);
}
