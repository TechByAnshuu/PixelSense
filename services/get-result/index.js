/**
 * get-result/index.js
 *
 * Lambda handler: GET /results and GET /results/{imageId}
 *
 * Flow:
 *   1. Verify Cognito JWT → extract userId
 *   2a. If imageId path param present → GetItem (single result)
 *   2b. No imageId → Query all images for userId (history)
 *   3. Return result(s) or { status: 'PROCESSING' } if not yet written
 */

const { QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient }    = require('../shared/dynamoClient');
const { verifyToken }  = require('../shared/authMiddleware');
const responses        = require('../shared/responses');

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;

/**
 * @param {import('aws-lambda').APIGatewayProxyEvent} event
 * @returns {Promise<import('aws-lambda').APIGatewayProxyResult>}
 */
exports.handler = async (event) => {
  console.log(JSON.stringify({
    level:   'INFO',
    message: 'getResult invoked',
    path:    event.path,
    params:  event.pathParameters,
  }));

  // ── 1. Auth ──────────────────────────────────────────────
  let userId;
  try {
    const auth = await verifyToken(event.headers.Authorization || event.headers.authorization);
    userId = auth.userId;
  } catch (err) {
    console.log(JSON.stringify({ level: 'WARN', message: 'Auth failed', error: err.message }));
    return responses.unauthorized(err.message);
  }

  const imageId = event.pathParameters?.imageId;

  // ── 2a. Single result ────────────────────────────────────
  if (imageId) {
    let item;
    try {
      const result = await docClient.send(new GetCommand({
        TableName: DYNAMODB_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `IMAGE#${imageId}`,
        },
      }));
      item = result.Item;
    } catch (err) {
      console.log(JSON.stringify({ level: 'ERROR', message: 'DynamoDB GetItem failed', error: err.message, userId, imageId }));
      return responses.internalError('Failed to retrieve result');
    }

    if (!item) {
      // Not yet written → still processing
      return responses.ok({ imageId, status: 'PROCESSING' });
    }

    console.log(JSON.stringify({ level: 'INFO', message: 'Single result returned', userId, imageId, status: item.status }));
    return responses.ok(item);
  }

  // ── 2b. Full history ─────────────────────────────────────
  let items;
  try {
    const result = await docClient.send(new QueryCommand({
      TableName:                DYNAMODB_TABLE,
      KeyConditionExpression:   'PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
      ScanIndexForward:          false, // newest first
      Limit:                     50,    // cap at 50 per page
    }));
    items = result.Items || [];
  } catch (err) {
    console.log(JSON.stringify({ level: 'ERROR', message: 'DynamoDB Query failed', error: err.message, userId }));
    return responses.internalError('Failed to retrieve history');
  }

  console.log(JSON.stringify({ level: 'INFO', message: 'History returned', userId, count: items.length }));
  return responses.ok({ items, count: items.length });
};
