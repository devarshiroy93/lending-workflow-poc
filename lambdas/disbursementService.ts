// disbursementService.ts (or .js after build)
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const dynamo = new DynamoDBClient({});
const sns = new SNSClient({});
const TABLE_APPLICATIONS = process.env.TABLE_APPLICATIONS!;
const TABLE_LOGS = process.env.TABLE_LOGS!;
const TOPIC_ARN = process.env.TOPIC_ARN!;

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      // Parse SQS body (SNS envelope) -> business message
      const snsEnvelope = JSON.parse(record.body);
      const message = JSON.parse(snsEnvelope.Message);

      const { eventType, applicationId, payload } = message;

      if (eventType !== "CompliancePassed") {
        console.log("Ignoring irrelevant event:", eventType);
        continue;
      }

      // Mock disbursement
      const success = Math.random() > 0.3; // 70% success
      const newStatus = success ? "DISBURSED" : "DISBURSEMENT_FAILED";
      const publishEvent = success ? "DisbursementSuccess" : "DisbursementFailed";

      // Log fields per your required schema
      const action = success ? "DISBURSEMENT_SUCCESS" : "DISBURSEMENT_FAILED";
      const actor = "DisbursementService";
      const logTimestamp = new Date().toISOString();
      const details = JSON.stringify(payload ?? {});

      // Transaction: update application status + write audit log (with correct keys)
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
                applicationId: { S: applicationId },
                logTimestamp: { S: logTimestamp },
                action: { S: action },
                actor: { S: actor },
                details: { S: details },
              },
            },
          },
        ],
      });

      await dynamo.send(transactCmd);

      // Publish outcome event
      await sns.send(new PublishCommand({
        TopicArn: TOPIC_ARN,
        Message: JSON.stringify({
          eventType: publishEvent,
          applicationId,
          timestamp: logTimestamp,
        }),
        MessageAttributes: {
          eventType: { DataType: "String", StringValue: publishEvent },
          applicationId: { DataType: "String", StringValue: applicationId },
        },
      }));

      console.log(`✅ Processed Disbursement for ${applicationId} → ${publishEvent}`);
    } catch (err) {
      console.error("❌ Error processing record:", err);
    }
  }
};
