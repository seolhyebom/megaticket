
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const VENUES_TABLE = process.env.DYNAMODB_VENUES_TABLE || "KDT-Msp4-PLDR-venues";
const VENUE_ID = 'charlotte-theater';

const run = async () => {
    const getCmd = new GetCommand({ TableName: VENUES_TABLE, Key: { venueId: VENUE_ID } });
    const { Item: venue } = await docClient.send(getCmd);

    if (!venue || !venue.sections) return;

    console.log("Section 0 keys:", Object.keys(venue.sections[0]));
    if (venue.sections[0].rows && venue.sections[0].rows[0]) {
        console.log("Row 0 keys:", Object.keys(venue.sections[0].rows[0]));
        console.log("Row 0 sample:", venue.sections[0].rows[0]);
        if (venue.sections[0].rows[0].seats && venue.sections[0].rows[0].seats[0]) {
            console.log("Seat 0 keys:", Object.keys(venue.sections[0].rows[0].seats[0]));
            console.log("Seat 0 sample:", venue.sections[0].rows[0].seats[0]);
        }
    }
};

run();
