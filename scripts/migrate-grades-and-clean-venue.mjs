
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";
const PERF_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";
const VENUE_ID = 'charlotte-theater';
const PERF_IDS = ['perf-kinky-1', 'perf-phantom-of-the-opera-1'];

// Goals:
// 1. Read CURRENT Venue Grades (which we know are correct for 1st floor, but 'A' for 2nd floor default).
// 2. We need to construct a mapping that:
//    - Preserves 1st Floor (VIP, R, OP)
//    - Overrides 2nd Floor (S for rows 1-7/8, A for rest)

const run = async () => {
    // 1. Fetch Venue
    const { Item: venue } = await docClient.send(new GetCommand({ TableName: VENUES_TABLE, Key: { venueId: VENUE_ID } }));
    if (!venue) return;

    // 2. Build Mapping
    const gradeMapping = {
        "VIP": [],
        "R": [],
        "OP": [],
        "S": [],
        "A": []
    };

    venue.sections.forEach(section => {
        const floor = section.floor;
        const sid = section.sectionId;

        section.rows.forEach(row => {
            const rid = row.rowId;
            const key = `${sid}-${rid}`;
            const rNum = parseInt(rid, 10);

            // Logic:
            // If 2nd Floor: apply S/A logic
            // If 1st Floor: use existing venue grade

            let targetGrade = row.grade; // Default from venue

            if (floor === '2층') {
                // Determine S or A based on our rule, ignoring current venue value (which is A)
                if (['D', 'F'].includes(sid)) {
                    targetGrade = rNum <= 7 ? 'S' : 'A';
                } else if (sid === 'E') {
                    targetGrade = rNum <= 8 ? 'S' : 'A';
                } else {
                    targetGrade = 'A'; // Fallback
                }
            }

            // Push to mapping
            if (gradeMapping[targetGrade]) {
                gradeMapping[targetGrade].push(key);
            } else {
                // If special grade like 'OP/VIP' handling in code, or just fallback
                // The code inspects 'OP' row.
                if (targetGrade === 'OP') gradeMapping['OP'].push(key);
                else {
                    // For 'OP' row in Sec B, it might be separate.
                    // Let's trust row.grade for 1st floor.
                    if (!gradeMapping[targetGrade]) gradeMapping[targetGrade] = [];
                    gradeMapping[targetGrade].push(key);
                }
            }
        });
    });

    console.log("Constructed Mapping Summary:");
    Object.keys(gradeMapping).forEach(g => {
        console.log(`${g}: ${gradeMapping[g].length} rows`);
    });

    // 3. Update Performances
    for (const pid of PERF_IDS) {
        await docClient.send(new UpdateCommand({
            TableName: PERF_TABLE,
            Key: { performanceId: pid },
            UpdateExpression: "SET gradeMapping = :m",
            ExpressionAttributeValues: { ":m": gradeMapping }
        }));
        console.log(`[SUCCESS] Migrated full grade mapping to ${pid}`);
    }

    // 4. Update Venue (Remove 'grade' from rows and seats)
    // IMPORTANT: Doing this in a separate step/script might be safer, but the user wants it done.
    // Let's modify the in-memory venue object and write it back.

    console.log("Cleaning Venue...");
    const cleanSections = venue.sections.map(section => ({
        ...section,
        rows: section.rows.map(row => {
            // Remove grade from Row
            const { grade, ...rowRest } = row;

            // Remove grade from Seats
            const cleanSeats = (row.seats || []).map(seat => {
                const { grade: sGrade, ...seatRest } = seat;
                return seatRest;
            });

            return { ...rowRest, seats: cleanSeats };
        })
    }));

    await docClient.send(new UpdateCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: VENUE_ID },
        UpdateExpression: "SET sections = :s",
        ExpressionAttributeValues: { ":s": cleanSections }
    }));
    console.log("[SUCCESS] Removed 'grade' fields from Venue.");
};

run();
