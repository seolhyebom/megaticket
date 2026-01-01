// 모든 DynamoDB 테이블의 전체 필드 구조를 출력하는 스크립트
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const region = process.argv[2] || "ap-northeast-2";
const tableName = process.argv[3];

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

async function scanTable(table) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📦 Table: ${table}`);
    console.log("=".repeat(80));

    try {
        const result = await docClient.send(new ScanCommand({
            TableName: table,
            Limit: 5
        }));

        console.log(`📋 Scanned: ${result.ScannedCount}`);

        if (result.Items && result.Items.length > 0) {
            console.log(`\n📝 All fields in first item:`);
            const firstItem = result.Items[0];
            const keys = Object.keys(firstItem).sort();

            keys.forEach(key => {
                const value = firstItem[key];
                const type = typeof value === 'object'
                    ? (Array.isArray(value) ? 'Array' : 'Object')
                    : typeof value;
                const preview = typeof value === 'object'
                    ? JSON.stringify(value).substring(0, 100) + '...'
                    : String(value).substring(0, 100);
                console.log(`  - ${key} (${type}): ${preview}`);
            });

            // 전체 첫 아이템 출력
            console.log(`\n📄 Full first item (JSON):`);
            console.log(JSON.stringify(firstItem, null, 2));
        } else {
            console.log("❌ No items.");
        }
    } catch (error) {
        console.error(`Error scanning ${table}:`, error.message);
    }
}

const tables = tableName
    ? [tableName]
    : [
        "KDT-Msp4-PLDR-venues",
        "KDT-Msp4-PLDR-performances",
        "KDT-Msp4-PLDR-schedules",
        "KDT-Msp4-PLDR-reservations"
    ];

for (const t of tables) {
    await scanTable(t);
}
console.log("\n✅ Done.");
