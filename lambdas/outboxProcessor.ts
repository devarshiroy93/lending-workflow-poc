// lending-workflow-poc/lambdas/outboxProcessor.ts
import { DynamoDBStreamEvent } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const sns = new SNSClient({});

export const handler = async (event: DynamoDBStreamEvent) => {
    console.log("Incoming stream event:", JSON.stringify(event));

    for (const record of event.Records) {
        if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) continue;

        const outboxItem = unmarshall(
            record.dynamodb.NewImage as Record<string, AttributeValue>
        );
        console.log("Processing outbox item:", outboxItem);

        // Only process if still marked as PENDING
        if (outboxItem.status !== "PENDING") continue;

        try {
            // 1. Publish to SNS
            await sns.send(
                new PublishCommand({
                    TopicArn: process.env.OUTBOX_TOPIC_ARN!,
                    Message: JSON.stringify({
                        eventId: outboxItem.eventId,
                        applicationId: outboxItem.applicationId,
                        eventType: outboxItem.eventType,
                        payload: JSON.parse(outboxItem.payload),
                        createdAt: outboxItem.createdAt,
                    }),
                    MessageAttributes: {
                        eventType: { DataType: "String", StringValue: outboxItem.eventType },
                        applicationId: {
                            DataType: "String",
                            StringValue: outboxItem.applicationId,
                        },
                    },
                })
            );

            // 2. Mark Outbox item as PROCESSED
            await ddb.send(
                new UpdateItemCommand({
                    TableName: process.env.OUTBOX_TABLE!,
                    Key: { eventId: { S: outboxItem.eventId } },
                    UpdateExpression: "SET #s = :processed, processedAt = :now",
                    ConditionExpression: "#s = :pending",
                    ExpressionAttributeNames: { "#s": "status" },
                    ExpressionAttributeValues: {
                        ":pending": { S: "PENDING" },
                        ":processed": { S: "PROCESSED" },
                        ":now": { S: new Date().toISOString() },
                    },
                })
            );

            console.log(`Successfully processed eventId=${outboxItem.eventId}`);
        } catch (err) {
            console.error(
                `Error processing eventId=${outboxItem.eventId}:`,
                (err as Error).message
            );
            // Leave status as PENDING -> will be retried
            // DLQ configured on this Lambda ensures persistent capture of failures
        }
    }
};
