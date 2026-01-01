
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";
const PERF_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";

const VENUE_ID = 'charlotte-theater';
const PERF_IDS = ['perf-kinky-1', 'perf-phantom-of-the-opera-1'];

// 1. Helper: Generate Grade Mapping for Performance
const generateGradeMapping = () => {
    // We only map the S rows that differ from Venue defaults.
    // Venue Default: Rows 1-3 = S, 4+ = A.
    // Performance Goal: 
    //   Sec D, F: Rows 1-7 = S (So Row 4,5,6,7 need override)
    //   Sec E:    Rows 1-8 = S (So Row 4,5,6,7,8 need override)

    // Note: performance-service.ts uses: rowGrade = mapping[rowKey] || row.grade
    // So if we map D-4 to "S", it overrides Venue's "A".
    // Rows 1-3 are already S in Venue, so we don't strictly need to map them, 
    // BUT explicit is better? Let's map ALL S rows to be safe.

    const sRows = [];

    // Section D (Left): Rows 1-7
    for (let r = 1; r <= 7; r++) sRows.push(`D-${r}`);

    // Section E (Center): Rows 1-8
    for (let r = 1; r <= 8; r++) sRows.push(`E-${r}`);

    // Section F (Right): Rows 1-7
    for (let r = 1; r <= 7; r++) sRows.push(`F-${r}`);

    return { "S": sRows };
    // No need to map "A" if the rest fallback to "A". 
    // But Venue rows 4-7 are now "S" because I messed them up in previous step.
    // I will revert Venue first.
};

const revertVenueVal = async () => {
    console.log("Reverting Venue Defaults...");
    const getCmd = new GetCommand({ TableName: VENUES_TABLE, Key: { venueId: VENUE_ID } });
    const { Item: venue } = await docClient.send(getCmd);
    if (!venue) return;

    const newSections = venue.sections.map(section => {
        if (section.floor !== '2층') return section;

        // Revert to Default: D/E/F Row 1-3 = S, rest = A
        if (['D', 'E', 'F'].includes(section.sectionId)) {
            const newRows = section.rows.map(row => {
                const r = parseInt(row.rowId, 10);
                // Default Rule: 1-3 is S, rest is A
                const defaultGrade = r <= 3 ? 'S' : 'A';

                const newRow = { ...row, grade: defaultGrade };
                if (newRow.seats) {
                    newRow.seats = newRow.seats.map(s => ({ ...s, grade: defaultGrade }));
                }
                return newRow;
            });
            return { ...section, rows: newRows };
        }
        return section;
    });

    await docClient.send(new UpdateCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: VENUE_ID },
        UpdateExpression: "SET sections = :s",
        ExpressionAttributeValues: { ":s": newSections }
    }));
    console.log("[SUCCESS] Reverted Venue Defaults (Rows 4+ are A).");
};

const updatePerformances = async () => {
    console.log("Updating Performances with gradeMapping...");
    const mapping = generateGradeMapping();

    for (const pid of PERF_IDS) {
        await docClient.send(new UpdateCommand({
            TableName: PERF_TABLE,
            Key: { performanceId: pid },
            UpdateExpression: "SET gradeMapping = :m",
            ExpressionAttributeValues: { ":m": mapping }
        }));
        console.log(`[SUCCESS] Updated ${pid} with gradeMapping.`);
    }
};

const run = async () => {
    await revertVenueVal();
    await updatePerformances();
};

run();
