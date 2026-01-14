import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { writeFileSync } from "fs";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

const concertIds = [
    "perf-bts-worldtour",
    "perf-blackpink-worldtour",
    "perf-day6-present",
    "perf-ive-showhave"
];

// Expected data from image
const expected = {
    "perf-bts-worldtour": {
        cast: ["정국", "뷔", "지민", "RM", "제이홉", "슈가", "진"],
        vipPrice: 220000,
        rPrice: 170000,
        startDate: "2026-02-20",
        endDate: "2026-02-22"
    },
    "perf-blackpink-worldtour": {
        cast: ["지수", "제니", "로제", "리사"],
        vipPrice: 210000,
        rPrice: 160000,
        startDate: "2026-03-13",
        endDate: "2026-03-15"
    },
    "perf-day6-present": {
        cast: ["성진", "Young K", "원필", "도운"],
        vipPrice: 150000,
        rPrice: 120000,
        startDate: "2026-03-27",
        endDate: "2026-03-29"
    },
    "perf-ive-showhave": {
        cast: ["안유진", "가을", "레이", "장원영", "리즈", "이서"],
        vipPrice: 200000,
        rPrice: 150000,
        startDate: "2026-02-27",
        endDate: "2026-03-01"
    }
};

async function verify() {
    const results = [];

    for (const id of concertIds) {
        const res = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: id }
        }));

        const item = res.Item;
        const exp = expected[id];

        // Get actual cast
        const castKey = Object.keys(item.cast)[0];
        const actualCast = item.cast[castKey] || [];

        // Get actual prices from seatGrades
        const vipGrade = item.seatGrades?.find(g => g.grade === "VIP");
        const rGrade = item.seatGrades?.find(g => g.grade === "R");

        const result = {
            performanceId: id,
            title: item.title,
            checks: {
                castMatch: {
                    expected: exp.cast,
                    actual: actualCast,
                    pass: JSON.stringify(exp.cast.sort()) === JSON.stringify(actualCast.sort())
                },
                vipPrice: {
                    expected: exp.vipPrice,
                    actual: vipGrade?.price,
                    pass: vipGrade?.price === exp.vipPrice
                },
                rPrice: {
                    expected: exp.rPrice,
                    actual: rGrade?.price,
                    pass: rGrade?.price === exp.rPrice
                },
                startDate: {
                    expected: exp.startDate,
                    actual: item.startDate,
                    pass: item.startDate === exp.startDate
                },
                endDate: {
                    expected: exp.endDate,
                    actual: item.endDate,
                    pass: item.endDate === exp.endDate
                },
                gradeMapping: {
                    vipSeats: item.gradeMapping?.VIP?.length || 0,
                    rSeats: item.gradeMapping?.R?.length || 0,
                    pass: (item.gradeMapping?.VIP?.length > 0) && (item.gradeMapping?.R?.length > 0)
                },
                hasOPSeats: {
                    expected: false,
                    actual: item.hasOPSeats,
                    pass: item.hasOPSeats === false
                }
            }
        };

        result.allPass = Object.values(result.checks).every(c => c.pass);
        results.push(result);
    }

    writeFileSync("verify-result.json", JSON.stringify(results, null, 2), "utf8");
    console.log("Saved to verify-result.json");

    // Print summary
    console.log("\n=== VERIFICATION SUMMARY ===");
    for (const r of results) {
        console.log(`${r.allPass ? "PASS" : "FAIL"} - ${r.title} (${r.performanceId})`);
        for (const [key, check] of Object.entries(r.checks)) {
            if (!check.pass) {
                console.log(`  X ${key}: expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(check.actual)}`);
            }
        }
    }
}

verify().catch(console.error);
