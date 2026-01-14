import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });

// 1층 = VIP (A,B,C), 2층 = R (D,E,F) - 연극과 동일
const gradeMapping = {
    "M": {
        "VIP": {
            "L": [
                { "S": "A-1" }, { "S": "A-2" }, { "S": "A-3" }, { "S": "A-4" }, { "S": "A-5" },
                { "S": "A-6" }, { "S": "A-7" }, { "S": "A-8" }, { "S": "A-9" }, { "S": "A-10" },
                { "S": "A-11" }, { "S": "A-12" }, { "S": "A-13" }, { "S": "A-14" }, { "S": "A-15" },
                { "S": "A-16" }, { "S": "A-17" },
                { "S": "B-1" }, { "S": "B-2" }, { "S": "B-3" }, { "S": "B-4" }, { "S": "B-5" },
                { "S": "B-6" }, { "S": "B-7" }, { "S": "B-8" }, { "S": "B-9" }, { "S": "B-10" },
                { "S": "B-11" }, { "S": "B-12" }, { "S": "B-13" }, { "S": "B-14" }, { "S": "B-15" },
                { "S": "B-16" }, { "S": "B-17" },
                { "S": "C-1" }, { "S": "C-2" }, { "S": "C-3" }, { "S": "C-4" }, { "S": "C-5" },
                { "S": "C-6" }, { "S": "C-7" }, { "S": "C-8" }, { "S": "C-9" }, { "S": "C-10" },
                { "S": "C-11" }, { "S": "C-12" }, { "S": "C-13" }, { "S": "C-14" }, { "S": "C-15" },
                { "S": "C-16" }, { "S": "C-17" }
            ]
        },
        "R": {
            "L": [
                { "S": "D-1" }, { "S": "D-2" }, { "S": "D-3" }, { "S": "D-4" }, { "S": "D-5" },
                { "S": "D-6" }, { "S": "D-7" }, { "S": "D-8" }, { "S": "D-9" }, { "S": "D-10" },
                { "S": "D-11" }, { "S": "D-12" }, { "S": "D-13" },
                { "S": "E-1" }, { "S": "E-2" }, { "S": "E-3" }, { "S": "E-4" }, { "S": "E-5" },
                { "S": "E-6" }, { "S": "E-7" }, { "S": "E-8" }, { "S": "E-9" }, { "S": "E-10" },
                { "S": "E-11" }, { "S": "E-12" }, { "S": "E-13" },
                { "S": "F-1" }, { "S": "F-2" }, { "S": "F-3" }, { "S": "F-4" }, { "S": "F-5" },
                { "S": "F-6" }, { "S": "F-7" }, { "S": "F-8" }, { "S": "F-9" }, { "S": "F-10" },
                { "S": "F-11" }, { "S": "F-12" }, { "S": "F-13" }
            ]
        }
    }
};

const performanceIds = ["perf-jekyll-hyde", "perf-aladdin"];

async function addGradeMapping() {
    for (const id of performanceIds) {
        console.log(`Adding gradeMapping to ${id}...`);

        await client.send(new UpdateItemCommand({
            TableName: "plcr-gtbl-performances",
            Key: { performanceId: { S: id } },
            UpdateExpression: "SET gradeMapping = :gm",
            ExpressionAttributeValues: {
                ":gm": gradeMapping
            }
        }));

        console.log(`✅ Done: ${id}`);
    }
    console.log("\n🎉 gradeMapping 추가 완료!");
}

addGradeMapping().catch(console.error);
