
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

// [LOCAl DEV] Force usage of specific profile if not set
if (process.env.NODE_ENV === "development" && !process.env.AWS_PROFILE) {
  process.env.AWS_PROFILE = "BedrockDevUser-hyebom";
}

export const bedrockClient = new BedrockRuntimeClient({
  region: "ap-northeast-2",
  // Credentials will be automatically resolved from:
  // 1. Environment variables (AWS_PROFILE set above)
  // 2. AWS credentials file (~/.aws/credentials)
});
