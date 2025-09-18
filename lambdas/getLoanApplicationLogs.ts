import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.LOGS_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const applicationId = event.pathParameters?.id;
    if (!applicationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing applicationId in path" }),
      };
    }

    // optional query params
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 50;

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    // base condition
    let keyCondition = "applicationId = :appId";
    let expressionValues: Record<string, any> = { ":appId": applicationId };

    const params: any = {
      TableName: TABLE_NAME,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      Limit: limit,
      ScanIndexForward: true, // chronological order
    };

    // add date filter only if provided
    if (startDate && endDate) {
      params.KeyConditionExpression += " AND #ts BETWEEN :start AND :end";
      params.ExpressionAttributeNames = { "#ts": "timestamp" };
      params.ExpressionAttributeValues[":start"] = startDate;
      params.ExpressionAttributeValues[":end"] = endDate;
    }

    const result = await docClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.Items ?? []),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
