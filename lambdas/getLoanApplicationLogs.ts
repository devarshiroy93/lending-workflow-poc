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

    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 50;

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;

    let keyCondition = "applicationId = :appId";
    let expressionValues: Record<string, any> = { ":appId": applicationId };

    const params: any = {
      TableName: TABLE_NAME,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      Limit: limit,
      ScanIndexForward: false, // newest first for timeline
    };

    if (startDate && endDate) {
      params.KeyConditionExpression += " AND #ts BETWEEN :start AND :end";
      params.ExpressionAttributeNames = { "#ts": "timestamp" };
      params.ExpressionAttributeValues[":start"] = startDate;
      params.ExpressionAttributeValues[":end"] = endDate;
    }

    const result = await docClient.send(new QueryCommand(params));

    const items = (result.Items ?? []).map((item: any) => {
      let parsedDetails = item.details;
      if (typeof parsedDetails === "string") {
        try {
          parsedDetails = JSON.parse(parsedDetails);
        } catch {
          // leave as string if not valid JSON
        }
      }

      return {
        eventType: item.eventType || item.action, // normalize
        actor: item.actor || null,
        timestamp: item.logTimestamp,
        applicationId: item.applicationId,
        details: parsedDetails ?? null,
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
