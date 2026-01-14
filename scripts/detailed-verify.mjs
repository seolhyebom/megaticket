import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

// 예상 데이터 (이미지 기준)
const expectedData = {
    "perf-bts-worldtour": {
        title: "방탄소년단 월드 투어",
        cast: ["정국", "뷔", "지민", "RM", "제이홉", "슈가", "진"],
        castCount: 7,
        vipPrice: 220000,
        rPrice: 170000,
        dates: ["2026-02-20", "2026-02-21", "2026-02-22"],
        schedule: "금토일"
    },
    "perf-blackpink-worldtour": {
        title: "블랙핑크 월드 투어",
        cast: ["지수", "제니", "로제", "리사"],
        castCount: 4,
        vipPrice: 210000,
        rPrice: 160000,
        dates: ["2026-03-13", "2026-03-14", "2026-03-15"],
        schedule: "금토일"
    },
    "perf-day6-present": {
        title: "DAY6",
        cast: ["성진", "Young K", "원필", "도운"],
        castCount: 4,
        vipPrice: 150000,
        rPrice: 120000,
        dates: ["2026-03-27", "2026-03-28", "2026-03-29"],
        schedule: "금토일"
    },
    "perf-ive-showhave": {
        title: "아이브",
        cast: ["안유진", "가을", "레이", "장원영", "리즈", "이서"],
        castCount: 6,
        vipPrice: 200000,
        rPrice: 150000,
        dates: ["2026-02-27", "2026-02-28", "2026-03-01"],
        schedule: "금토일"
    }
};

async function detailedVerify() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("              🔍 콘서트 데이터 상세 점검                    ");
    console.log("═══════════════════════════════════════════════════════════\n");

    let allPassed = true;

    for (const [perfId, expected] of Object.entries(expectedData)) {
        console.log(`\n📋 ${expected.title} (${perfId})`);
        console.log("─".repeat(50));

        const res = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: perfId }
        }));

        if (!res.Item) {
            console.log("   ❌ 데이터 없음!");
            allPassed = false;
            continue;
        }

        const item = res.Item;
        let itemPassed = true;

        // 1. 타이틀 확인
        if (item.title === expected.title) {
            console.log(`   ✅ 타이틀: ${item.title}`);
        } else {
            console.log(`   ❌ 타이틀: ${item.title} (예상: ${expected.title})`);
            itemPassed = false;
        }

        // 2. Cast 멤버 확인
        const castKey = Object.keys(item.cast)[0];
        const actualCast = item.cast[castKey] || [];
        const castMatch = expected.cast.every(m => actualCast.includes(m)) && actualCast.length === expected.castCount;
        if (castMatch) {
            console.log(`   ✅ 멤버 (${actualCast.length}명): ${actualCast.join(", ")}`);
        } else {
            console.log(`   ❌ 멤버: ${actualCast.join(", ")}`);
            console.log(`      예상: ${expected.cast.join(", ")}`);
            itemPassed = false;
        }

        // 3. seatGrades 가격 확인
        const vipGrade = item.seatGrades?.find(g => g.grade === "VIP");
        const rGrade = item.seatGrades?.find(g => g.grade === "R");

        if (vipGrade?.price === expected.vipPrice) {
            console.log(`   ✅ VIP 가격: ${vipGrade.price.toLocaleString()}원`);
        } else {
            console.log(`   ❌ VIP 가격: ${vipGrade?.price?.toLocaleString() || "없음"}원 (예상: ${expected.vipPrice.toLocaleString()}원)`);
            itemPassed = false;
        }

        if (rGrade?.price === expected.rPrice) {
            console.log(`   ✅ R석 가격: ${rGrade.price.toLocaleString()}원`);
        } else {
            console.log(`   ❌ R석 가격: ${rGrade?.price?.toLocaleString() || "없음"}원 (예상: ${expected.rPrice.toLocaleString()}원)`);
            itemPassed = false;
        }

        // 4. 날짜 확인
        console.log(`   📅 날짜범위: ${item.dateRange}`);
        console.log(`   📅 시작일: ${item.startDate}, 종료일: ${item.endDate}`);

        // 5. gradeMapping 확인
        const vipSeats = item.gradeMapping?.VIP?.length || 0;
        const rSeats = item.gradeMapping?.R?.length || 0;
        console.log(`   🪑 gradeMapping: VIP ${vipSeats}석, R ${rSeats}석`);

        if (vipSeats === 0 || rSeats === 0) {
            console.log(`   ❌ gradeMapping 없음!`);
            itemPassed = false;
        } else {
            console.log(`   ✅ gradeMapping 정상`);
        }

        // 6. hasOPSeats 확인
        if (item.hasOPSeats === false) {
            console.log(`   ✅ hasOPSeats: false`);
        } else {
            console.log(`   ❌ hasOPSeats: ${item.hasOPSeats} (예상: false)`);
            itemPassed = false;
        }

        // 7. schedule 확인
        if (item.schedule?.includes("금") && item.schedule?.includes("토") && item.schedule?.includes("일")) {
            console.log(`   ✅ 스케줄: ${item.schedule}`);
        } else {
            console.log(`   ⚠️ 스케줄: ${item.schedule}`);
        }

        if (!itemPassed) allPassed = false;
        console.log(`   ${itemPassed ? "✅ PASS" : "❌ FAIL"}`);
    }

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(allPassed ? "   🎉 모든 데이터 검증 통과!" : "   ⚠️ 일부 데이터에 문제가 있습니다.");
    console.log("═══════════════════════════════════════════════════════════\n");
}

detailedVerify().catch(console.error);
