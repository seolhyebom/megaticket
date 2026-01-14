import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });

const performanceIds = ["perf-jekyll-hyde", "perf-aladdin"];

async function removeFields() {
    for (const id of performanceIds) {
        console.log(`Removing category, duration from ${id}...`);

        await client.send(new UpdateItemCommand({
            TableName: "plcr-gtbl-performances",
            Key: { performanceId: { S: id } },
            UpdateExpression: "REMOVE category, #dur",
            ExpressionAttributeNames: { "#dur": "duration" }
        }));

        console.log(`✅ Done: ${id}`);
    }
    console.log("\n🎉 완료!");
}

removeFields().catch(console.error);
