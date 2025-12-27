import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-performances";

async function renameToLowercase() {
    console.log("Scanning for items to rename fields...");
    const scanRes = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME
    }));

    if (!scanRes.Items || scanRes.Items.length === 0) {
        console.log("No items found.");
        return;
    }

    for (const item of scanRes.Items) {
        console.log(`Processing ${item.performanceId}...`);

        const sDate = item.StartDate || item.startDate;
        const eDate = item.EndDate || item.endDate;

        if (sDate && eDate) {
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { performanceId: item.performanceId },
                UpdateExpression: "SET startDate = :s, endDate = :e REMOVE StartDate, EndDate",
                ExpressionAttributeValues: {
                    ":s": sDate,
                    ":e": eDate
                }
            }));
            console.log(`Updated ${item.performanceId}: StartDate/EndDate -> startDate/endDate`);
        }
    }
    console.log("Field renaming complete.");
}

renameToLowercase().then(() => console.log("Done."));
