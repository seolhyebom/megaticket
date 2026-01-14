import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

async function inspect() {
    const res = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { performanceId: "perf-kinky-1" }
    }));

    const fs = await import('fs');
    fs.writeFileSync('kinky_dump.json', JSON.stringify(res.Item, null, 2));
    console.log("Saved to kinky_dump.json");
    console.log(JSON.stringify(res.Item, null, 2));
}

inspect().catch(console.error);
