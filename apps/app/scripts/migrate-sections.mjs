import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = "KDT-Msp4-PLDR-venues";
const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";

async function migrate() {
    console.log("Fetching venue data (charlotte-theater)...");
    const venueRes = await docClient.send(new GetCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: "charlotte-theater" }
    }));

    if (!venueRes.Item) {
        console.error("Venue not found!");
        return;
    }

    // Try both capitalized and lowercase for robustness
    const Sections = venueRes.Item.Sections || venueRes.Item.sections;
    const Grades = venueRes.Item.Grades || venueRes.Item.grades;

    if (!Sections) {
        console.error("Sections not found in venue!");
        console.log("Venue items:", Object.keys(venueRes.Item));
        return;
    }

    const perfIds = ["perf-kinky-1", "perf-phantom-of-the-opera-1"];

    for (const pid of perfIds) {
        console.log(`Migrating sections to ${pid}...`);
        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: pid },
            UpdateExpression: "SET sections = :s",
            ExpressionAttributeValues: {
                ":s": Sections
            }
        }));
    }

    console.log("Removing Grades and Sections from venue...");
    await docClient.send(new UpdateCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: "charlotte-theater" },
        UpdateExpression: "REMOVE Grades, Sections, grades, sections"
    }));

    console.log("Migration complete.");
}

migrate().then(() => console.log("Done."));
