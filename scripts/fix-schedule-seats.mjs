// schedules 테이블의 availableSeats, totalSeats를 venues.totalSeats(1210)와 일치시키는 스크립트
// 현재 1240으로 되어 있는 값을 1210으로 수정

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = process.argv[2] || "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const SCHEDULES_TABLE = "KDT-Msp4-PLDR-schedules";
const VENUES_TABLE = "KDT-Msp4-PLDR-venues";

async function getVenueTotalSeats() {
    // charlotte-theater의 totalSeats 조회
    const result = await docClient.send(new GetCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: "charlotte-theater" }
    }));

    return result.Item?.totalSeats || 1210;
}

async function updateScheduleSeats() {
    console.log("🔍 Fetching venue totalSeats...");
    const venueTotalSeats = await getVenueTotalSeats();
    console.log(`📍 Venue totalSeats: ${venueTotalSeats}`);

    console.log("\n🔍 Scanning schedules table...");

    const result = await docClient.send(new ScanCommand({
        TableName: SCHEDULES_TABLE
    }));

    if (!result.Items || result.Items.length === 0) {
        console.log("❌ No schedules found.");
        return;
    }

    console.log(`📋 Found ${result.Items.length} schedules`);

    let updated = 0;
    for (const schedule of result.Items) {
        const scheduleId = schedule.scheduleId;
        const currentAvailable = schedule.availableSeats;
        const currentTotal = schedule.totalSeats;

        // availableSeats나 totalSeats가 잘못된 경우만 업데이트
        if (currentAvailable !== venueTotalSeats || currentTotal !== venueTotalSeats) {
            console.log(`  Updating: ${scheduleId}`);
            console.log(`    - availableSeats: ${currentAvailable} → ${venueTotalSeats}`);
            console.log(`    - totalSeats: ${currentTotal} → ${venueTotalSeats}`);

            await docClient.send(new UpdateCommand({
                TableName: SCHEDULES_TABLE,
                Key: { scheduleId: scheduleId },
                UpdateExpression: "SET availableSeats = :available, totalSeats = :total",
                ExpressionAttributeValues: {
                    ":available": venueTotalSeats,
                    ":total": venueTotalSeats
                }
            }));

            updated++;
        }
    }

    console.log(`\n✅ Done! Updated ${updated} schedules with correct seat counts (${venueTotalSeats}).`);
}

updateScheduleSeats().catch(console.error);
