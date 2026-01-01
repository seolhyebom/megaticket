
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERF_IDS = ['perf-kinky-1', 'perf-phantom-of-the-opera-1'];
const TABLE_NAME = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";

// 2nd Floor Grade Logic for Kinky Boots & Phantom
// Goal: 
// Section D (Left), F (Right): Rows 1-7 = S, Rows 8-13 = A
// Section E (Center): Rows 1-8 = S, Rows 9-13 = A

// Helper to generate S-grade row keys
const generateSGradeRows = () => {
    const sRows = [];

    // Section D (Left): Rows 1-7
    for (let r = 1; r <= 7; r++) sRows.push(`D-${r}`);

    // Section E (Center): Rows 1-8
    for (let r = 1; r <= 8; r++) sRows.push(`E-${r}`);

    // Section F (Right): Rows 1-7
    for (let r = 1; r <= 7; r++) sRows.push(`F-${r}`);

    return sRows;
};

// Helper to generate A-grade row keys
const generateAGradeRows = () => {
    const aRows = [];

    // Section D (Left): Rows 8-13
    for (let r = 8; r <= 13; r++) aRows.push(`D-${r}`);

    // Section E (Center): Rows 9-13
    for (let r = 9; r <= 13; r++) aRows.push(`E-${r}`);

    // Section F (Right): Rows 8-13
    for (let r = 8; r <= 13; r++) aRows.push(`F-${r}`);

    return aRows;
};

const run = async () => {
    const sRows = generateSGradeRows();
    const aRows = generateAGradeRows();

    // We only need to map the overrides. 
    // However, to be safe and explicit for the 2nd floor, we map all 2nd floor rows.
    // 1st floor rows will fall back to Venue defaults (VIP/R/OP) which confirmed correct using inspect-venue.

    const gradeMapping = {
        "S": sRows,
        "A": aRows
    };

    console.log("Generated Grade Mapping (Sample):");
    console.log("S:", sRows.slice(0, 5), "...");
    console.log("A:", aRows.slice(0, 5), "...");

    for (const perfId of PERF_IDS) {
        console.log(`\nProcessing ${perfId}...`);

        try {
            // 1. Verify existence
            const getCmd = new GetCommand({
                TableName: TABLE_NAME,
                Key: { performanceId: perfId }
            });
            const item = await docClient.send(getCmd);
            if (!item.Item) {
                console.log(`Skipping ${perfId}: Not found.`);
                continue;
            }

            // 2. Update: Remove 'sections', Set 'gradeMapping'
            const updateCmd = new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { performanceId: perfId },
                UpdateExpression: "REMOVE sections SET gradeMapping = :gm",
                ExpressionAttributeValues: {
                    ":gm": gradeMapping
                },
                ReturnValues: "UPDATED_NEW"
            });

            const result = await docClient.send(updateCmd);
            console.log(`[SUCCESS] Updated ${perfId}`);
            console.log("Removed field: sections");
            console.log("Set field: gradeMapping");

        } catch (e) {
            console.error(`[ERROR] Failed to update ${perfId}:`, e);
        }
    }
};

run();
