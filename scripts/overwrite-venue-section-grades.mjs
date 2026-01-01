
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUE_ID = 'charlotte-theater';
const TABLE_NAME = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";

const run = async () => {
    try {
        // 1. Fetch current venue
        const getCmd = new GetCommand({
            TableName: TABLE_NAME,
            Key: { venueId: VENUE_ID }
        });
        const { Item: venue } = await docClient.send(getCmd);

        if (!venue) {
            console.error("Venue not found");
            return;
        }

        console.log("Current Venue Sections loaded.");

        // 2. Modify Sections IN MEMORY
        const newSections = venue.sections.map(section => {
            // 2nd Floor Only
            if (section.floor !== '2층') return section;

            // Section D (Left) & F (Right): Rows 1-7 = S, 8-13 = A
            if (section.sectionId === 'D' || section.sectionId === 'F') {
                const newRows = section.rows.map(row => {
                    const rowNum = parseInt(row.rowId, 10);
                    let newGrade = 'A'; // Default
                    if (rowNum <= 7) newGrade = 'S';

                    // Update Row Grade
                    const newRow = { ...row, grade: newGrade };
                    // Update Seat Grades in this row
                    if (newRow.seats) {
                        newRow.seats = newRow.seats.map(seat => ({
                            ...seat,
                            grade: newGrade // Inherit row grade
                        }));
                    }
                    return newRow;
                });
                return { ...section, rows: newRows };
            }

            // Section E (Center): Rows 1-8 = S, 9-13 = A
            if (section.sectionId === 'E') {
                const newRows = section.rows.map(row => {
                    const rowNum = parseInt(row.rowId, 10);
                    let newGrade = 'A'; // Default
                    if (rowNum <= 8) newGrade = 'S';

                    // Update Row Grade
                    const newRow = { ...row, grade: newGrade };
                    // Update Seat Grades in this row
                    if (newRow.seats) {
                        newRow.seats = newRow.seats.map(seat => ({
                            ...seat,
                            grade: newGrade // Inherit row grade
                        }));
                    }
                    return newRow;
                });
                return { ...section, rows: newRows };
            }

            return section;
        });

        // 3. Update DB
        const updateCmd = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { venueId: VENUE_ID },
            UpdateExpression: "SET sections = :s",
            ExpressionAttributeValues: {
                ":s": newSections
            },
            ReturnValues: "UPDATED_NEW"
        });

        await docClient.send(updateCmd);
        console.log("[SUCCESS] Updated Venue Sections directly.");

    } catch (e) {
        console.error("Error:", e);
    }
};

run();
