import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

const updates = [
    { performanceId: "perf-bts-worldtour", title: "방탄소년단 MAP OF THE SOUL TOUR" },
    { performanceId: "perf-blackpink-worldtour", title: "블랙핑크 WORLD TOUR IN GOYANG" },
    { performanceId: "perf-day6-present", title: "DAY6 The Present" },
    { performanceId: "perf-ive-showhave", title: "아이브 THE 1ST WORLD TOUR" }
];

async function updateTitles() {
    console.log("🎤 콘서트 타이틀 업데이트...\n");

    for (const update of updates) {
        console.log(`Updating: ${update.performanceId}`);
        console.log(`  → ${update.title}`);

        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: update.performanceId },
            UpdateExpression: "SET title = :title",
            ExpressionAttributeValues: { ":title": update.title }
        }));

        console.log(`✅ Success\n`);
    }

    console.log("🎉 모든 타이틀 업데이트 완료!");
}

updateTitles().catch(console.error);
