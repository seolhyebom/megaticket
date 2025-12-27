import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-performances";

async function cleanupFields() {
    console.log("Scanning for items to cleanup...");
    const scanRes = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    if (!scanRes.Items || scanRes.Items.length === 0) {
        console.log("No items found.");
        return;
    }

    for (const item of scanRes.Items) {
        console.log(`Cleaning up ${item.performanceId} (${item.title || 'Untitled'})...`);

        // Remove lowercase startDate and endDate
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: item.performanceId },
            UpdateExpression: "REMOVE startDate, endDate",
        }));
    }
    console.log("Cleanup complete.");
}

cleanupFields().then(() => console.log("Done."));
