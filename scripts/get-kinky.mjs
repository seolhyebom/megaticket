import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

async function getKinky() {
    const result = await docClient.send(new GetCommand({
        TableName: "plcr-gtbl-performances",
        Key: { performanceId: "perf-kinky-1" }
    }));

    console.log("=== KINKY BOOTS gradeMapping ===");
    console.log(JSON.stringify(result.Item.gradeMapping, null, 2));
}

getKinky().catch(console.error);
