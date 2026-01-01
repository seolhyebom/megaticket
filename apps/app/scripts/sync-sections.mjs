import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";
const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";

/**
 * venues 테이블에서 sections를 가져와 performances 테이블에 비정규화
 */
async function syncSections() {
    console.log("🚀 Syncing sections from venues to performances...\n");

    // 1. Get venue data
    const venueRes = await docClient.send(new GetCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: "charlotte-theater" }
    }));

    if (!venueRes.Item) {
        console.error("❌ Error: charlotte-theater not found in venues table!");
        return;
    }

    const sections = venueRes.Item.sections;
    const venueName = venueRes.Item.name || "샤롯데씨어터";
    console.log(`✅ Fetched sections from venues (${sections?.length || 0} sections)`);

    // 2. Get all performances
    const perfRes = await docClient.send(new ScanCommand({
        TableName: PERFORMANCES_TABLE
    }));

    const performances = perfRes.Items || [];
    console.log(`✅ Found ${performances.length} performances\n`);

    // 3. Update each performance
    for (const perf of performances) {
        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: perf.performanceId },
            UpdateExpression: "SET sections = :s, venue = :v",
            ExpressionAttributeValues: {
                ":s": sections,
                ":v": venueName
            }
        }));
        console.log(`✅ Updated: ${perf.title} (${perf.performanceId})`);
    }

    console.log("\n🎉 Sections sync complete!");
}

syncSections();
