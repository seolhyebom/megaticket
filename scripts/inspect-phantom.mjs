import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-performances";

async function inspect() {
    const res = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { performanceId: "perf-phantom-of-the-opera-1" }
    }));

    if (res.Item) {
        console.log("Venue ID:", res.Item.venueId);
    }
}

inspect().catch(console.error);
