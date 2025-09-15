// disbursementService.js
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const dynamo = new DynamoDBClient({});
const sns = new SNSClient({});
const TABLE_APPLICATIONS = process.env.TABLE_APPLICATIONS;
const TABLE_LOGS = process.env.TABLE_LOGS;
const TOPIC_ARN = process.env.TOPIC_ARN;

export const handler = async (event : any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const message = JSON.parse(record.body); // from SQS
    const { eventType, applicationId } = message;

    if (eventType !== "CompliancePassed") {
      console.log("Ignoring irrelevant event:", eventType);
      continue;
    }

    // Mock disbursement: random PASS/FAIL
    const success = Math.random() > 0.3; // 70% success rate
    const newStatus = success ? "DISBURSED" : "DISBURSEMENT_FAILED";
    const newEvent = success ? "DisbursementSuccess" : "DisbursementFailed";

    // Transaction: update application + log entry
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

    // Publish new event
    await sns.send(new PublishCommand({
      TopicArn: TOPIC_ARN,
      Message: JSON.stringify({
        eventType: newEvent,
        applicationId,
        timestamp: new Date().toISOString(),
      }),
    }));

    console.log(`Processed Disbursement for ${applicationId} → ${newEvent}`);
  }
};
