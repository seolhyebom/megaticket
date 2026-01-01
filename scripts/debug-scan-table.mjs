// 전체 테이블 스캔으로 데이터 존재 여부 확인
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const region = process.argv[2] || "ap-northeast-2";
const tableName = process.argv[3] || "KDT-Msp4-PLDR-reservations";

console.log(`\n🔍 Scanning table: ${tableName} in ${region}\n`);

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

try {
    const result = await docClient.send(new ScanCommand({
        TableName: tableName,
        Limit: 20  // 처음 20개만 스캔
    }));

    console.log(`📋 Total scanned: ${result.ScannedCount}, Returned: ${result.Count}`);
    console.log(`📋 Items:`);

    if (result.Items && result.Items.length > 0) {
        // 고유한 userId 목록
        const userIds = [...new Set(result.Items.map(i => i.userId))];
        console.log(`\n👤 Unique userIds found: ${userIds.join(', ')}`);

        // 상태별 그룹화
        const statusGroups = {};
        result.Items.forEach(item => {
            const status = item.status || 'unknown';
            if (!statusGroups[status]) statusGroups[status] = 0;
            statusGroups[status]++;
        });
        console.log(`\n📊 Status breakdown:`, statusGroups);

        // 첫 3개 아이템 상세
        console.log(`\n📝 First 3 items:`);
        result.Items.slice(0, 3).forEach((item, idx) => {
            console.log(`[${idx + 1}] userId: ${item.userId}, status: ${item.status}, reservationId: ${item.reservationId || 'N/A'}`);
        });
    } else {
        console.log("❌ No items found in table.");
    }
} catch (error) {
    console.error("Error:", error.message);
    console.error("Table might not exist or access denied. Checking available tables...");

    // 테이블 목록 확인
    const { ListTablesCommand } = await import("@aws-sdk/client-dynamodb");
    try {
        const rawClient = new DynamoDBClient({ region });
        const tables = await rawClient.send(new ListTablesCommand({}));
        console.log("\n📋 Available tables:", tables.TableNames?.join(', ') || 'None');
    } catch (e) {
        console.error("Cannot list tables:", e.message);
    }
}
