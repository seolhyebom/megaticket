import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = "KDT-Msp4-PLDR-venues";
const VENUE_ID = "charlotte-theater";

async function verify() {
    const data = await docClient.send(new GetCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: VENUE_ID }
    }));

    if (!data.Item) {
        console.log("Venue not found");
        return;
    }

    const sections = data.Item.sections;

    // Check Section A Row 15 (Should be R)
    const sectionA = sections.find(s => s.sectionId === "A");
    const row15 = sectionA.rows.find(r => r.rowId === "15");

    console.log(`Section A Row 15 Grade: ${row15.grade} (Expected: R)`);

    // Check Section B Row 9 (Should be VIP) and 10 (Should be R)
    const sectionB = sections.find(s => s.sectionId === "B");
    const row9 = sectionB.rows.find(r => r.rowId === "9");
    const row10 = sectionB.rows.find(r => r.rowId === "10");

    console.log(`Section B Row 9 Grade: ${row9.grade} (Expected: VIP)`);
    console.log(`Section B Row 10 Grade: ${row10.grade} (Expected: R)`);
}

verify().catch(console.error);
