import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-performances";

async function fixAll() {
    // 1. Fix Phantom of the Opera
    const PHANTOM_ID = "perf-phantom-of-the-opera-1";
    console.log(`Fixing Phantom of the Opera (${PHANTOM_ID})...`);

    const phantomRes = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { performanceId: PHANTOM_ID }
    }));

    if (phantomRes.Item) {
        const item = phantomRes.Item;
        const updatedSchedules = item.schedules.map(slot => {
            if (slot.date) {
                // If it's 2026-12-xx, change to 2026-02-xx to fit 02.20 ~ 05.15
                if (slot.date.startsWith("2026-12")) {
                    return { ...slot, date: slot.date.replace("2026-12", "2026-02") };
                }
                // Also handle 2024 if any left
                if (slot.date.startsWith("2024")) {
                    return { ...slot, date: slot.date.replace("2024", "2026") };
                }
            }
            return slot;
        });

        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: PHANTOM_ID },
            UpdateExpression: "SET startDate = :s, endDate = :e, StartDate = :s, EndDate = :e, dateRange = :dr, schedules = :sch",
            ExpressionAttributeValues: {
                ":s": "2026-02-20",
                ":e": "2026-05-15",
                ":dr": "2026.02.20 ~ 2026.05.15",
                ":sch": updatedSchedules
            }
        }));
        console.log("Phantom fixed.");
    }

    // 2. Fix Kinky Boots
    const KINKY_ID = "perf-kinky-1";
    console.log(`Fixing Kinky Boots (${KINKY_ID})...`);

    // We already know it has startDate: 2026-02-10, endDate: 2026-04-30
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { performanceId: KINKY_ID },
        UpdateExpression: "SET StartDate = :s, EndDate = :e",
        ExpressionAttributeValues: {
            ":s": "2026-02-10",
            ":e": "2026-04-30"
        }
    }));
    console.log("Kinky Boots fixed.");
}

fixAll().then(() => console.log("Done."));
