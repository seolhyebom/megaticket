import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-schedules";
const createdAt = new Date().toISOString();

// 콘서트별 캐스팅 정보
const castings = {
    "perf-bts-worldtour": {
        bts: ["정국", "뷔", "지민", "RM", "제이홉", "슈가", "진"]
    },
    "perf-blackpink-worldtour": {
        blackpink: ["지수", "제니", "로제", "리사"]
    },
    "perf-day6-present": {
        day6: ["성진", "Young K", "원필", "도운"]
    },
    "perf-ive-showhave": {
        ive: ["안유진", "가을", "레이", "장원영", "리즈", "이서"]
    }
};

// 12개 스케줄 데이터
const schedules = [
    // BTS - 2/20-22, 19:00
    { performanceId: "perf-bts-worldtour", date: "2026-02-20", time: "19:00", dayOfWeek: "금" },
    { performanceId: "perf-bts-worldtour", date: "2026-02-21", time: "19:00", dayOfWeek: "토" },
    { performanceId: "perf-bts-worldtour", date: "2026-02-22", time: "19:00", dayOfWeek: "일" },

    // IVE - 2/27-3/1, 18:00
    { performanceId: "perf-ive-showhave", date: "2026-02-27", time: "18:00", dayOfWeek: "금" },
    { performanceId: "perf-ive-showhave", date: "2026-02-28", time: "18:00", dayOfWeek: "토" },
    { performanceId: "perf-ive-showhave", date: "2026-03-01", time: "18:00", dayOfWeek: "일" },

    // BLACKPINK - 3/13-15, 19:00
    { performanceId: "perf-blackpink-worldtour", date: "2026-03-13", time: "19:00", dayOfWeek: "금" },
    { performanceId: "perf-blackpink-worldtour", date: "2026-03-14", time: "19:00", dayOfWeek: "토" },
    { performanceId: "perf-blackpink-worldtour", date: "2026-03-15", time: "19:00", dayOfWeek: "일" },

    // DAY6 - 3/27-29, 18:00
    { performanceId: "perf-day6-present", date: "2026-03-27", time: "18:00", dayOfWeek: "금" },
    { performanceId: "perf-day6-present", date: "2026-03-28", time: "18:00", dayOfWeek: "토" },
    { performanceId: "perf-day6-present", date: "2026-03-29", time: "18:00", dayOfWeek: "일" }
];

async function uploadSchedules() {
    console.log("🚀 콘서트 스케줄 업로드 시작...\n");

    for (const schedule of schedules) {
        const scheduleId = `${schedule.performanceId}-${schedule.date}-${schedule.time}`;
        const datetime = `${schedule.date}T${schedule.time}`;

        const item = {
            scheduleId,
            performanceId: schedule.performanceId,
            date: schedule.date,
            time: schedule.time,
            datetime,
            dayOfWeek: schedule.dayOfWeek,
            totalSeats: 1210,
            availableSeats: 1210,
            status: "AVAILABLE",
            casting: castings[schedule.performanceId],
            createdAt
        };

        console.log(`Uploading: ${scheduleId}`);

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item
        }));

        console.log(`✅ Success`);
    }

    console.log("\n🎉 모든 스케줄 업로드 완료! (12개)");
}

uploadSchedules().catch(console.error);
