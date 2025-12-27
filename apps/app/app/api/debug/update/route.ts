import { NextResponse } from "next/server";
import { dynamoDb, PERFORMANCES_TABLE, SCHEDULES_TABLE } from "@/lib/dynamodb";
import { ScanCommand, UpdateCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const DAY_MAP = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };
const REVERSE_DAY_MAP = Object.keys(DAY_MAP);

function parseScheduleRule(scheduleStr: string) {
    if (!scheduleStr) return {};
    const parts = scheduleStr.split("/").map(p => p.trim());
    const rule: Record<string, string[]> = {};
    parts.forEach(part => {
        const match = part.match(/^([가-힣\s~]+)\s+(.+)$/);
        if (match) {
            const dayPart = match[1].replace(/\s/g, "");
            const times = match[2].split(",").map(t => t.trim());
            if (dayPart.includes("~")) {
                const [startDay, endDay] = dayPart.split("~");
                const startIdx = (DAY_MAP as any)[startDay];
                const endIdx = (DAY_MAP as any)[endDay];
                for (let i = startIdx; i <= endIdx; i++) {
                    rule[REVERSE_DAY_MAP[i]] = times;
                }
            } else {
                rule[dayPart] = times;
            }
        }
    });
    return rule;
}

const SEAT_GRADES_CONFIG = {
    "phantom": {
        grades: [
            { grade: "VIP", desc: "최고의 시야와 음향" },
            { grade: "R", desc: "균형 잡힌 시야" },
            { grade: "S", desc: "합리적인 가격의 2층 중앙" },
            { grade: "A", desc: "가성비 좌석" }
        ],
        colors: { "VIP": "#800080", "R": "#4B0082", "S": "#0000FF", "A": "#008000" }
    },
    "kinky": {
        grades: [
            { grade: "OP", desc: "무대 바로 앞 오케스트라 피트석" },
            { grade: "VIP", desc: "1층 중앙 및 주요 시야" },
            { grade: "R", desc: "1층 사이드 및 2층 앞열" },
            { grade: "S", desc: "2층 중앙" },
            { grade: "A", desc: "2층 후열" }
        ],
        colors: { "OP": "#FF0000", "VIP": "#FFD700", "R": "#FFA500", "S": "#1E90FF", "A": "#32CD32" }
    },
    "chicago": {
        grades: [
            { grade: "VIP", desc: "1층 중앙 및 주요 시야" },
            { grade: "R", desc: "1층 사이드 및 2층 앞열" },
            { grade: "S", desc: "2층 중앙" },
            { grade: "A", desc: "2층 후열" }
        ],
        colors: { "VIP": "#FFD700", "R": "#FFA500", "S": "#1E90FF", "A": "#32CD32" }
    }
};

export async function GET() {
    try {
        const { Items } = await dynamoDb.send(new ScanCommand({ TableName: PERFORMANCES_TABLE }));
        if (!Items) return NextResponse.json({ error: "No items" });

        const results = [];

        for (const perf of Items) {
            const pid = perf.performanceId || perf.id;

            // 1. Update Grades & Colors
            let config = (SEAT_GRADES_CONFIG as any)["kinky"];
            if (pid.toLowerCase().includes("phantom")) config = SEAT_GRADES_CONFIG.phantom;
            else if (pid.toLowerCase().includes("chicago")) config = SEAT_GRADES_CONFIG.chicago;

            await dynamoDb.send(new UpdateCommand({
                TableName: PERFORMANCES_TABLE,
                Key: { performanceId: pid },
                UpdateExpression: "SET seatGrades = :g, seatColors = :c",
                ExpressionAttributeValues: { ":g": config.grades, ":c": config.colors }
            }));

            // 2. Generate Schedules
            const rule = parseScheduleRule(perf.schedule);
            const start = new Date(perf.startDate);
            const end = new Date(perf.endDate);
            const schedules = [];
            let current = new Date(start);
            while (current <= end) {
                const dateStr = current.toISOString().split("T")[0];
                const dayName = REVERSE_DAY_MAP[current.getDay()];
                const times = rule[dayName];
                if (times) {
                    schedules.push({
                        date: dateStr,
                        dayOfWeek: dayName,
                        times: times.map(t => ({ time: t, availableSeats: 1240, status: "available" }))
                    });
                }
                current.setDate(current.getDate() + 1);
            }

            await dynamoDb.send(new UpdateCommand({
                TableName: PERFORMANCES_TABLE,
                Key: { performanceId: pid },
                UpdateExpression: "SET schedules = :s",
                ExpressionAttributeValues: { ":s": schedules }
            }));

            // 3. Update Schedules Table (Limited batches)
            for (let i = 0; i < schedules.length; i += 25) {
                const batch = schedules.slice(i, i + 25);
                const reqs = batch.flatMap(day => day.times.map(t => ({
                    PutRequest: {
                        Item: {
                            scheduleId: `${pid}-${day.date}-${t.time}`,
                            performanceId: pid,
                            date: day.date,
                            time: t.time,
                            datetime: `${day.date}T${t.time}`,
                            dayOfWeek: day.dayOfWeek,
                            availableSeats: 1240, casting: []
                        }
                    }
                })));
                for (let j = 0; j < reqs.length; j += 10) { // Smaller sub-batches
                    await dynamoDb.send(new BatchWriteCommand({ RequestItems: { [SCHEDULES_TABLE]: reqs.slice(j, j + 10) } }));
                }
            }

            results.push({ id: pid, status: "updated", scheduleCount: schedules.length });
        }

        return NextResponse.json({ success: true, results });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
