import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true }
});

const PERFORMANCES_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";
const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";
const SCHEDULES_TABLE = process.env.DYNAMODB_SCHEDULES_TABLE || "KDT-Msp4-PLDR-schedules";
const RESERVATIONS_TABLE = process.env.DYNAMODB_RESERVATIONS_TABLE || "KDT-Msp4-PLDR-reservations";

async function syncAllData() {
    console.log("🚀 Starting Full Denormalization Sync (V7.8)...");

    // 1. Fetch Venues
    console.log("📥 [1/3] Fetching Venues...");
    const venueResult = await docClient.send(new ScanCommand({ TableName: VENUES_TABLE }));
    const venues = venueResult.Items || [];
    const venueMap = new Map(venues.map(v => [v.venueId, v]));
    console.log(`✅ Loaded ${venues.length} venues.`);

    // 2. Fetch Performances
    console.log("📥 [2/3] Fetching Performances...");
    const perfResult = await docClient.send(new ScanCommand({ TableName: PERFORMANCES_TABLE }));
    const perfs = perfResult.Items || [];
    const perfMap = new Map(perfs.map(p => [p.performanceId, p]));
    console.log(`✅ Loaded ${perfs.length} performances.`);

    // 3. Update Performances (Denormalize venue and sections)
    console.log("🔄 Updating Performances...");
    for (const perf of perfs) {
        const venue = venueMap.get(perf.venueId);
        if (!venue) {
            console.warn(`⚠️ Venue ${perf.venueId} not found for Performance ${perf.performanceId}`);
            continue;
        }

        console.log(`  - Updating Performance: ${perf.title} (${perf.performanceId})`);
        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: perf.performanceId },
            UpdateExpression: "SET venue = :v, sections = :s",
            ExpressionAttributeValues: {
                ":v": venue.venueName || venue.name,
                ":s": venue.sections || []
            }
        }));
    }

    // 4. Update Schedules (Denormalize casting, totalSeats, availableSeats)
    console.log("🔄 Updating Schedules...");
    const scheduleResult = await docClient.send(new ScanCommand({ TableName: SCHEDULES_TABLE }));
    const schedules = scheduleResult.Items || [];
    console.log(`✅ Loaded ${schedules.length} schedules.`);

    for (const sched of schedules) {
        const perf = perfMap.get(sched.performanceId);
        if (!perf) {
            console.warn(`⚠️ Performance ${sched.performanceId} not found for Schedule ${sched.pk}`);
            continue;
        }
        const venue = venueMap.get(perf.venueId);
        if (!venue) {
            console.warn(`⚠️ Venue ${perf.venueId} not found for Schedule ${sched.pk}`);
            continue;
        }

        console.log(`  - Updating Schedule: ${sched.pk}`);

        // availableSeats 초기화 로직 (없거나 0인 경우 totalSeats로 설정)
        const totalSeats = venue.totalSeats || 1000;
        const currentAvailable = sched.availableSeats;

        await docClient.send(new UpdateCommand({
            TableName: SCHEDULES_TABLE,
            Key: { pk: sched.pk, sk: sched.sk },
            UpdateExpression: "SET casting = :c, totalSeats = :ts, availableSeats = :as",
            ExpressionAttributeValues: {
                ":c": perf.cast || "",
                ":ts": totalSeats,
                ":as": currentAvailable !== undefined ? currentAvailable : totalSeats
            }
        }));
    }

    // 5. Update Reservations (Denormalize posterUrl, venue, performanceTitle)
    console.log("🔄 Updating Reservations (Existing records)...");
    const resResult = await docClient.send(new ScanCommand({ TableName: RESERVATIONS_TABLE }));
    const reservations = resResult.Items || [];
    console.log(`✅ Loaded ${reservations.length} reservations.`);

    for (const res of reservations) {
        const perf = perfMap.get(res.performanceId);
        if (!perf) {
            console.warn(`⚠️ Performance ${res.performanceId} not found for Reservation ${res.reservationId}`);
            continue;
        }
        const venue = venueMap.get(perf.venueId);

        console.log(`  - Patching Reservation: ${res.reservationId}`);
        await docClient.send(new UpdateCommand({
            TableName: RESERVATIONS_TABLE,
            Key: { reservationId: res.reservationId },
            UpdateExpression: "SET posterUrl = :p, venue = :v, performanceTitle = :t",
            ExpressionAttributeValues: {
                ":p": perf.posterUrl || perf.poster || "",
                ":v": venue ? (venue.venueName || venue.name) : (res.venue || "Charlotte Theater"),
                ":t": perf.title || res.performanceTitle || "Unknown"
            }
        }));
    }

    console.log("🎉 Full Denormalization Sync Completed Successfully!");
}

syncAllData().catch(err => {
    console.error("❌ Sync Failed:", err);
    process.exit(1);
});
