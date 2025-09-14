import { SQSEvent } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Incoming SQS event:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      // Step 1: Parse SNS wrapper (SQS delivers SNS messages as string in record.body)
      const snsEnvelope = JSON.parse(record.body);
      const message = JSON.parse(snsEnvelope.Message); // business payload

      console.log("Processing KYC for:", message);

      const { applicationId, payload, eventId } = message;

      // Step 2: Simulate KYC check (mock business logic)
      const kycStatus = "KYC_PASSED"; // or randomly fail if you want
      const now = new Date().toISOString();

      // Step 3: Append to LoanApplicationLogs
      await ddb.send(
        new PutItemCommand({
          TableName: process.env.LOGS_TABLE!,
          Item: {
            applicationId: { S: applicationId },
            logTimestamp: { S: now },
            action: { S: kycStatus },
            actor: { S: "KYCService" },
            details: { S: JSON.stringify(payload) },
          },
        })
      );

      // Step 4: (Optional) Update LoanApplications status
      // e.g., mark application as "UNDER_REVIEW" or "KYC_PASSED"

      console.log(
        `KYC processed for applicationId=${applicationId}, status=${kycStatus}`
      );
    } catch (err: any) {
      console.error("Error processing record:", record, err);
      // Failures → message remains in SQS, retried or moved to DLQ if configured
    }
  }
};
