
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = "KDT-Msp4-PLDR-venues";
const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";

// 1. Define Seat Grades for Performances (V7.6)
const PERF_seatGrades = {
    "perf-kinky-1": [
        { grade: "OP", price: 170000, color: "#FFD700", description: "1층 최전방" },
        { grade: "VIP", price: 170000, color: "#FF5733", description: "1층 중앙 앞열" },
        { grade: "R", price: 140000, color: "#3498DB", description: "1층 중앙" },
        { grade: "S", price: 110000, color: "#2ECC71", description: "1층 측면/2층 앞" },
        { grade: "A", price: 80000, color: "#9B59B6", description: "2층 후면" }
    ],
    "perf-phantom-of-the-opera-1": [
        { grade: "VIP", price: 190000, color: "#FF5733", description: "1층 중앙" },
        { grade: "R", price: 160000, color: "#3498DB", description: "1층 사이드" },
        { grade: "S", price: 130000, color: "#2ECC71", description: "2층 앞열" },
        { grade: "A", price: 90000, color: "#9B59B6", description: "2층 뒷열" }
    ]
};

// 2. Define Sections for Charlotte Theater (Restore Missing Data)
const generateSection = (id, label, floor, rows, seatsPerRow) => {
    const sectionRows = [];
    for (let r = 0; r < rows; r++) {
        const rowId = (r + 1).toString();
        const seats = [];
        for (let s = 1; s <= seatsPerRow; s++) {
            // Basic Grade Logic for visualization (Actual pricing comes from performance seatGrades + mapping)
            // This is purely for the visual map structure.
            let grade = "R";
            if (floor === 1) {
                if (r < 5) grade = "VIP";
                else if (r < 15) grade = "R";
                else grade = "S";
            } else {
                if (r < 3) grade = "S";
                else grade = "A";
            }
            // Helper for OP rows logic in Section B (Rows 1-2)
            if (id === 'B' && floor === 1 && r < 2) grade = "OP";

            seats.push({
                seatId: `${id}-${rowId}-${s}`,
                seatNumber: s,
                status: "available",
                grade: grade
            });
        }
        sectionRows.push({ rowId, seats });
    }
    return { sectionId: id, name: label, floor, rows: sectionRows };
};

const charlotteSections = [
    generateSection("A", "A구역", 1, 20, 12),
    generateSection("B", "B구역", 1, 20, 13),
    generateSection("C", "C구역", 1, 20, 12),
    generateSection("D", "D구역", 2, 13, 13),
    generateSection("E", "E구역", 2, 13, 14),
    generateSection("F", "F구역", 2, 13, 13),
];

async function migrate() {
    console.log("Starting V7.6 Migration...");

    // 1. Update Performances with seatGrades
    for (const [perfId, grades] of Object.entries(PERF_seatGrades)) {
        console.log(`Updating seatGrades for ${perfId}...`);
        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: perfId },
            UpdateExpression: "SET seatGrades = :g",
            ExpressionAttributeValues: { ":g": grades }
        }));
    }

    // 2. Restore Sections to Venue
    console.log("Restoring sections to 'charlotte-theater'...");
    await docClient.send(new UpdateCommand({
        TableName: VENUES_TABLE,
        Key: { venueId: "charlotte-theater" },
        UpdateExpression: "SET sections = :s REMOVE grades", // Also remove legacy 'grades'
        ExpressionAttributeValues: { ":s": charlotteSections }
    }));

    // 3. Denormalize Sections to Performances (Sync)
    // Since we just updated Venue, we need to sync `sections` to performances again 
    // because performancs.sections might be empty or stale.
    console.log("Syncing restored sections to performances...");
    const perfIds = Object.keys(PERF_seatGrades);
    for (const pid of perfIds) {
        await docClient.send(new UpdateCommand({
            TableName: PERFORMANCES_TABLE,
            Key: { performanceId: pid },
            UpdateExpression: "SET sections = :s",
            ExpressionAttributeValues: { ":s": charlotteSections }
        }));
    }

    console.log("V7.6 Migration Complete!");
}

migrate().catch(console.error);
