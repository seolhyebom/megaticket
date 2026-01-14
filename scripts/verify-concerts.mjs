import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

const concertIds = [
    "perf-bts-worldtour",
    "perf-blackpink-worldtour",
    "perf-day6-present",
    "perf-ive-showhave"
];

async function verify() {
    console.log("🔍 콘서트 데이터 검증 중...\n");

    for (const id of concertIds) {
        const res = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: id }
        }));

        if (res.Item) {
            const item = res.Item;
            console.log(`✅ ${item.title}`);
            console.log(`   - ID: ${item.performanceId}`);
            console.log(`   - 날짜: ${item.dateRange}`);
            console.log(`   - 가격: ${item.price}`);
            console.log(`   - gradeMapping: ${Object.keys(item.gradeMapping || {}).join(", ") || "없음"}`);
            console.log(`   - seatGrades: ${item.seatGrades?.length || 0}개`);
            console.log(`   - hasOPSeats: ${item.hasOPSeats}`);
            console.log();
        } else {
            console.log(`❌ ${id} - 데이터 없음`);
        }
    }
}

verify().catch(console.error);
