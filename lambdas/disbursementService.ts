import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const dynamo = new DynamoDBClient({});
const sns = new SNSClient({});
const TABLE_APPLICATIONS = process.env.TABLE_APPLICATIONS;
const TABLE_LOGS = process.env.TABLE_LOGS;
const TOPIC_ARN = process.env.TOPIC_ARN;

export const handler = async (event :any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      // Step 1: Parse SQS body (SNS envelope)
      const snsEnvelope = JSON.parse(record.body);

      // Step 2: Parse the actual business message
      const message = JSON.parse(snsEnvelope.Message);

      const { eventType, applicationId } = message;

      if (eventType !== "CompliancePassed") {
        console.log("Ignoring irrelevant event:", eventType);
        continue;
      }

      // Step 3: Mock disbursement (random outcome)
      const success = Math.random() > 0.3; // 70% chance success
      const newStatus = success ? "DISBURSED" : "DISBURSEMENT_FAILED";
      const newEvent = success ? "DisbursementSuccess" : "DisbursementFailed";

      // Step 4: Transactional write (update LoanApplications + insert LoanApplicationLogs)
      const transactCmd = new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE_APPLICATIONS,
              Key: { applicationId: { S: applicationId } },
              UpdateExpression: "SET #s = :s",
              ExpressionAttributeNames: { "#s": "status" },
              ExpressionAttributeValues: { ":s": { S: newStatus } },
            },
          },
          {
            Put: {
              TableName: TABLE_LOGS,
              Item: {
                logId: { S: `${applicationId}-${Date.now()}` },
                applicationId: { S: applicationId },
                eventType: { S: newEvent },
                timestamp: { S: new Date().toISOString() },
              },
            },
          },
        ],
      });
      await dynamo.send(transactCmd);

      // Step 5: Publish new event to SNS
      await sns.send(new PublishCommand({
        TopicArn: TOPIC_ARN,
        Message: JSON.stringify({
          eventType: newEvent,
          applicationId,
          timestamp: new Date().toISOString(),
        }),
        MessageAttributes: {
          eventType: { DataType: "String", StringValue: newEvent },
          applicationId: { DataType: "String", StringValue: applicationId },
        },
      }));

      console.log(`✅ Processed Disbursement for ${applicationId} → ${newEvent}`);
    } catch (err) {
      console.error("❌ Error processing record:", err);
    }
  }
};
