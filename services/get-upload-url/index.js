/**
 * get-upload-url/index.js
 *
 * Lambda handler: POST /uploads
 *
 * Flow:
 *   1. Verify Cognito JWT → extract userId
 *   2. Validate request body (fileName, contentType)
 *   3. Generate a UUID imageId
 *   4. Generate a presigned S3 PUT URL scoped to:
 *        uploads/{userId}/{imageId}/{fileName}
 *      expiring in PRESIGNED_URL_EXPIRY seconds
 *   5. Return { uploadUrl, imageId }
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
const { verifyToken } = require('../shared/authMiddleware');
const responses = require('../shared/responses');

const UPLOADS_BUCKET   = process.env.UPLOADS_BUCKET;
const EXPIRY_SECONDS   = parseInt(process.env.PRESIGNED_URL_EXPIRY || '300', 10);
const REGION           = process.env.AWS_ACCOUNT_REGION || process.env.AWS_REGION;

const s3 = new S3Client({ region: REGION, maxAttempts: 3 });

/**
 * @param {import('aws-lambda').APIGatewayProxyEvent} event
 * @returns {Promise<import('aws-lambda').APIGatewayProxyResult>}
 */
exports.handler = async (event) => {
  console.log(JSON.stringify({ level: 'INFO', message: 'getUploadUrl invoked', path: event.path }));

  // ── 1. Auth ──────────────────────────────────────────────
  let userId;
  try {
    const auth = await verifyToken(event.headers.Authorization || event.headers.authorization);
    userId = auth.userId;
  } catch (err) {
    console.log(JSON.stringify({ level: 'WARN', message: 'Auth failed', error: err.message }));
    return responses.unauthorized(err.message);
  }

  // ── 2. Validate body ─────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return responses.badRequest('Request body must be valid JSON');
  }

  const { fileName, contentType } = body;

  if (!fileName || typeof fileName !== 'string') {
    return responses.badRequest('fileName is required and must be a string');
  }
  if (!contentType || typeof contentType !== 'string') {
    return responses.badRequest('contentType is required and must be a string');
  }
  if (!contentType.startsWith('image/')) {
    return responses.badRequest('contentType must be an image MIME type (e.g. image/jpeg)');
  }

  // Sanitise fileName — strip path traversal attempts
  const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 200);

  // ── 3. Generate IDs ──────────────────────────────────────
  const imageId = randomUUID();
  const s3Key   = `uploads/${userId}/${imageId}/${safeFileName}`;

  // ── 4. Generate presigned PUT URL ────────────────────────
  const command = new PutObjectCommand({
    Bucket:      UPLOADS_BUCKET,
    Key:         s3Key,
    ContentType: contentType,
    Metadata: {
      userId,
      imageId,
    },
  });

  let uploadUrl;
  try {
    uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRY_SECONDS });
  } catch (err) {
    console.log(JSON.stringify({ level: 'ERROR', message: 'Failed to generate presigned URL', error: err.message, userId }));
    return responses.internalError('Could not generate upload URL');
  }

  console.log(JSON.stringify({ level: 'INFO', message: 'Presigned URL generated', userId, imageId, s3Key }));

  // ── 5. Return ────────────────────────────────────────────
  return responses.created({ uploadUrl, imageId, expiresIn: EXPIRY_SECONDS });
};
