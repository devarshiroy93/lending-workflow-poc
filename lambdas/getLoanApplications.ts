import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,X-User-Id,x-user-id",
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

    // Normalize headers to lowercase
    const headers = Object.fromEntries(
      Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );

    const userId = headers["x-user-id"];
    if (!userId) {
      console.warn("Missing x-user-id header. Headers received:", headers);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing x-user-id header" }),
      };
    }

    // Query LoanApplications by userId using GSI
    const query = new QueryCommand({
      TableName: process.env.APPLICATIONS_TABLE!,
      IndexName: "userId-index", // 👈 must exist in DynamoDB
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
