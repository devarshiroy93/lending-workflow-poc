import { SQSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  BatchWriteItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const ddb = new DynamoDBClient({});
const MAX_RETRIES = 5;

async function batchWriteWithRetry(
  requestItems: Record<string, any>,
  attempt = 0
): Promise<void> {
  const response: BatchWriteItemCommandOutput = await ddb.send(
    new BatchWriteItemCommand({ RequestItems: requestItems })
  );

  if (
    response.UnprocessedItems &&
    Object.keys(response.UnprocessedItems).length > 0
  ) {
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 200; // exponential backoff
      console.warn(
        `Retrying unprocessed items (attempt ${attempt + 1}) after ${delay}ms`
      );
      await new Promise((res) => setTimeout(res, delay));
      return batchWriteWithRetry(response.UnprocessedItems, attempt + 1);
    } else {
      console.error(
        "Max retries reached. Unprocessed items:",
        JSON.stringify(response.UnprocessedItems, null, 2)
      );
    }
  }
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Incoming SQS event batch:", JSON.stringify(event));

  const requests = event.Records.map((record) => {
    try {
      // Step 1: Parse SNS → SQS envelope
      const snsEnvelope = JSON.parse(record.body);
      const message = JSON.parse(snsEnvelope.Message);

      console.log("Storing notification for:", message);

      const { applicationId, eventType, payload, createdAt } = message;

      return {
        PutRequest: {
          Item: {
            applicationId: { S: applicationId },
            createdAt: { S: createdAt },
            notificationId: { S: uuidv4() }, // unique ID in case of retries
            eventType: { S: eventType },
            payload: { S: JSON.stringify(payload) },
          },
        },
      };
    } catch (err: any) {
      console.error("Failed to parse record:", record, err);
      return null;
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (requests.length > 0) {
    await batchWriteWithRetry({
      [process.env.NOTIFICATIONS_TABLE!]: requests,
    });

    console.log(`✅ Stored ${requests.length} notifications`);
  }
};
