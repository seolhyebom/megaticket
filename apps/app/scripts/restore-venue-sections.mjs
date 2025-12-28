import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";

/**
 * V7.13 - Charlotte Theater Seating Layout
 * 
 * 1층 구조:
 *   - B구역 (정중앙): OP열 12석 + 1~17열 각 24석
 *   - A/C구역 (좌우측): 1~10열 12석, 11~15열 14석, 16~17열 15석
 * 
 * 2층 구조:
 *   - D/E/F구역: 1~13열 각 13~14석
 * 
 * 핵심 변경사항:
 *   1. B구역 1열 추가 (기존: OP -> 2열, 수정: OP -> 1열 -> 2열)
 *   2. A/C 구역 비정형화 (열마다 좌석 수 다름)
 *   3. OP열은 1~12번 (독립적 번호)
 */

// 등급 결정 함수
const calculateGrade = (sectionId, rowId, isFloor2 = false) => {
    if (rowId === 'OP') return 'OP';

    const rowNum = parseInt(rowId);

    if (isFloor2) {
        if (rowNum <= 3) return 'S';
        return 'A';
    }

    // 1층 등급 매핑 (B구역 기준)
    if (['A', 'C'].includes(sectionId)) {
        if (rowNum <= 5) return 'R';
        if (rowNum <= 10) return 'S';
        return 'A';
    }

    // B구역
    if (rowNum <= 3) return 'VIP';
    if (rowNum <= 10) return 'R';
    if (rowNum <= 14) return 'S';
    return 'A';
};

// A/C 구역 좌석 수 계산 (비정형)
const getACSeatCount = (rowNum) => {
    if (rowNum >= 1 && rowNum <= 10) return 12;
    if (rowNum >= 11 && rowNum <= 15) return 14;
    if (rowNum >= 16 && rowNum <= 17) return 15;
    return 12;
};

// 좌석 생성 함수
const generateSeats = (floor, sectionId, rowId, seatCount) => {
    const seats = [];
    const grade = calculateGrade(sectionId, rowId, floor === '2층');

    for (let s = 1; s <= seatCount; s++) {
        seats.push({
            seatId: `${floor}-${sectionId}-${rowId}-${s}`,
            seatNumber: s,
            rowId: rowId, // [Critical #2] rowId 명시적 추가
            status: "available",
            grade: grade
        });
    }
    return seats;
};

// 1층 A/C 구역 생성 (비정형)
const generateACSection = (sectionId) => {
    const rows = [];

    for (let r = 1; r <= 17; r++) {
        const rowId = String(r);
        const seatCount = getACSeatCount(r);

        rows.push({
            rowId: rowId,
            grade: calculateGrade(sectionId, rowId),
            seats: generateSeats('1층', sectionId, rowId, seatCount)
        });
    }

    return {
        sectionId: sectionId,
        name: `${sectionId}구역`,
        floor: '1층',
        rows: rows
    };
};

// 1층 B구역 생성 (OP열 + 1~17열)
const generateBSection = () => {
    const rows = [];

    // OP열: 12석
    rows.push({
        rowId: 'OP',
        grade: 'OP',
        seats: generateSeats('1층', 'B', 'OP', 12)
    });

    // 1열~17열: 각 14석 (V7.13 복구: 24→14)
    for (let r = 1; r <= 17; r++) {
        const rowId = String(r);
        rows.push({
            rowId: rowId,
            grade: calculateGrade('B', rowId),
            seats: generateSeats('1층', 'B', rowId, 14)
        });
    }

    return {
        sectionId: 'B',
        name: 'B구역',
        floor: '1층',
        rows: rows
    };
};

// 2층 구역 생성
const generate2FSection = (sectionId, seatsPerRow) => {
    const rows = [];

    for (let r = 1; r <= 13; r++) {
        const rowId = String(r);
        rows.push({
            rowId: rowId,
            grade: calculateGrade(sectionId, rowId, true),
            seats: generateSeats('2층', sectionId, rowId, seatsPerRow)
        });
    }

    return {
        sectionId: sectionId,
        name: `${sectionId}구역`,
        floor: '2층',
        rows: rows
    };
};

// 전체 구역 생성
const charlotteSections = [
    // 1층
    generateACSection('A'),  // A구역: 비정형 (12/14/15석)
    generateBSection(),       // B구역: OP열 12석 + 1~17열 24석
    generateACSection('C'),  // C구역: 비정형 (12/14/15석)

    // 2층
    generate2FSection('D', 13),  // D구역: 13석 x 13열
    generate2FSection('E', 14),  // E구역: 14석 x 13열
    generate2FSection('F', 13),  // F구역: 13석 x 13열
];

async function restoreSections() {
    console.log("🚀 V7.13: Updating Charlotte Theater sections...");
    console.log("📊 Changes: B구역 1열 추가, A/C 구역 비정형화");

    try {
        // 좌석 수 계산
        let totalSeats = 0;
        let floor1Seats = 0;
        let floor2Seats = 0;
        const gradeCount = { OP: 0, VIP: 0, R: 0, S: 0, A: 0 };

        charlotteSections.forEach(section => {
            section.rows.forEach(row => {
                const seatCount = row.seats.length;
                totalSeats += seatCount;

                if (section.floor === '1층') floor1Seats += seatCount;
                else floor2Seats += seatCount;

                row.seats.forEach(seat => {
                    gradeCount[seat.grade] = (gradeCount[seat.grade] || 0) + 1;
                });
            });
        });

        console.log("\n📊 좌석 분포:");
        console.log(`   1층: ${floor1Seats}석`);
        console.log(`   2층: ${floor2Seats}석`);
        console.log(`   총합: ${totalSeats}석`);

        console.log("\n📊 등급별 분포:");
        Object.entries(gradeCount).forEach(([grade, count]) => {
            const percentage = ((count / totalSeats) * 100).toFixed(1);
            console.log(`   ${grade}: ${count}석 (${percentage}%)`);
        });

        // A/C 구역 좌석 수 확인
        const sectionA = charlotteSections.find(s => s.sectionId === 'A');
        console.log("\n📊 A구역 열별 좌석 수:");
        sectionA.rows.forEach(row => {
            console.log(`   ${row.rowId}열: ${row.seats.length}석`);
        });

        // B구역 열 순서 확인
        const sectionB = charlotteSections.find(s => s.sectionId === 'B');
        console.log("\n📊 B구역 열 순서:");
        console.log(`   ${sectionB.rows.map(r => r.rowId).join(' -> ')}`);

        // DynamoDB 업데이트
        await docClient.send(new UpdateCommand({
            TableName: VENUES_TABLE,
            Key: { venueId: "charlotte-theater" },
            UpdateExpression: "SET sections = :s, totalSeats = :t REMOVE grades",
            ExpressionAttributeValues: {
                ":s": charlotteSections,
                ":t": totalSeats
            }
        }));

        console.log("\n✅ V7.13: Sections updated successfully!");
        console.log(`✅ Total seats: ${totalSeats}`);

    } catch (e) {
        console.error("❌ Error updating sections:", e);
    }
}

restoreSections();
