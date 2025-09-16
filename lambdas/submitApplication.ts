import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const ddb = new DynamoDBClient({});

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,X-User-Id",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Incoming event:", JSON.stringify(event));

  try {
    // Handle preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "CORS preflight OK" }),
      };
    }

    // Get userId from header
    const userId = event.headers?.["x-user-id"] || event.headers?.["X-User-Id"];
    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing x-user-id header" }),
      };
    }

    // Parse body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Request body is required" }),
      };
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid JSON in body" }),
      };
    }

    const { amount } = parsedBody;
    if (!amount) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing amount in body" }),
      };
    }

    // Core IDs
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
      details: { S: JSON.stringify({ userId, amount }) },
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

    // Transaction write
    const txn = new TransactWriteItemsCommand({
      TransactItems: [
        { Put: { TableName: process.env.APPLICATIONS_TABLE!, Item: applicationItem } },
        { Put: { TableName: process.env.LOGS_TABLE!, Item: logItem } },
        { Put: { TableName: process.env.OUTBOX_TABLE!, Item: outboxItem } },
      ],
    });

    await ddb.send(txn);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Loan application submitted successfully",
        applicationId,
      }),
    };
  } catch (err) {
    console.error("Error submitting loan application:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
