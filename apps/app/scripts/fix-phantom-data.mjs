import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-performances";
const PERF_ID = "perf-phantom-of-the-opera-1";

async function fixPhantomData() {
    console.log(`Fetching performance data for ${PERF_ID}...`);

    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { performanceId: PERF_ID }
    });

    const { Item } = await docClient.send(getCmd);

    if (!Item) {
        console.error("Performance not found!");
        return;
    }

    // Update schedules year from 2024 to 2026
    const updatedSchedules = Item.schedules.map(slot => {
        if (slot.date && slot.date.startsWith("2024")) {
            return {
                ...slot,
                date: slot.date.replace("2024", "2026")
            };
        }
        return slot;
    });

    console.log("Updating data...");
    const updateCmd = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { performanceId: PERF_ID },
        UpdateExpression: "SET startDate = :s, endDate = :e, StartDate = :s, EndDate = :e, dateRange = :dr, schedules = :sch",
        ExpressionAttributeValues: {
            ":s": "2026-02-20",
            ":e": "2026-05-15",
            ":dr": "2026.02.20 ~ 2026.05.15",
            ":sch": updatedSchedules
        }
    });

    try {
        await docClient.send(updateCmd);
        console.log("Successfully fixed Phantom of the Opera data.");
    } catch (e) {
        console.error("Failed to update data:", e);
    }
}

fixPhantomData().then(() => console.log("Done."));
