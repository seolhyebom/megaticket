import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

// 업데이트할 데이터
const updates = [
    {
        performanceId: "perf-bts-worldtour",
        title: "BTS MAP OF THE SOUL TOUR",
        seatColors: { VIP: "#9333EA", R: "#C4B5FD" },
        seatGrades: [
            { grade: "VIP", price: 220000, color: "#9333EA", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 170000, color: "#C4B5FD", description: "2층 전체" }
        ]
    },
    {
        performanceId: "perf-blackpink-worldtour",
        title: "BLACKPINK WORLD TOUR IN GOYANG",
        seatColors: { VIP: "#EC4899", R: "#F9A8D4" },
        seatGrades: [
            { grade: "VIP", price: 210000, color: "#EC4899", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 160000, color: "#F9A8D4", description: "2층 전체" }
        ]
    },
    {
        performanceId: "perf-day6-present",
        title: "DAY6 The Present",
        seatColors: { VIP: "#EAB308", R: "#FDE68A" },
        seatGrades: [
            { grade: "VIP", price: 150000, color: "#EAB308", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 120000, color: "#FDE68A", description: "2층 전체" }
        ]
    },
    {
        performanceId: "perf-ive-showhave",
        title: "IVE THE 1ST WORLD TOUR",
        seatColors: { VIP: "#DC2626", R: "#FCA5A5" },
        seatGrades: [
            { grade: "VIP", price: 200000, color: "#DC2626", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 150000, color: "#FCA5A5", description: "2층 전체" }
        ]
    }
];

async function updateConcerts() {
    console.log("🎨 콘서트 색상 및 타이틀 업데이트 시작...\n");

    for (const update of updates) {
        console.log(`Updating: ${update.performanceId}`);
        console.log(`  - title: ${update.title}`);
        console.log(`  - VIP: ${update.seatColors.VIP}, R: ${update.seatColors.R}`);

        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: update.performanceId },
            UpdateExpression: "SET title = :title, seatColors = :seatColors, seatGrades = :seatGrades",
            ExpressionAttributeValues: {
                ":title": update.title,
                ":seatColors": update.seatColors,
                ":seatGrades": update.seatGrades
            }
        }));

        console.log(`✅ Success\n`);
    }

    console.log("🎉 모든 업데이트 완료!");
}

updateConcerts().catch(console.error);
