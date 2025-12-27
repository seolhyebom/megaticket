import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "KDT-Msp4-PLDR-performances"; // Hardcoded based on verification

const SEAT_GRADES = {
    // 1. 오페라의 유령
    "phantom": {
        grades: [
            { grade: "VIP", desc: "최고의 시야와 음향" },
            { grade: "R", desc: "균형 잡힌 시야" },
            { grade: "S", desc: "합리적인 가격의 2층 중앙" },
            { grade: "A", desc: "가성비 좌석" }
        ],
        colors: {
            "VIP": "#800080",
            "R": "#4B0082",
            "S": "#0000FF",
            "A": "#008000"
        }
    },
    // 2. 킹키부츠 (Standard)
    "kinky": {
        grades: [
            { grade: "OP", desc: "무대 바로 앞 오케스트라 피트석" },
            { grade: "VIP", desc: "1층 중앙 및 주요 시야" },
            { grade: "R", desc: "1층 사이드 및 2층 앞열" },
            { grade: "S", desc: "2층 중앙" },
            { grade: "A", desc: "2층 후열" }
        ],
        colors: {
            "OP": "#FF0000",
            "VIP": "#FFD700",
            "R": "#FFA500",
            "S": "#1E90FF",
            "A": "#32CD32"
        }
    },
    // 3. 시카고 (Standard fallback)
    "chicago": {
        grades: [
            { grade: "VIP", desc: "1층 중앙 및 주요 시야" },
            { grade: "R", desc: "1층 사이드 및 2층 앞열" },
            { grade: "S", desc: "2층 중앙" },
            { grade: "A", desc: "2층 후열" }
        ],
        colors: {
            "VIP": "#FFD700",
            "R": "#FFA500",
            "S": "#1E90FF",
            "A": "#32CD32"
        }
    }
};

async function updatePerformances() {
    console.log("Scanning performances table...");
    const scanCmd = new ScanCommand({ TableName: TABLE_NAME });
    const result = await docClient.send(scanCmd);

    if (!result.Items || result.Items.length === 0) {
        console.log("No performances found.");
        return;
    }

    console.log(`Found ${result.Items.length} performances.`);

    for (const item of result.Items) {
        const perfId = item.performanceId;
        let config = SEAT_GRADES["kinky"]; // Default

        if (perfId.toLowerCase().includes("phantom")) {
            config = SEAT_GRADES["phantom"];
        } else if (perfId.toLowerCase().includes("chicago")) {
            config = SEAT_GRADES["chicago"];
        }

        console.log(`Updating ${perfId} / ${item.title} with grades and colors...`);

        const updateCmd = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: perfId },
            UpdateExpression: "set seatGrades = :g, seatColors = :c",
            ExpressionAttributeValues: {
                ":g": config.grades,
                ":c": config.colors
            }
        });

        try {
            await docClient.send(updateCmd);
            console.log(`Successfully updated ${perfId}`);
        } catch (e) {
            console.error(`Failed to update ${perfId}:`, e);
        }
    }
}

updatePerformances().then(() => console.log("Done."));
