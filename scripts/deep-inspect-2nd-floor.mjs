import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const PERF_TABLE = "KDT-Msp4-PLDR-performances";
const PERF_ID = "perf-kinky-1";

async function verify() {
    const data = await docClient.send(new GetCommand({
        TableName: PERF_TABLE,
        Key: { performanceId: PERF_ID }
    }));

    if (!data.Item || !data.Item.sections) return;

    const sections = data.Item.sections;
    const sectionD = sections.find(s => s.sectionId === "D" && s.floor === "2층"); // D section

    if (!sectionD) return;

    // Check Row 4 (Should be S)
    const row4 = sectionD.rows.find(r => r.rowId === "4");
    if (row4) {
        console.log(`Row 4 Row-Level Grade: ${row4.grade}`);
        if (row4.seats && row4.seats.length > 0) {
            console.log(`Row 4 Seat[0] Grade: ${row4.seats[0].grade}`);
            console.log(`Row 4 Seat[0] full:`, JSON.stringify(row4.seats[0]));
        } else {
            console.log("Row 4 has no pre-defined seats.");
        }
    }

    // Check Row 8 (Should be A)
    const row8 = sectionD.rows.find(r => r.rowId === "8");
    if (row8) {
        console.log(`Row 8 Row-Level Grade: ${row8.grade}`);
        if (row8.seats && row8.seats.length > 0) {
            console.log(`Row 8 Seat[0] Grade: ${row8.seats[0].grade}`);
        }
    }
}

verify().catch(console.error);
