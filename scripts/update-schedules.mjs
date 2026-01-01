// schedules 테이블 필드 업데이트 스크립트
// status, totalSeats, casting, createdAt 추가

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const SCHEDULES_TABLE = "KDT-Msp4-PLDR-schedules";
const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";
const VENUES_TABLE = "KDT-Msp4-PLDR-venues";

// Cache for performances and venues
const perfCache = new Map();
const venueCache = new Map();

async function getPerformance(performanceId) {
    if (perfCache.has(performanceId)) {
        return perfCache.get(performanceId);
    }

    const result = await docClient.send(new ScanCommand({
        TableName: PERFORMANCES_TABLE,
        FilterExpression: "performanceId = :pid",
        ExpressionAttributeValues: { ":pid": performanceId }
    }));

    const perf = result.Items?.[0] || null;
    perfCache.set(performanceId, perf);
    return perf;
}

async function getVenueTotalSeats() {
    if (venueCache.has("totalSeats")) {
        return venueCache.get("totalSeats");
    }

    const result = await docClient.send(new ScanCommand({
        TableName: VENUES_TABLE,
        Limit: 1
    }));

    const totalSeats = result.Items?.[0]?.totalSeats || 1240;
    venueCache.set("totalSeats", totalSeats);
    return totalSeats;
}

async function updateSchedules() {
    console.log("🔍 Scanning schedules table...");

    const result = await docClient.send(new ScanCommand({
        TableName: SCHEDULES_TABLE
    }));

    if (!result.Items || result.Items.length === 0) {
        console.log("❌ No schedules found.");
        return;
    }

    console.log(`📋 Found ${result.Items.length} schedules`);

    // Get venue totalSeats first
    const venueTotalSeats = await getVenueTotalSeats();
    console.log(`📍 Venue totalSeats: ${venueTotalSeats}`);

    let updated = 0;
    for (const schedule of result.Items) {
        const scheduleId = schedule.scheduleId;
        const performanceId = schedule.performanceId;

        // Get casting from performance
        const perf = await getPerformance(performanceId);
        const casting = perf?.cast || {};

        // Check what fields are missing
        const hasStatus = !!schedule.status;
        const hasTotalSeats = schedule.totalSeats !== undefined;
        const hasCasting = schedule.casting && Object.keys(schedule.casting).length > 0;
        const hasCreatedAt = !!schedule.createdAt;

        // Build update expression
        const updates = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        if (!hasStatus) {
            updates.push("#status = :status");
            expressionAttributeNames["#status"] = "status";
            expressionAttributeValues[":status"] = "AVAILABLE";
        }

        if (!hasTotalSeats) {
            updates.push("totalSeats = :totalSeats");
            expressionAttributeValues[":totalSeats"] = venueTotalSeats;
        }

        if (!hasCasting && Object.keys(casting).length > 0) {
            updates.push("casting = :casting");
            expressionAttributeValues[":casting"] = casting;
        }

        if (!hasCreatedAt) {
            updates.push("createdAt = :createdAt");
            expressionAttributeValues[":createdAt"] = new Date().toISOString();
        }

        if (updates.length === 0) {
            continue;
        }

        const updateExpression = "SET " + updates.join(", ");

        await docClient.send(new UpdateCommand({
            TableName: SCHEDULES_TABLE,
            Key: { scheduleId: scheduleId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues
        }));

        updated++;
        if (updated % 10 === 0) {
            console.log(`  Updated ${updated} schedules...`);
        }
    }

    console.log(`\n✅ Schedules update complete! Updated ${updated} schedules.`);
}

updateSchedules().catch(console.error);
