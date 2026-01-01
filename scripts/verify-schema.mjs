// 최종 검증 스크립트
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

async function verify() {
    console.log("=== Final Verification ===\n");

    // 1. Venues
    const venues = await docClient.send(new ScanCommand({
        TableName: "KDT-Msp4-PLDR-venues", Limit: 1
    }));
    const v = venues.Items?.[0];
    console.log("VENUES:");
    console.log("  name:", v?.name || "MISSING");
    console.log("  address:", v?.address || "MISSING");
    console.log("  venueType:", v?.venueType || "MISSING");
    console.log("  totalSeats:", v?.totalSeats);
    console.log("  floor1Seats:", v?.floor1Seats);
    console.log("  floor2Seats:", v?.floor2Seats);
    console.log("  floor1+floor2=total:", (v?.floor1Seats + v?.floor2Seats) === v?.totalSeats ? "OK" : "MISMATCH");
    console.log("  sections:", v?.sections ? "EXISTS" : "MISSING");

    // 2. Performances
    const perfs = await docClient.send(new ScanCommand({
        TableName: "KDT-Msp4-PLDR-performances", Limit: 2
    }));
    console.log("\nPERFORMANCES:");
    perfs.Items?.forEach((p, i) => {
        console.log(`  [${i + 1}] ${p.performanceId}`);
        console.log("      venue:", p.venue || "MISSING");
        console.log("      schedules:", p.schedules ? "EXISTS (should remove)" : "REMOVED OK");
        console.log("      cast:", p.cast ? "EXISTS" : "MISSING");
    });

    // 3. Schedules (sample)
    const scheds = await docClient.send(new ScanCommand({
        TableName: "KDT-Msp4-PLDR-schedules", Limit: 3
    }));
    console.log("\nSCHEDULES (sample 3):");
    scheds.Items?.forEach((s, i) => {
        console.log(`  [${i + 1}] ${s.scheduleId}`);
        console.log("      status:", s.status || "MISSING");
        console.log("      totalSeats:", s.totalSeats || "MISSING");
        console.log("      casting:", s.casting && Object.keys(s.casting).length > 0 ? "EXISTS" : "EMPTY/MISSING");
        console.log("      createdAt:", s.createdAt ? "EXISTS" : "MISSING");
        console.log("      sections:", s.sections ? "EXISTS (should NOT)" : "NOT EXISTS OK");
    });

    console.log("\n=== Done ===");
}

verify().catch(console.error);
