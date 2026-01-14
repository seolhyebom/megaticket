import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { writeFileSync } from "fs";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-schedules";

async function inspectSchedules() {
    const res = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 2
    }));

    console.log("Sample schedules:");
    writeFileSync("sample-schedules.json", JSON.stringify(res.Items, null, 2), "utf8");
    console.log("Saved to sample-schedules.json");
    console.log(JSON.stringify(res.Items?.[0], null, 2));
}

inspectSchedules().catch(console.error);
