import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-schedules";

const concertIds = [
    { id: "perf-bts-worldtour", name: "방탄소년단", dates: ["2026-02-20", "2026-02-21", "2026-02-22"], time: "19:00" },
    { id: "perf-ive-showhave", name: "아이브", dates: ["2026-02-27", "2026-02-28", "2026-03-01"], time: "18:00" },
    { id: "perf-blackpink-worldtour", name: "블랙핑크", dates: ["2026-03-13", "2026-03-14", "2026-03-15"], time: "19:00" },
    { id: "perf-day6-present", name: "DAY6", dates: ["2026-03-27", "2026-03-28", "2026-03-29"], time: "18:00" }
];

async function verifySchedules() {
    console.log("=== 콘서트 스케줄 검증 ===\n");

    let totalCount = 0;
    let passCount = 0;

    for (const concert of concertIds) {
        console.log(`📋 ${concert.name} (${concert.id})`);
        console.log("-".repeat(50));

        for (const date of concert.dates) {
            const scheduleId = `${concert.id}-${date}-${concert.time}`;

            // 직접 GetItem으로 확인
            const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
            const res = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { scheduleId }
            }));

            totalCount++;

            if (res.Item) {
                passCount++;
                console.log(`   ✅ ${date} (${res.Item.dayOfWeek}) ${res.Item.time}`);
                console.log(`      - status: ${res.Item.status}`);
                console.log(`      - totalSeats: ${res.Item.totalSeats}`);
                console.log(`      - availableSeats: ${res.Item.availableSeats}`);
            } else {
                console.log(`   ❌ ${date} - 없음`);
            }
        }
        console.log();
    }

    console.log("=".repeat(50));
    console.log(`결과: ${passCount}/${totalCount} 검증 통과`);
    console.log(passCount === totalCount ? "🎉 모든 스케줄 검증 완료!" : "⚠️ 일부 스케줄 누락");
}

verifySchedules().catch(console.error);
