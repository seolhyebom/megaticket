import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = "KDT-Msp4-PLDR-venues";
const VENUE_ID = "charlotte-theater";

async function updateGrades() {
    console.log("🔍 Fetching venue data...");

    // 1. Get current venue
    const data = await docClient.send(new GetCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: VENUE_ID }
    }));

    if (!data.Item) {
        console.error("Venue not found");
        return;
    }

    const sections = data.Item.sections;
    let modifiedCount = 0;

    // 2. Logic to update grades
    sections.forEach(section => {
        if (section.floor !== "1층") return;

        section.rows.forEach(row => {
            const rowNum = parseInt(row.rowId);

            // Bypass non-numeric rows like "OP" (unless logic needed)
            if (isNaN(rowNum)) return;

            // Update logic based on visual map
            // Section A/C: VIP(1-6), R(7-11), S(12-17)
            // Section B: VIP(1-9), R(10-14), S(15-17)

            let newGrade = row.grade;

            if (section.sectionId === "A" || section.sectionId === "C") {
                if (rowNum >= 1 && rowNum <= 6) newGrade = "VIP";
                else newGrade = "R"; // 7-17 all R
            } else if (section.sectionId === "B") {
                if (rowNum >= 1 && rowNum <= 9) newGrade = "VIP";
                else newGrade = "R"; // 10-17 all R
            }

            if (newGrade !== row.grade) {
                console.log(`Updated ${section.floor} ${section.sectionId} Row ${row.rowId}: ${row.grade} -> ${newGrade}`);
                row.grade = newGrade;

                // Update specific seat objects if they strictly store grade (usually just row status, but good to check)
                if (row.seats) {
                    row.seats.forEach(seat => {
                        // Some schemas duplicate grade in seat object, some don't. 
                        // Current schema check didn't show 'grade' in seat object, only in row.
                        // But if existing data has it, might as well.
                        if (seat.grade) seat.grade = newGrade;
                    });
                }
                modifiedCount++;
            }
        });
    });

    if (modifiedCount === 0) {
        console.log("No changes needed.");
        return;
    }

    console.log(`\n💾 Validation passed. Promoting ${modifiedCount} row updates...`);

    // 3. Write back
    await docClient.send(new UpdateCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: VENUE_ID },
        UpdateExpression: "SET sections = :sections",
        ExpressionAttributeValues: {
            ":sections": sections
        }
    }));

    console.log("✅ Successfully updated seat grades.");
}

updateGrades().catch(console.error);
