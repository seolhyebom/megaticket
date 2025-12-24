// @ts-nocheck
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, TransactWriteCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "ap-northeast-2",
});

export const dynamoDb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});

export const RESERVATIONS_TABLE = process.env.DYNAMODB_RESERVATIONS_TABLE || "KDT-Msp4-PLDR-reservations";
export const PERFORMANCES_TABLE = process.env.DYNAMODB_PERFORMANCES_TABLE || "KDT-Msp4-PLDR-performances";
export const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";

// 키 생성 헬퍼
export function createPK(performanceId: string, date: string, time: string): string {
    return `PERF#${performanceId}#${date}#${time}`;
}

export function createSK(seatId: string): string {
    return `SEAT#${seatId}`;
}

// PK에서 정보 추출
export function parsePK(pk: string) {
    const parts = pk.split("#");
    return {
        performanceId: parts[1],
        date: parts[2],
        time: parts[3],
    };
}
