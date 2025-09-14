import { SQSEvent } from "aws-lambda";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Incoming SQS event:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      // Step 1: Parse SNS → SQS message
      const snsEnvelope = JSON.parse(record.body);
      const message = JSON.parse(snsEnvelope.Message);

      console.log("Processing KYC for:", message);

      const { applicationId, payload, eventId } = message;
      const now = new Date().toISOString();

      // Step 2: Mock KYC result
      const kycStatus = "KYC_PASSED"; // you can randomize PASS/FAIL for demo

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

      // Step 4: Update LoanApplications table with latest status
      await ddb.send(
        new UpdateItemCommand({
          TableName: process.env.APPLICATIONS_TABLE!,
          Key: { applicationId: { S: applicationId } },
          UpdateExpression: "SET #s = :status, updatedAt = :now",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":status": { S: kycStatus },
            ":now": { S: now },
          },
        })
      );

      console.log(
        `KYC processed: applicationId=${applicationId}, status=${kycStatus}`
      );
    } catch (err: any) {
      console.error("Error processing record:", record, err);
      // Failed messages stay in SQS → retried or sent to DLQ if configured
    }
  }
};
