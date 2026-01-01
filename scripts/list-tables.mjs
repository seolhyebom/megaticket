// 테이블 목록 확인 및 각 테이블 데이터 수 확인
import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const region = process.argv[2] || "ap-northeast-2";

console.log(`\n🔍 Listing DynamoDB tables in ${region}\n`);

const client = new DynamoDBClient({ region });

try {
    const tables = await client.send(new ListTablesCommand({}));
    console.log(`📋 Available tables (${tables.TableNames?.length || 0}):`);

    for (const tableName of (tables.TableNames || [])) {
        try {
            const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
            const count = desc.Table?.ItemCount || 'N/A';
            const status = desc.Table?.TableStatus || 'N/A';
            console.log(`   - ${tableName}: ${count} items (${status})`);
        } catch (e) {
            console.log(`   - ${tableName}: (cannot describe)`);
        }
    }
} catch (error) {
    console.error("Error:", error.message);
}
