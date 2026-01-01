
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERF_IDS = ['perf-kinky-1', 'perf-phantom-of-the-opera-1'];
const TABLE_NAME = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";

const run = async () => {
    for (const perfId of PERF_IDS) {
        console.log(`\nProcessing ${perfId}...`);

        try {
            // Remove gradeMapping
            const updateCmd = new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { performanceId: perfId },
                UpdateExpression: "REMOVE gradeMapping",
                ReturnValues: "UPDATED_NEW"
            });

            await docClient.send(updateCmd);
            console.log(`[SUCCESS] Removed gradeMapping from ${perfId}`);

        } catch (e) {
            console.error(`[ERROR] Failed to update ${perfId}:`, e);
        }
    }
};

run();
