/**
 * V7.11 좌석 등급 설명 마이그레이션 스크립트
 * DynamoDB performances 테이블의 seatGrades 필드에 description, location, features 추가
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const dynamodb = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = "performances";

// 좌석 등급별 설명 정보 (SSOT)
const seatGradeDescriptions = {
    "OP": {
        description: "B구역 최전방 오케스트라 피트석, 무대와 가장 가까움, 배우 표정까지 보이는 프리미엄 좌석",
        location: "1층 B구역 OP열",
        features: ["무대 최근접", "배우 표정 관람 가능", "몰입감 최고"]
    },
    "VIP": {
        description: "1층 B구역 중앙 앞열, 무대 전체가 한눈에 보이는 최적 시야",
        location: "1층 B구역 1-5열",
        features: ["무대 전체 조망", "최적 시야", "음향 밸런스 우수"]
    },
    "R": {
        description: "1층 A/C구역 또는 B구역 중간열, 밸런스 좋은 시야",
        location: "1층 A/C구역 또는 B구역 6-10열",
        features: ["균형 잡힌 시야", "가성비 우수"]
    },
    "S": {
        description: "2층 D/E/F구역 앞열, 무대 전체 조망 가능",
        location: "2층 D/E/F구역 1-5열",
        features: ["무대 전체 조망", "2층 프리미엄"]
    },
    "A": {
        description: "2층 후열, 가성비 좋은 좌석",
        location: "2층 D/E/F구역 6열 이후",
        features: ["가성비 최고", "편안한 관람"]
    }
};

async function updatePerformanceSeatGrades(performanceId, currentSeatGrades) {
    if (!currentSeatGrades || !Array.isArray(currentSeatGrades)) {
        console.log(`[SKIP] ${performanceId}: No seatGrades found`);
        return;
    }

    // 각 등급에 description 추가
    const updatedSeatGrades = currentSeatGrades.map(grade => {
        const gradeCode = grade.grade;
        const descriptions = seatGradeDescriptions[gradeCode] || {};

        return {
            ...grade,
            description: descriptions.description || grade.description || "",
            location: descriptions.location || grade.location || "",
            features: descriptions.features || grade.features || []
        };
    });

    try {
        await dynamodb.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId },
            UpdateExpression: "SET seatGrades = :grades",
            ExpressionAttributeValues: {
                ":grades": updatedSeatGrades
            }
        }));
        console.log(`[UPDATED] ${performanceId}`);
    } catch (error) {
        console.error(`[ERROR] ${performanceId}:`, error.message);
    }
}

async function migrateAll() {
    console.log("=== V7.11 좌석 등급 설명 마이그레이션 시작 ===\n");

    try {
        const result = await dynamodb.send(new ScanCommand({
            TableName: PERFORMANCES_TABLE
        }));

        const performances = result.Items || [];
        console.log(`총 ${performances.length}개 공연 발견\n`);

        for (const perf of performances) {
            await updatePerformanceSeatGrades(perf.performanceId, perf.seatGrades);
        }

        console.log("\n=== 마이그레이션 완료 ===");
    } catch (error) {
        console.error("마이그레이션 실패:", error);
        process.exit(1);
    }
}

migrateAll();
