import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-venues";

async function inspect() {
    const res = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { venueId: "charlotte-theater" }
    }));

    // Print minimal structure to avoid huge output
    if (res.Item && res.Item.sections) {
        res.Item.sections.forEach(s => {
            console.log(`Section ${s.sectionId} (${s.floor}):`);
            s.rows.forEach(r => {
                console.log(`  Row ${r.rowId}: ${r.grade} (Length: ${r.length})`);
            });
        });
    }
}

inspect().catch(console.error);
