/**
 * dynamoClient.js — Shared DynamoDB Document Client (singleton)
 *
 * A single DynamoDBDocumentClient instance shared across Lambda invocations
 * within the same execution environment (warm starts reuse this connection).
 *
 * Uses AWS SDK v3 modular packages:
 *   @aws-sdk/client-dynamodb
 *   @aws-sdk/lib-dynamodb
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const rawClient = new DynamoDBClient({
  region: process.env.AWS_ACCOUNT_REGION || process.env.AWS_REGION || 'us-east-1',
  maxAttempts: 3,
});

const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

module.exports = { docClient };
