import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";

/**
 * 전체 DB 복구용 - performances 테이블 초기 데이터 생성
 * 참고: docs/DynamoDB_Schema.md
 */

const seatGrades = [
    { grade: "VIP", price: 170000, color: "#FF0000", description: "1층 정중앙 앞쪽, 최고의 시야" },
    { grade: "R", price: 140000, color: "#FFA500", description: "1층 중앙부, 훌륭한 시야" },
    { grade: "S", price: 110000, color: "#1E90FF", description: "1층 측면 또는 2층 앞쪽" },
    { grade: "A", price: 80000, color: "#32CD32", description: "2층 뒤쪽, 가성비 좋은 좌석" },
    { grade: "OP", price: 170000, color: "#9E37D1", description: "오케스트라 피트 석, 무대 바로 앞 특별석" }
];

const seatColors = {
    VIP: "#FF0000",
    R: "#FFA500",
    S: "#1E90FF",
    A: "#32CD32",
    OP: "#9E37D1"
};

const performances = [
    {
        performanceId: "perf-kinky-1",
        title: "킹키부츠",
        description: "신디 로퍼 작곡의 감동적인 브로맨스 뮤지컬. 신발 공장 상속인 찰리와 드래그 퀸 롤라의 우정과 성장 이야기.",
        venue: "샤롯데씨어터",
        venueId: "charlotte-theater",
        posterUrl: "/posters/kinky.jpg",
        dateRange: "2026.02.10 ~ 2026.04.30",
        startDate: "2026-02-10",
        endDate: "2026-04-30",
        schedule: "화~금 19:30 / 토 14:00, 19:00 / 일 14:00, 18:00",
        price: "OP석 170,000원 / VIP석 170,000원 / R석 140,000원 / S석 110,000원 / A석 80,000원",
        hasOPSeats: true,
        seatGrades: seatGrades,
        seatColors: seatColors,
        cast: {
            charlie: ["김호영", "신재범", "이재환"],
            lola: ["서경수", "강홍석", "백형훈"],
            lauren: ["한재아", "허윤슬"],
            don: ["심재현", "신승환", "김동현"],
            nicola: ["이루원", "유주연"]
        },
        createdAt: new Date().toISOString()
    },
    {
        performanceId: "perf-phantom-of-the-opera-1",
        title: "오페라의 유령",
        description: "앤드루 로이드 웨버의 역대급 뮤지컬. 파리 오페라 하우스의 미스터리한 사랑 이야기.",
        venue: "샤롯데씨어터",
        venueId: "charlotte-theater",
        posterUrl: "/posters/phantom.jpg",
        dateRange: "2026.03.01 ~ 2026.05.31",
        startDate: "2026-03-01",
        endDate: "2026-05-31",
        schedule: "화~금 19:30 / 토 14:00, 19:00 / 일 14:00, 18:00",
        price: "VIP석 180,000원 / R석 150,000원 / S석 120,000원 / A석 90,000원",
        hasOPSeats: false,
        seatGrades: [
            { grade: "VIP", price: 180000, color: "#FF0000", description: "1층 정중앙 앞쪽, 최고의 시야" },
            { grade: "R", price: 150000, color: "#FFA500", description: "1층 중앙부, 훌륭한 시야" },
            { grade: "S", price: 120000, color: "#1E90FF", description: "1층 측면 또는 2층 앞쪽" },
            { grade: "A", price: 90000, color: "#32CD32", description: "2층 뒤쪽, 가성비 좋은 좌석" }
        ],
        seatColors: {
            VIP: "#FF0000",
            R: "#FFA500",
            S: "#1E90FF",
            A: "#32CD32"
        },
        cast: {
            phantom: ["전동석", "박은태"],
            christine: ["손지수", "정선아"],
            raoul: ["정택운", "마이클리"]
        },
        createdAt: new Date().toISOString()
    }
];

async function initPerformances() {
    console.log("🚀 Initializing performances table with seed data...\n");

    for (const perf of performances) {
        try {
            await docClient.send(new PutCommand({
                TableName: PERFORMANCES_TABLE,
                Item: perf
            }));
            console.log(`✅ Created: ${perf.title} (${perf.performanceId})`);
        } catch (e) {
            console.error(`❌ Failed to create ${perf.performanceId}:`, e);
        }
    }

    console.log("\n🎉 Performances initialization complete!");
    console.log("👉 Next step: Run 'node update_performance_data.py' or 'node generate-schedules.mjs' to create schedules.");
}

initPerformances();
