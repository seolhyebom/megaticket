
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PERFORMANCES_TABLE = "KDT-Msp4-PLDR-performances";

// 1. Define Sections for Charlotte Theater
const generateSection = (id, label, floor, rows, seatsPerRow) => {
    const sectionRows = [];
    for (let r = 0; r < rows; r++) {
        const rowId = (r + 1).toString();
        const seats = [];
        for (let s = 1; s <= seatsPerRow; s++) {
            let grade = "R";
            if (floor === 1) {
                if (r < 5) grade = "VIP";
                else if (r < 15) grade = "R";
                else grade = "S";
            } else {
                if (r < 3) grade = "S";
                else grade = "A";
            }
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

async function restore() {
    const ids = ["perf-kinky-1", "perf-phantom-of-the-opera-1"];
    console.log("Restoring sections to performances at Charlotte Theater...");

    for (const pid of ids) {
        try {
            await docClient.send(new UpdateCommand({
                TableName: PERFORMANCES_TABLE,
                Key: { performanceId: pid },
                UpdateExpression: "SET sections = :s",
                ExpressionAttributeValues: { ":s": charlotteSections }
            }));
            console.log(`Successfully restored sections for ${pid}`);
        } catch (e) {
            console.error(`Error restoring sections for ${pid}:`, e);
        }
    }
}

restore();
