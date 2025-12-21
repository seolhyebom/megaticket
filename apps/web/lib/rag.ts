
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-northeast-2";
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "pldr-performances";

// Create DynamoDB Client
const client = new DynamoDBClient({
    region: REGION,
    // Credentials are automatically loaded from env vars or ~/.aws/credentials
});

const docClient = DynamoDBDocumentClient.from(client);

export interface Performance {
    concertId: string;
    title: string;
    artist: string;
    date: string;
    time?: string;
    venue: string;
    price: number;
    description: string;
}

/**
 * Searches for performances in DynamoDB based on the user query.
 * Uses a Scan operation (suitable for small datasets).
 * @param query User's search query
 * @returns Formatted context string for LLM
 */
export async function searchPerformances(query: string): Promise<string> {
    try {
        // For small datasets, Scan is acceptable.
        // In production with large data, use Query + GSI or OpenSearch.
        const command = new ScanCommand({
            TableName: TABLE_NAME,
        });

        const response = await docClient.send(command);
        const items = (response.Items || []) as Performance[];

        if (items.length === 0) {
            return "";
        }

        // Simple keyword matching (in-memory filtering for better control over Korean text if needed)
        // We check if title, artist, or description contains parts of the query.
        // Normalized to lowercase for case-insensitivity.
        const normalizedQuery = query.toLowerCase();

        // Split query into words to find partial matches
        const keywords = normalizedQuery.split(/\s+/).filter(k => k.length > 0);

        const relevantItems = items.filter(item => {
            const text = `${item.title} ${item.artist} ${item.description}`.toLowerCase();
            // Returns true if ANY keyword is found in the item text
            return keywords.some(keyword => text.includes(keyword));
        });

        // If no specific match, maybe return top upcoming events? 
        // For now, if no match, return empty string so the LLM relies on its general knowledge 
        // or says "I don't know".
        // OR: if the query implies "all concerts" or "recommend", we could return all.
        // Let's stick to keyword matching.

        if (relevantItems.length === 0) {
            // Fallback: If query contains "추천" (recommend) or "목록" (list), return top 3 items
            if (normalizedQuery.includes("추천") || normalizedQuery.includes("목록") || normalizedQuery.includes("공연")) {
                return formatContext(items.slice(0, 3));
            }
            return "";
        }

        // Limit to top 3 results to save tokens
        return formatContext(relevantItems.slice(0, 3));

    } catch (error) {
        console.error("Error searching DynamoDB:", error);
        return ""; // Fail gracefully without context
    }
}

function formatContext(performances: Performance[]): string {
    if (!performances || performances.length === 0) return "";

    const formatted = performances.map(p => {
        return `
<performance>
  <id>${p.concertId}</id>
  <title>${p.title}</title>
  <artist>${p.artist}</artist>
  <date>${p.date}</date>
  <time>${p.time || "미정"}</time>
  <venue>${p.venue}</venue>
  <price>${p.price.toLocaleString()} KRW</price>
  <description>${p.description}</description>
</performance>`.trim();
    }).join("\n");

    return `
<context>
Here is the real-time performance data fetched from the database:
${formatted}
</context>
`.trim();
}
