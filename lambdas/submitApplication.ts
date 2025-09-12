import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const ddb = new DynamoDBClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    const body = event.body ? JSON.parse(event.body) : {};
    const { userId, amount } = body;

    if (!userId || !amount) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Missing userId or amount" }),
      };
    }

    const applicationId = uuidv4();
    const now = new Date().toISOString();
    const eventId = uuidv4();

    // Application record
    const applicationItem = {
      applicationId: { S: applicationId },
      userId: { S: userId },
      amount: { N: String(amount) },
      status: { S: "SUBMITTED" },
      createdAt: { S: now },
      updatedAt: { S: now },
    };

    // Log record
    const logItem = {
      applicationId: { S: applicationId },
      logTimestamp: { S: now },
      action: { S: "SUBMITTED" },
      actor: { S: "LoanSubmissionService" },
      details: { S: JSON.stringify({ amount, userId }) },
    };

    // Outbox record
    const outboxItem = {
      eventId: { S: eventId },
      applicationId: { S: applicationId },
      eventType: { S: "ApplicationSubmitted" },
      payload: { S: JSON.stringify({ userId, amount }) },
      status: { S: "PENDING" },
      createdAt: { S: now },
    };

    // Transaction: write all 3 records
    const txn = new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.APPLICATIONS_TABLE!,
            Item: applicationItem,
          },
        },
        {
          Put: {
            TableName: process.env.LOGS_TABLE!,
            Item: logItem,
          },
        },
        {
          Put: {
            TableName: process.env.OUTBOX_TABLE!,
            Item: outboxItem,
          },
        },
      ],
    });

    await ddb.send(txn);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Loan application submitted successfully",
        applicationId,
      }),
    };
  } catch (err: any) {
    console.error("Error submitting loan application:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
