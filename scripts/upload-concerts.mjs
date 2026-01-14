import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { readFileSync } from "fs";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

async function uploadConcerts() {
    const data = JSON.parse(readFileSync("concerts-complete.json", "utf8"));
    const items = data["plcr-gtbl-performances"];

    for (const item of items) {
        const rawItem = item.PutRequest.Item;

        // DynamoDB Document Client용으로 변환
        const docItem = {};
        for (const [key, value] of Object.entries(rawItem)) {
            docItem[key] = unmarshallValue(value);
        }

        console.log(`Uploading: ${docItem.performanceId} - ${docItem.title}`);

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: docItem
        }));

        console.log(`✅ Success: ${docItem.title}`);
    }

    console.log("\n🎉 All concerts uploaded successfully!");
}

function unmarshallValue(value) {
    if (value.S !== undefined) return value.S;
    if (value.N !== undefined) return Number(value.N);
    if (value.BOOL !== undefined) return value.BOOL;
    if (value.L !== undefined) return value.L.map(unmarshallValue);
    if (value.M !== undefined) {
        const result = {};
        for (const [k, v] of Object.entries(value.M)) {
            result[k] = unmarshallValue(v);
        }
        return result;
    }
    return value;
}

uploadConcerts().catch(console.error);
