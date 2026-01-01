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

    if (!data.Item || !data.Item.sections) {
        console.log("No data found");
        return;
    }

    const sections = data.Item.sections;
    const sectionD = sections.find(s => s.sectionId === "D" && s.floor === "2층");

    if (!sectionD) {
        console.log("Section D not found");
        return;
    }

    const row4 = sectionD.rows.find(r => r.rowId === "4");
    const row8 = sectionD.rows.find(r => r.rowId === "8");

    console.log(`2F Section D Row 4 Grade: ${row4.grade} (Expected: S)`);
    console.log(`2F Section D Row 8 Grade: ${row8.grade} (Expected: A)`);
}

verify().catch(console.error);
