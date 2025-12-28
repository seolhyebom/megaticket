import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";
const SCHEDULES_TABLE = process.env.DYNAMODB_SCHEDULES_TABLE || "KDT-Msp4-PLDR-schedules";

const DAY_MAP = {
    "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6
};
const REVERSE_DAY_MAP = Object.keys(DAY_MAP);

function parseScheduleRule(scheduleStr) {
    if (!scheduleStr) return {};
    // "화~금 19:30 / 토 14:00, 19:00 / 일 14:00, 18:00"
    const parts = scheduleStr.split("/").map(p => p.trim());
    const rule = {};

    parts.forEach(part => {
        const match = part.match(/^([가-힣\s~]+)\s+(.+)$/);
        if (match) {
            const dayPart = match[1].replace(/\s/g, "");
            const times = match[2].split(",").map(t => t.trim());

            if (dayPart.includes("~")) {
                const [startDay, endDay] = dayPart.split("~");
                const startIdx = DAY_MAP[startDay];
                const endIdx = DAY_MAP[endDay];

                for (let i = startIdx; i <= endIdx; i++) {
                    rule[REVERSE_DAY_MAP[i]] = times;
                }
            } else {
                // Handle multiple days like "토,일" if needed, but the current format is single or range
                rule[dayPart] = times;
            }
        }
    });

    return rule;
}

function generateSchedules(perfId, startDate, endDate, rule) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result = [];

    let current = new Date(start);
    while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        const dayName = REVERSE_DAY_MAP[current.getDay()];
        const times = rule[dayName];

        if (times && times.length > 0) {
            result.push({
                date: dateStr,
                dayOfWeek: dayName,
                times: times.map(t => ({
                    time: t,
                    availableSeats: 1240, // Capacity
                    status: "available"
                }))
            });
        }
        current.setDate(current.getDate() + 1);
    }
    return result;
}

async function run() {
    console.log("Fetching all performances...");
    const { Items } = await docClient.send(new ScanCommand({ TableName: PERFORMANCES_TABLE }));

    for (const perf of Items) {
        console.log(`Processing: ${perf.title} (${perf.performanceId || perf.id})...`);
        const rule = parseScheduleRule(perf.schedule);
        const schedules = generateSchedules(perf.performanceId || perf.id, perf.startDate, perf.endDate, rule);

        console.log(`Generated ${schedules.length} days of schedules.`);

        // Update Performance table with aggregated schedules
        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: perf.performanceId || perf.id },
            UpdateExpression: "SET schedules = :s",
            ExpressionAttributeValues: { ":s": schedules }
        }));

        // Update individual Schedules table
        // Group into batches of 25 for BatchWrite
        for (let i = 0; i < schedules.length; i += 25) {
            const batch = schedules.slice(i, i + 25);
            const putRequests = batch.flatMap(day => day.times.map(t => ({
                PutRequest: {
                    Item: {
                        scheduleId: `${perf.performanceId || perf.id}-${day.date}-${t.time}`,
                        performanceId: perf.performanceId || perf.id,
                        date: day.date,
                        time: t.time,
                        datetime: `${day.date}T${t.time}`,
                        dayOfWeek: day.dayOfWeek,
                        availableSeats: t.availableSeats,
                        casting: [] // Placeholder
                    }
                }
            })));

            // Sub-divide into batches of 25 again if needed (one day can have multiple times)
            for (let j = 0; j < putRequests.length; j += 25) {
                const subBatch = putRequests.slice(j, j + 25);
                await docClient.send(new BatchWriteCommand({
                    RequestItems: {
                        [SCHEDULES_TABLE]: subBatch
                    }
                }));
            }
        }
    }
    console.log("All schedules updated successfully.");
}

run().catch(console.error);
