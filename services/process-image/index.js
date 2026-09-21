/**
 * process-image/index.js
 *
 * Lambda handler: triggered by SQS (S3 ObjectCreated event)
 *
 * Flow:
 *   1. Parse SQS message → extract S3 bucket + key
 *   2. Parse userId / imageId from the S3 key
 *   3. Run Rekognition (4 APIs in parallel)
 *   4. Generate Bedrock summary
 *   5. Write COMPLETE record to DynamoDB
 *
 * On any unhandled error the Lambda fails → SQS visibility timeout expires →
 * SQS retries → after maxReceiveCount the message goes to DLQ.
 * Do NOT catch-and-swallow errors here — let SQS handle retries.
 */

const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient }  = require('../shared/dynamoClient');
const { analyzeImage }    = require('./rekognitionClient');
const { generateSummary } = require('./bedrockClient');

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;

/**
 * Parse the S3 key to extract userId and imageId.
 * Expected format: uploads/{userId}/{imageId}/{fileName}
 *
 * @param {string} key
 * @returns {{ userId: string, imageId: string }}
 */
function parseS3Key(key) {
  // Decode URI-encoded characters (S3 event keys are URL-encoded)
  const decoded = decodeURIComponent(key.replace(/\+/g, ' '));
  const parts   = decoded.split('/');

  if (parts.length < 4 || parts[0] !== 'uploads') {
    throw new Error(`Unexpected S3 key format: ${key}`);
  }

  return { userId: parts[1], imageId: parts[2] };
}

/**
 * @param {import('aws-lambda').SQSEvent} event
 */
exports.handler = async (event) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'processImage invoked',
    recordCount: event.Records.length,
  }));

  // Process each SQS record (batch size = 1 from Terraform, but handle defensively)
  for (const sqsRecord of event.Records) {
    let s3Bucket, s3Key;

    // ── 1. Parse SQS → S3 event ────────────────────────────
    try {
      const body     = JSON.parse(sqsRecord.body);
      const s3Record = body.Records?.[0]?.s3;

      if (!s3Record) {
        console.log(JSON.stringify({ level: 'WARN', message: 'No S3 record in SQS message', body: sqsRecord.body }));
        continue; // skip non-S3 test messages
      }

      s3Bucket = s3Record.bucket.name;
      s3Key    = s3Record.object.key;
    } catch (err) {
      console.log(JSON.stringify({ level: 'ERROR', message: 'Failed to parse SQS message', error: err.message }));
      throw err; // fail → SQS retry
    }

    // ── 2. Parse userId / imageId ──────────────────────────
    let userId, imageId;
    try {
      ({ userId, imageId } = parseS3Key(s3Key));
    } catch (err) {
      console.log(JSON.stringify({ level: 'ERROR', message: 'Failed to parse S3 key', s3Key, error: err.message }));
      throw err;
    }

    console.log(JSON.stringify({ level: 'INFO', message: 'Processing image', userId, imageId, s3Bucket, s3Key }));

    // ── 3. Rekognition ─────────────────────────────────────
    const findings = await analyzeImage(s3Bucket, s3Key);

    // ── 4. Bedrock summary ─────────────────────────────────
    const summary = await generateSummary(findings);

    // ── 5. Write to DynamoDB ───────────────────────────────
    const item = {
      PK:          `USER#${userId}`,
      SK:          `IMAGE#${imageId}`,
      userId,
      imageId,
      status:      'COMPLETE',
      labels:      findings.labels,
      faces:       findings.faces,
      celebrities: findings.celebrities,
      text:        findings.text,
      summary,
      createdAt:   new Date().toISOString(),
      // Optional TTL — expire records after 90 days
      ttl:         Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
    };

    await docClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item:      item,
    }));

    console.log(JSON.stringify({
      level:   'INFO',
      message: 'Result written to DynamoDB',
      userId,
      imageId,
      status:  'COMPLETE',
    }));
  }
};
