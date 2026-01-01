import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = "KDT-Msp4-PLDR-venues";
const PERF_TABLE = "KDT-Msp4-PLDR-performances";

const VENUE_ID = "charlotte-theater";
const TARGET_PERFS = ["perf-kinky-1", "perf-phantom-of-the-opera-1"];

async function copySections() {
    console.log(`🔍 Fetching sections from venue: ${VENUE_ID}...`);

    // 1. Get Venue Sections
    const venueRes = await docClient.send(new GetCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: VENUE_ID }
    }));

    if (!venueRes.Item || !venueRes.Item.sections) {
        console.error("Venue or sections not found.");
        return;
    }

    const sections = venueRes.Item.sections;
    console.log(`✅ Found ${sections.length} sections.`);

    // 2. Update Performances
    for (const perfId of TARGET_PERFS) {
        console.log(`📦 Updating performance: ${perfId}...`);

        await docClient.send(new UpdateCommand({
            TableName: PERF_TABLE,
            Key: { performanceId: perfId },
            UpdateExpression: "SET sections = :sections",
            ExpressionAttributeValues: {
                ":sections": sections
            }
        }));

        console.log(`✅ Updated sections for ${perfId}`);
    }

    console.log("\n🚀 Migration complete. Seat grades are now performance-specific.");
}

copySections().catch(console.error);
