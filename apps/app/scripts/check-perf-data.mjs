
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";

async function check() {
    const ids = ["perf-kinky-1", "perf-phantom-of-the-opera-1"];
    for (const id of ids) {
        console.log(`Checking ${id}...`);
        try {
            const res = await docClient.send(new GetCommand({
                TableName: PERFORMANCES_TABLE,
                Key: { performanceId: id }
            }));

            if (res.Item) {
                console.log(`- ID: ${res.Item.performanceId}`);
                console.log(`- Title: ${res.Item.title}`);
                console.log(`- Sections exists: ${!!res.Item.sections}`);
                if (res.Item.sections) {
                    console.log(`- Sections type: ${typeof res.Item.sections}`);
                    console.log(`- Is array: ${Array.isArray(res.Item.sections)}`);
                    console.log(`- Sections length: ${Array.isArray(res.Item.sections) ? res.Item.sections.length : 'N/A'}`);
                    console.log(`- Sections content sample: ${JSON.stringify(res.Item.sections).substring(0, 100)}...`);
                }
            } else {
                console.log(`- ${id} not found!`);
            }
        } catch (e) {
            console.error(`- Error checking ${id}:`, e.message);
        }
    }
}

check();
