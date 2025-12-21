
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "pldr-performances";

// Create DynamoDB Client
const client = new DynamoDBClient({
    region: REGION,
    // Credentials are automatically loaded from env vars or ~/.aws/credentials
});

const docClient = DynamoDBDocumentClient.from(client);

const SAMPLE_DATA = [
    {
        concertId: "CONCERT001",
        title: "아이유 콘서트 2025: The Golden Hour",
        artist: "아이유",
        date: "2025-12-25",
        time: "19:00",
        venue: "올림픽공원 체조경기장 (KSPO DOME)",
        price: 132000,
        description: "아이유의 데뷔 15주년 기념 연말 콘서트. 화려한 무대와 감동적인 라이브."
    },
    {
        concertId: "CONCERT002",
        title: "호두까기 인형 - 국립발레단",
        artist: "국립발레단",
        date: "2025-12-24",
        time: "15:00",
        venue: "예술의전당 오페라극장",
        price: 80000,
        description: "크리스마스 시즌 필수 관람 공연. 국립발레단의 환상적인 호두까기 인형."
    },
    {
        concertId: "CONCERT003",
        title: "싸이 올나잇 스탠드 2025",
        artist: "싸이",
        date: "2025-12-23",
        time: "23:42",
        venue: "잠실 실내체육관",
        price: 154000,
        description: "밤새도록 뛰노는 광란의 파티. 기록적인 앵콜이 이어지는 싸이의 연말 콘서트."
    },
    {
        concertId: "CONCERT004",
        title: "뮤지컬 지킬 앤 하이드",
        artist: "조승우, 홍광호",
        date: "2025-11-01 ~ 2026-02-28",
        time: "20:00",
        venue: "샤롯데씨어터",
        price: 160000,
        description: "브로드웨이 역사상 가장 아름다운 스릴러. '지금 이 순간'의 감동을 다시 한번."
    },
    {
        concertId: "CONCERT005",
        title: "임영웅 전국투어 콘서트 - 서울",
        artist: "임영웅",
        date: "2025-12-10 ~ 2025-12-12",
        time: "18:00",
        venue: "고척 스카이돔",
        price: 165000,
        description: "영웅시대와 함께하는 감동의 무대. 전석 매진 신화의 임영웅 콘서트."
    }
];

async function seedData() {
    console.log(`Starting data seeding to table: ${TABLE_NAME} in ${REGION}...`);

    try {
        // Use BatchWrite for efficiency
        // Note: BatchWrite can handle max 25 items. We have 5, so it's fine.
        const putRequests = SAMPLE_DATA.map(item => ({
            PutRequest: {
                Item: item
            }
        }));

        const command = new BatchWriteCommand({
            RequestItems: {
                [TABLE_NAME]: putRequests
            }
        });

        const response = await docClient.send(command);

        if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
            console.warn("Some items were not processed:", response.UnprocessedItems);
        } else {
            console.log("✅ Successfully seeded all sample data!");
        }

    } catch (error) {
        console.error("❌ Error seeding data:", error);
        process.exit(1);
    }
}

seedData();
