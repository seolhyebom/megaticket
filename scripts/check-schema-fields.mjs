// venues 테이블의 첫번째 아이템 필드명만 출력
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

// venues 테이블
const venuesResult = await docClient.send(new ScanCommand({
    TableName: "KDT-Msp4-PLDR-venues",
    Limit: 1
}));
console.log("\n=== VENUES 테이블 ===");
if (venuesResult.Items?.[0]) {
    const item = venuesResult.Items[0];
    console.log("필드 목록:", Object.keys(item).sort().join(", "));
    console.log("\nvenueId:", item.venueId);
    console.log("name:", item.name);
    console.log("address:", item.address || "❌ 없음");
    console.log("venueType:", item.venueType || "❌ 없음");
    console.log("totalSeats:", item.totalSeats || "❌ 없음");
    console.log("floor1Seats:", item.floor1Seats || "❌ 없음");
    console.log("floor2Seats:", item.floor2Seats || "❌ 없음");
    console.log("sections 개수:", item.sections?.length || 0);
}

// performances 테이블
const perfResult = await docClient.send(new ScanCommand({
    TableName: "KDT-Msp4-PLDR-performances",
    Limit: 2
}));
console.log("\n=== PERFORMANCES 테이블 ===");
perfResult.Items?.forEach((item, i) => {
    console.log(`\n[${i + 1}] performanceId: ${item.performanceId}`);
    console.log("필드 목록:", Object.keys(item).sort().join(", "));
    console.log("venueId:", item.venueId || "❌ 없음");
    console.log("venue:", item.venue || "❌ 없음");
    console.log("dateRange:", item.dateRange || "❌ 없음");
    console.log("price:", item.price || "❌ 없음");
    console.log("hasOPSeats:", item.hasOPSeats);
    console.log("schedules 필드:", item.schedules ? "✅ 있음" : "❌ 없음");
    console.log("cast 필드:", item.cast ? "✅ 있음" : "❌ 없음");
});

// schedules 테이블 - casting 확인
const schedResult = await docClient.send(new ScanCommand({
    TableName: "KDT-Msp4-PLDR-schedules",
    Limit: 3
}));
console.log("\n=== SCHEDULES 테이블 ===");
schedResult.Items?.forEach((item, i) => {
    console.log(`\n[${i + 1}] scheduleId: ${item.scheduleId}`);
    console.log("필드 목록:", Object.keys(item).sort().join(", "));
    console.log("status:", item.status || "❌ 없음");
    console.log("totalSeats:", item.totalSeats || "❌ 없음");
    console.log("createdAt:", item.createdAt || "❌ 없음");
    console.log("casting:", JSON.stringify(item.casting));
});

console.log("\n✅ Done.");
