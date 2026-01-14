import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });

async function fixPrices() {
    // 지킬앤하이드 가격 수정: VIP 170000, R 140000
    console.log("Fixing perf-jekyll-hyde prices...");

    await client.send(new UpdateItemCommand({
        TableName: "plcr-gtbl-performances",
        Key: { performanceId: { S: "perf-jekyll-hyde" } },
        UpdateExpression: "SET price = :p, seatGrades = :sg",
        ExpressionAttributeValues: {
            ":p": { S: "VIP석 170,000원 / R석 140,000원" },
            ":sg": {
                L: [
                    { M: { grade: { S: "VIP" }, price: { N: "170000" }, color: { S: "#DC2626" }, description: { S: "1층 전체, 프리미엄 좌석" } } },
                    { M: { grade: { S: "R" }, price: { N: "140000" }, color: { S: "#F87171" }, description: { S: "2층 전체" } } }
                ]
            }
        }
    }));

    console.log("✅ Done: perf-jekyll-hyde");
    console.log("\n🎉 가격 수정 완료!");
}

fixPrices().catch(console.error);
