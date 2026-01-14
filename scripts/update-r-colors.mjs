import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

// R석 색상 더 진하게 업데이트
const updates = [
    {
        performanceId: "perf-bts-worldtour",
        seatColors: { VIP: "#9333EA", R: "#A78BFA" },
        seatGrades: [
            { grade: "VIP", price: 220000, color: "#9333EA", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 170000, color: "#A78BFA", description: "2층 전체" }
        ]
    },
    {
        performanceId: "perf-blackpink-worldtour",
        seatColors: { VIP: "#EC4899", R: "#F472B6" },
        seatGrades: [
            { grade: "VIP", price: 210000, color: "#EC4899", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 160000, color: "#F472B6", description: "2층 전체" }
        ]
    },
    {
        performanceId: "perf-day6-present",
        seatColors: { VIP: "#EAB308", R: "#FCD34D" },
        seatGrades: [
            { grade: "VIP", price: 150000, color: "#EAB308", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 120000, color: "#FCD34D", description: "2층 전체" }
        ]
    },
    {
        performanceId: "perf-ive-showhave",
        seatColors: { VIP: "#DC2626", R: "#F87171" },
        seatGrades: [
            { grade: "VIP", price: 200000, color: "#DC2626", description: "1층 전체, 최고의 시야" },
            { grade: "R", price: 150000, color: "#F87171", description: "2층 전체" }
        ]
    }
];

async function updateColors() {
    console.log("🎨 R석 색상 진하게 업데이트...\n");

    for (const update of updates) {
        console.log(`Updating: ${update.performanceId}`);
        console.log(`  VIP: ${update.seatColors.VIP}, R: ${update.seatColors.R}`);

        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: update.performanceId },
            UpdateExpression: "SET seatColors = :seatColors, seatGrades = :seatGrades",
            ExpressionAttributeValues: {
                ":seatColors": update.seatColors,
                ":seatGrades": update.seatGrades
            }
        }));

        console.log(`✅ Success\n`);
    }

    console.log("🎉 모든 색상 업데이트 완료!");
}

updateColors().catch(console.error);
