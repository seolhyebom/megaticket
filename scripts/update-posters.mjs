// posterUrl 수정 스크립트
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";

async function updatePosters() {
    // Update Kinky Boots
    await docClient.send(new UpdateCommand({
        TableName: PERFORMANCES_TABLE,
        Key: { performanceId: "perf-kinky-1" },
        UpdateExpression: "SET posterUrl = :url",
        ExpressionAttributeValues: {
            ":url": "/posters/kinky-boots.png"
        }
    }));
    console.log("✅ Updated perf-kinky-1 posterUrl");

    // Update Phantom of the Opera
    await docClient.send(new UpdateCommand({
        TableName: PERFORMANCES_TABLE,
        Key: { performanceId: "perf-phantom-of-the-opera-1" },
        UpdateExpression: "SET posterUrl = :url",
        ExpressionAttributeValues: {
            ":url": "/posters/phantom-poster.png"
        }
    }));
    console.log("✅ Updated perf-phantom-of-the-opera-1 posterUrl");

    console.log("\n✅ Poster URLs updated!");
}

updatePosters().catch(console.error);
