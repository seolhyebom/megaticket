import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "plcr-gtbl-performances";

const expected = [
    { id: "perf-bts-worldtour", title: "BTS MAP OF THE SOUL TOUR", vipColor: "#9333EA", rColor: "#C4B5FD" },
    { id: "perf-blackpink-worldtour", title: "BLACKPINK WORLD TOUR IN GOYANG", vipColor: "#EC4899", rColor: "#F9A8D4" },
    { id: "perf-day6-present", title: "DAY6 The Present", vipColor: "#EAB308", rColor: "#FDE68A" },
    { id: "perf-ive-showhave", title: "IVE THE 1ST WORLD TOUR", vipColor: "#DC2626", rColor: "#FCA5A5" }
];

async function verify() {
    console.log("=== 색상 및 타이틀 변경 검증 ===\n");

    let allPass = true;

    for (const exp of expected) {
        const res = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { performanceId: exp.id }
        }));

        const item = res.Item;
        console.log("ID:", exp.id);

        // Title check
        if (item.title === exp.title) {
            console.log("   OK title:", item.title);
        } else {
            console.log("   FAIL title:", item.title, "(expected:", exp.title + ")");
            allPass = false;
        }

        // seatColors check
        const vipColor = item.seatColors ? item.seatColors.VIP : null;
        const rColor = item.seatColors ? item.seatColors.R : null;

        if (vipColor === exp.vipColor) {
            console.log("   OK VIP color:", vipColor);
        } else {
            console.log("   FAIL VIP color:", vipColor, "(expected:", exp.vipColor + ")");
            allPass = false;
        }

        if (rColor === exp.rColor) {
            console.log("   OK R color:", rColor);
        } else {
            console.log("   FAIL R color:", rColor, "(expected:", exp.rColor + ")");
            allPass = false;
        }

        console.log();
    }

    console.log("========================================");
    console.log(allPass ? "ALL PASS!" : "SOME FAILED");
}

verify().catch(console.error);
