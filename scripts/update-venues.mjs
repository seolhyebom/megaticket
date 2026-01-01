// venues 테이블 필드 업데이트 스크립트
// sections 기반으로 totalSeats, floor1Seats, floor2Seats 계산

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = "ap-northeast-2";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = "KDT-Msp4-PLDR-venues";

async function updateVenues() {
    console.log("🔍 Scanning venues table...");

    const result = await docClient.send(new ScanCommand({
        TableName: VENUES_TABLE
    }));

    if (!result.Items || result.Items.length === 0) {
        console.log("❌ No venues found.");
        return;
    }

    for (const venue of result.Items) {
        console.log(`\n📦 Processing venue: ${venue.venueId}`);

        const sections = venue.sections || [];

        // Calculate seats from sections
        let totalSeats = 0;
        let floor1Seats = 0;
        let floor2Seats = 0;

        sections.forEach(section => {
            const rows = section.rows || [];
            rows.forEach(row => {
                const seatCount = row.seats?.length || row.length || 0;
                totalSeats += seatCount;

                if (section.floor === "1층") {
                    floor1Seats += seatCount;
                } else if (section.floor === "2층") {
                    floor2Seats += seatCount;
                }
            });
        });

        console.log(`  Calculated: total=${totalSeats}, 1층=${floor1Seats}, 2층=${floor2Seats}`);

        // Update venue with missing fields
        const updateParams = {
            TableName: VENUES_TABLE,
            Key: { venueId: venue.venueId },
            UpdateExpression: "SET #name = :name, address = :address, venueType = :venueType, totalSeats = :totalSeats, floor1Seats = :floor1Seats, floor2Seats = :floor2Seats",
            ExpressionAttributeNames: {
                "#name": "name"  // name is reserved word
            },
            ExpressionAttributeValues: {
                ":name": "샤롯데씨어터",
                ":address": "서울 송파구 올림픽로 240",
                ":venueType": "theater",
                ":totalSeats": totalSeats,
                ":floor1Seats": floor1Seats,
                ":floor2Seats": floor2Seats
            }
        };

        await docClient.send(new UpdateCommand(updateParams));
        console.log(`  ✅ Updated venue: ${venue.venueId}`);
    }

    console.log("\n✅ Venues update complete!");
}

updateVenues().catch(console.error);
