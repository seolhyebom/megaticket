import { NextResponse } from 'next/server';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export async function GET() {
    try {
        // DynamoDB 연결 확인 (테이블 존재 여부 체크)
        // 환경변수가 없으면 에러가 날 수 있으므로 체크
        const tableName = process.env.DYNAMODB_PERFORMANCES_TABLE;
        if (tableName) {
            await dynamodb.send(new DescribeTableCommand({
                TableName: tableName
            }));
        }

        return NextResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'api-server',
            region: process.env.AWS_REGION
        });
    } catch (error) {
        return NextResponse.json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown'
        }, { status: 503 });
    }
}
