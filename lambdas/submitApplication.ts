import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: "Missing userId or amount" }),
      };
    }

    const applicationId = uuidv4();
    const now = new Date().toISOString();

    const item = {
      applicationId: { S: applicationId },
      userId: { S: userId },
      amount: { N: String(amount) },
      status: { S: "SUBMITTED" },
      createdAt: { S: now },
      updatedAt: { S: now },
    };

    await ddb.send(
      new PutItemCommand({
        TableName: process.env.APPLICATIONS_TABLE!,
        Item: item,
      })
    );

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Loan application submitted successfully",
        applicationId,
      }),
    };
  } catch (err: any) {
    console.error("Error submitting loan application:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
