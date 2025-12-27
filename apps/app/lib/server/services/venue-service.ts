import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb, VENUES_TABLE } from "@/lib/dynamodb";
// import { sampleTheater } from "@/data/venues/sample-theater.json"; // Need to handle JSON import or just define type

export interface VenueData {
    venueId: string;
    venueName: string;
    venueType: string;
    totalSeats: number;
    createdAt?: string;
    sections?: any[];
    grades?: any[];
}

export async function getVenue(venueId: string): Promise<VenueData | null> {
    try {
        const { Item } = await dynamoDb.send(
            new GetCommand({
                TableName: VENUES_TABLE,
                Key: { venueId },
            })
        );

        if (Item) {
            return {
                ...Item,
                venueName: Item.venueName || Item.name || "Unknown Venue"
            } as VenueData;
        }

        console.warn(`Venue ${venueId} not found in DynamoDB.`);
        // Fallback logic could read from file, but for now we might rely on the caller handling null 
        // or if we want to mimic the sample theater:
        // we return null and let the seat-map component use its default.
        return null;

    } catch (error) {
        console.error(`Failed to fetch venue ${venueId} from DynamoDB:`, error);
        return null;
    }
}
