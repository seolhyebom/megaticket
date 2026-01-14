import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-schedules";
const createdAt = new Date().toISOString();

// 뮤지컬별 캐스팅 정보
const castings = {
    "perf-jekyll-hyde": {
        "지킬/하이드": ["홍광호", "김성철", "전동석"],
        "루시": ["선민", "김현희", "윤공주"],
        "엠마": ["손지수", "조정은", "최수진"],
        "댄버스 경": ["김용수", "김병헌"],
        "어터슨": ["윤영석", "이희정"]
    },
    "perf-aladdin": {
        "알라딘": ["김준수", "서경수", "박강현"],
        "지니": ["정성화", "정원영", "강홍석"],
        "자스민": ["이성경", "민경아", "최지혜"],
        "자파": ["윤선용", "임별"],
        "술탄": ["이상준", "황만익"]
    }
};

// 뮤지컬 스케줄 데이터
const schedules = [
    // 지킬앤하이드 (perf-jekyll-hyde) - 10회
    { performanceId: "perf-jekyll-hyde", date: "2026-05-12", time: "19:30", dayOfWeek: "화" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-13", time: "14:30", dayOfWeek: "수" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-13", time: "19:30", dayOfWeek: "수" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-14", time: "19:30", dayOfWeek: "목" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-15", time: "14:30", dayOfWeek: "금" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-15", time: "19:30", dayOfWeek: "금" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-16", time: "14:00", dayOfWeek: "토" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-16", time: "19:00", dayOfWeek: "토" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-17", time: "14:00", dayOfWeek: "일" },
    { performanceId: "perf-jekyll-hyde", date: "2026-05-17", time: "19:00", dayOfWeek: "일" },

    // 알라딘 (perf-aladdin) - 9회
    { performanceId: "perf-aladdin", date: "2026-05-19", time: "19:30", dayOfWeek: "화" },
    { performanceId: "perf-aladdin", date: "2026-05-20", time: "19:30", dayOfWeek: "수" },
    { performanceId: "perf-aladdin", date: "2026-05-21", time: "19:30", dayOfWeek: "목" },
    { performanceId: "perf-aladdin", date: "2026-05-22", time: "14:30", dayOfWeek: "금" },
    { performanceId: "perf-aladdin", date: "2026-05-22", time: "19:30", dayOfWeek: "금" },
    { performanceId: "perf-aladdin", date: "2026-05-23", time: "14:00", dayOfWeek: "토" },
    { performanceId: "perf-aladdin", date: "2026-05-23", time: "19:00", dayOfWeek: "토" },
    { performanceId: "perf-aladdin", date: "2026-05-24", time: "15:00", dayOfWeek: "일" }
];

async function uploadSchedules() {
    console.log("🚀 뮤지컬 스케줄 업로드 시작...\n");

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

    console.log(`\n🎭 뮤지컬 스케줄 업로드 완료! (${schedules.length}개)`);
}

uploadSchedules().catch(console.error);
