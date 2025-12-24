
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "pldr-performances";

// Create DynamoDB Client
const client = new DynamoDBClient({
    region: REGION,
    // Credentials are automatically loaded from env vars or ~/.aws/credentials
});

const docClient = DynamoDBDocumentClient.from(client);

export interface Performance {
    concertId: string;
    title: string;
    artist: string;
    date: string;
    time?: string;
    venue: string;
    price: number;
    description: string;
}

/**
 * Searches for performances in DynamoDB based on the user query.
 * Uses a Scan operation (suitable for small datasets).
 * @param query User's search query
 * @returns Formatted context string for LLM
 */
// Mock Data for Prototype
const MOCK_PERFORMANCES: Performance[] = [
    {
        concertId: "perf-phantom-of-the-opera-1",
        title: "오페라의 유령",
        artist: "조승우, 최재림",
        date: "2025-12-25",
        time: "19:00",
        venue: "샤롯데씨어터",
        price: 150000,
        description: "전 세계를 매혹시킨 불멸의 명작, 오페라의 유령! [가격] VIP석 150,000원 / R석 120,000원 / S석 90,000원 / A석 60,000원"
    },
    {
        concertId: "perf-2",
        title: "호두까기 인형",
        artist: "국립발레단",
        date: "2025-12-24",
        time: "15:00",
        venue: "예술의전당 오페라극장",
        price: 80000,
        description: "크리스마스 시즌 최고의 선물, 호두까기 인형. [가격] VIP석 100,000원 / R석 80,000원 / S석 50,000원"
    },
    {
        concertId: "perf-3",
        title: "오페라의 유령",
        artist: "김주택, 전동석",
        date: "2025-12-24",
        time: "19:30",
        venue: "샤롯데씨어터",
        price: 150000,
        description: "전 세계를 매혹시킨 불멸의 명작, 오페라의 유령! [가격] VIP석 150,000원 / R석 120,000원 / S석 90,000원 / A석 60,000원"
    },
    // 킹키부츠 (Kinky Boots) 공연 데이터
    {
        concertId: "perf-kinky-1",
        title: "킹키부츠",
        artist: "김호영(찰리), 서경수(롤라), 한재아(로렌)",
        date: "2026-02-10",
        time: "19:30",
        venue: "샤롯데시어터",
        price: 170000,
        description: "토니상 6관왕 수상작! 아버지로부터 물려받은 구두 공장의 위기를 극복하기 위해, 평범한 청년 찰리와 화려한 드래그퀸 롤라가 만나 세상에 없던 특별한 구두 '킹키부츠'를 만들어가는 이야기. 신디 로퍼 작곡의 감동적인 브로맨스! [가격] VIP/OP석 170,000원 / R석 140,000원 / S석 110,000원 / A석 80,000원 [러닝타임] 155분 (인터미션 20분) [관람연령] 8세 이상"
    },
    {
        concertId: "perf-kinky-2",
        title: "킹키부츠",
        artist: "신재범(찰리), 강홍석(롤라), 허윤슬(로렌)",
        date: "2026-02-11",
        time: "14:00",
        venue: "샤롯데시어터",
        price: 170000,
        description: "토니상 6관왕 수상작! 아버지로부터 물려받은 구두 공장의 위기를 극복하기 위해, 평범한 청년 찰리와 화려한 드래그퀸 롤라가 만나 세상에 없던 특별한 구두 '킹키부츠'를 만들어가는 이야기. 신디 로퍼 작곡의 감동적인 브로맨스! [가격] VIP/OP석 170,000원 / R석 140,000원 / S석 110,000원 / A석 80,000원 [러닝타임] 155분 (인터미션 20분) [관람연령] 8세 이상"
    },
    {
        concertId: "perf-kinky-3",
        title: "킹키부츠",
        artist: "이재환(찰리), 백형훈(롤라), 한재아(로렌)",
        date: "2026-03-15",
        time: "19:00",
        venue: "샤롯데시어터",
        price: 170000,
        description: "토니상 6관왕 수상작! 아버지로부터 물려받은 구두 공장의 위기를 극복하기 위해, 평범한 청년 찰리와 화려한 드래그퀸 롤라가 만나 세상에 없던 특별한 구두 '킹키부츠'를 만들어가는 이야기. 신디 로퍼 작곡의 감동적인 브로맨스! [가격] VIP/OP석 170,000원 / R석 140,000원 / S석 110,000원 / A석 80,000원 [러닝타임] 155분 (인터미션 20분) [관람연령] 8세 이상"
    },
    {
        concertId: "perf-kinky-4",
        title: "킹키부츠",
        artist: "김호영(찰리), 강홍석(롤라), 허윤슬(로렌)",
        date: "2026-04-25",
        time: "14:00",
        venue: "샤롯데시어터",
        price: 170000,
        description: "토니상 6관왕 수상작! 아버지로부터 물려받은 구두 공장의 위기를 극복하기 위해, 평범한 청년 찰리와 화려한 드래그퀸 롤라가 만나 세상에 없던 특별한 구두 '킹키부츠'를 만들어가는 이야기. 신디 로퍼 작곡의 감동적인 브로맨스! [가격] VIP/OP석 170,000원 / R석 140,000원 / S석 110,000원 / A석 80,000원 [러닝타임] 155분 (인터미션 20분) [관람연령] 8세 이상"
    }
];

export async function searchPerformances(query: string): Promise<string> {
    try {
        // Mock Search Implementation
        const normalizedQuery = query.toLowerCase();
        const keywords = normalizedQuery.split(/\s+/).filter(k => k.length > 0);

        const relevantItems = MOCK_PERFORMANCES.filter(item => {
            const text = `${item.title} ${item.artist} ${item.description} ${item.venue}`.toLowerCase();
            return keywords.some(keyword => text.includes(keyword));
        });

        if (relevantItems.length === 0) {
            // Fallback: If query implies recommendations
            if (normalizedQuery.includes("추천") || normalizedQuery.includes("목록") || normalizedQuery.includes("공연")) {
                return formatContext(MOCK_PERFORMANCES);
            }
            return "";
        }

        // Sort by date ascending
        relevantItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return formatContext(relevantItems.slice(0, 5));

    } catch (error) {
        console.error("Error searching mock data:", error);
        return "";
    }
}

function formatContext(performances: Performance[]): string {
    if (!performances || performances.length === 0) return "";

    const formatted = performances.map(p => {
        return `
<performance>
  <id>${p.concertId}</id>
  <title>${p.title}</title>
  <artist>${p.artist}</artist>
  <date>${p.date}</date>
  <time>${p.time || "미정"}</time>
  <venue>${p.venue}</venue>
  <price>${p.price.toLocaleString()} KRW</price>
  <description>${p.description}</description>
</performance>`.trim();
    }).join("\n");

    return `
<context>
Here is the real-time performance data fetched from the database:
${formatted}
</context>
`.trim();
}
