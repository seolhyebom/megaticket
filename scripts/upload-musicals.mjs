import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new DynamoDBClient({ region: "ap-northeast-2" });

async function uploadMusicals() {
    const dataPath = path.join(__dirname, "musicals-complete.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // Upload performances
    console.log("🎭 뮤지컬 performances 업로드 중...");
    const perfItems = data["plcr-gtbl-performances"];
    for (const item of perfItems) {
        const title = item.PutRequest.Item.title.S;
        try {
            await client.send(new BatchWriteItemCommand({
                RequestItems: {
                    "plcr-gtbl-performances": [item]
                }
            }));
            console.log(`✅ Success: ${title}`);
        } catch (error) {
            console.error(`❌ Failed: ${title}`, error.message);
        }
    }

    console.log("\n🎉 뮤지컬 2개 업로드 완료!");
}

uploadMusicals().catch(console.error);
