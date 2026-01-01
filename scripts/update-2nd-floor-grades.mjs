import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const PERF_TABLE = "KDT-Msp4-PLDR-performances";
const TARGET_PERFS = ["perf-kinky-1", "perf-phantom-of-the-opera-1"];

async function update2ndFloor() {
    for (const perfId of TARGET_PERFS) {
        console.log(`\n📦 Processing performance: ${perfId}...`);

        // 1. Get current sections
        const data = await docClient.send(new GetCommand({
            TableName: PERF_TABLE,
            Key: { performanceId: perfId }
        }));

        if (!data.Item || !data.Item.sections) {
            console.error(`❌ No sections found for ${perfId}`);
            continue;
        }

        const sections = data.Item.sections;
        let modifiedCount = 0;

        // 2. Apply 2nd Floor Logic
        sections.forEach(section => {
            if (section.floor !== "2층") return;

            section.rows.forEach(row => {
                const rowNum = parseInt(row.rowId);
                if (isNaN(rowNum)) return;

                let newGrade = row.grade;

                // Section D (Left): 1-7 (S), 8-13 (A)
                if (section.sectionId === "D") {
                    if (rowNum >= 1 && rowNum <= 7) newGrade = "S";
                    else if (rowNum >= 8 && rowNum <= 13) newGrade = "A";
                }
                // Section E (Center): 1-8 (S), 9-13 (A)
                else if (section.sectionId === "E") {
                    if (rowNum >= 1 && rowNum <= 8) newGrade = "S";
                    else if (rowNum >= 9 && rowNum <= 13) newGrade = "A";
                }
                // Section F (Right): 1-7 (S), 8-13 (A)
                else if (section.sectionId === "F") {
                    if (rowNum >= 1 && rowNum <= 7) newGrade = "S";
                    else if (rowNum >= 8 && rowNum <= 13) newGrade = "A";
                }

                if (newGrade !== row.grade) {
                    console.log(`  Updated ${section.floor} ${section.sectionId} Row ${row.rowId}: ${row.grade} -> ${newGrade}`);
                    row.grade = newGrade;
                    if (row.seats) {
                        row.seats.forEach(seat => {
                            if (seat.grade) seat.grade = newGrade;
                        });
                    }
                    modifiedCount++;
                }
            });
        });

        if (modifiedCount === 0) {
            console.log(`  ⚠️ No changes needed for ${perfId}`);
            continue;
        }

        // 3. Write back
        await docClient.send(new UpdateCommand({
            TableName: PERF_TABLE,
            Key: { performanceId: perfId },
            UpdateExpression: "SET sections = :sections",
            ExpressionAttributeValues: {
                ":sections": sections
            }
        }));

        console.log(`  ✅ Successfully updated ${perfId}`);
    }
}

update2ndFloor().catch(console.error);
