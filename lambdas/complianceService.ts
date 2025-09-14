import { SQSEvent } from "aws-lambda";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";

const ddb = new DynamoDBClient({});
const sns = new SNSClient({});

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Incoming Compliance SQS event:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      // Step 1: Parse SNS → SQS message
      const snsEnvelope = JSON.parse(record.body);
      const message = JSON.parse(snsEnvelope.Message);

      console.log("Processing Compliance for:", message);

      const { applicationId, payload } = message;
      const now = new Date().toISOString();

      // Step 2: Mock Compliance result (randomize)
      const complianceStatus =
        Math.random() < 0.8 ? "COMPLIANCE_PASSED" : "COMPLIANCE_FAILED";

      // Step 3: Append to LoanApplicationLogs
      await ddb.send(
        new PutItemCommand({
          TableName: process.env.LOGS_TABLE!,
          Item: {
            applicationId: { S: applicationId },
            logTimestamp: { S: now },
            action: { S: complianceStatus },
            actor: { S: "ComplianceService" },
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
            ":status": { S: complianceStatus },
            ":now": { S: now },
          },
        })
      );

      console.log(
        `Compliance processed: applicationId=${applicationId}, status=${complianceStatus}`
      );

      // Step 5: Publish new event to SNS
      const eventType =
        complianceStatus === "COMPLIANCE_PASSED"
          ? "CompliancePassed"
          : "ComplianceFailed";
      const eventPayload = {
        eventId: uuidv4(),
        applicationId,
        eventType,
        payload,
        createdAt: now,
      };

      await sns.send(
        new PublishCommand({
          TopicArn: process.env.OUTBOX_TOPIC_ARN,
          Message: JSON.stringify(eventPayload),
          MessageAttributes: {
            eventType: { DataType: "String", StringValue: eventType },
            applicationId: { DataType: "String", StringValue: applicationId },
          },
        })
      );

      console.log(`Published event to SNS: ${eventType}`, eventPayload);
    } catch (err: any) {
      console.error("Error processing Compliance record:", record, err);
      // Failed messages stay in SQS → retried or sent to DLQ if configured
    }
  }
};
