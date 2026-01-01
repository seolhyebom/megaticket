
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('api_response_cleaned.json', 'utf8'));

// Find 2nd Floor, Section D, Row 4, Seat 1 (Should be S)
// Find 2nd Floor, Section D, Row 8, Seat 1 (Should be A)

// Navigate structure: data is Performance object.
// But wait, the API returns the Performance Object which CONTAINS 'sections'?
// Wait, `performance-service.ts` returns `data` which has `sections: mergedSections`.
// Let's verify `api_response_final.json` actually HAS `sections`.

// Wait, looking at the previous view_file (Step 465), I see "seatGrades", "cast", "schedules"...
// I DO NOT see "sections" in the view_file output.
// Is it possible "sections" is NOT returned in the summary view?
// The endpoint is `GET /api/performances/:id`.
// `performance-service.ts` `getPerformance` returns `{ ...perf, sections: mergedSections, ... }`.
// Let's check if the previous view_file was just truncated before showing 'sections' or if it is missing.
// It seems truncated (Total Bytes: 137781, shown 1 line).

const findSeat = (targetSeatId) => {
    if (!data.sections) {
        console.error("No 'sections' field in API response!");
        process.exit(1);
    }

    for (const section of data.sections) {
        for (const row of section.rows) {
            for (const seat of row.seats) {
                if (seat.seatId === targetSeatId) {
                    return seat;
                }
            }
        }
    }
    return null;
};

const sSeat = findSeat('2층-D-4-1');
const aSeat = findSeat('2층-D-8-1');

console.log("2층-D-4-1 Grade:", sSeat ? sSeat.grade : 'NOT FOUND');
console.log("2층-D-8-1 Grade:", aSeat ? aSeat.grade : 'NOT FOUND');

if (sSeat && sSeat.grade === 'S' && aSeat && aSeat.grade === 'A') {
    console.log("[PASS] Grades are correct according to Venue Layout.");
} else {
    console.log("[FAIL] Grades are incorrect.");
}
