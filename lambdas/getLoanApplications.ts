import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,X-User-Id",
  "Access-Control-Allow-Methods": "OPTIONS,GET",
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Incoming event:", JSON.stringify(event));

  try {
    // Handle preflight OPTIONS
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

    // Query LoanApplications GSI by userId
    const query = new QueryCommand({
      TableName: process.env.APPLICATIONS_TABLE!,
      IndexName: "userid-index", // 👈 make sure this GSI exists
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": { S: userId },
      },
    });

    const result = await ddb.send(query);

    const applications = (result.Items || []).map((item) => ({
      applicationId: item.applicationId.S,
      amount: Number(item.amount.N),
      status: item.status.S,
      createdAt: item.createdAt.S,
      updatedAt: item.updatedAt.S,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ applications }),
    };
  } catch (err) {
    console.error("Error fetching applications:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
