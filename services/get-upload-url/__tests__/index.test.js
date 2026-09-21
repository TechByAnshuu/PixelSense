/**
 * get-upload-url/__tests__/index.test.js
 *
 * Unit tests for the getUploadUrl Lambda handler.
 * AWS SDK clients are mocked using aws-sdk-client-mock.
 * authMiddleware is mocked to return a fixed userId.
 */

const { mockClient } = require('aws-sdk-client-mock');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Mock the S3 client before importing the handler
const s3Mock = mockClient(S3Client);

// Mock getSignedUrl (module-level mock)
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/bucket/key?presigned=token'),
}));

// Mock authMiddleware
jest.mock('../shared/authMiddleware', () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: 'user-abc-123', email: 'test@example.com' }),
}), { virtual: true });

// Set env vars before requiring the handler
process.env.UPLOADS_BUCKET         = 'test-bucket';
process.env.PRESIGNED_URL_EXPIRY   = '300';
process.env.COGNITO_USER_POOL_ID   = 'us-east-1_TEST';
process.env.AWS_ACCOUNT_REGION     = 'us-east-1';

const { handler } = require('../index');
const { verifyToken } = require('../shared/authMiddleware');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const makeEvent = (body = {}, headers = {}) => ({
  path: '/uploads',
  headers: { Authorization: 'Bearer fake.jwt.token', ...headers },
  body: JSON.stringify(body),
  pathParameters: null,
});

describe('getUploadUrl Lambda', () => {
  beforeEach(() => {
    s3Mock.reset();
    jest.clearAllMocks();
    // Re-apply getSignedUrl mock after clearAllMocks
    getSignedUrl.mockResolvedValue('https://s3.amazonaws.com/bucket/key?presigned=token');
    verifyToken.mockResolvedValue({ userId: 'user-abc-123', email: 'test@example.com' });
  });

  test('returns 201 with uploadUrl and imageId for valid request', async () => {
    const event = makeEvent({ fileName: 'photo.jpg', contentType: 'image/jpeg' });
    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.uploadUrl).toContain('https://s3.amazonaws.com');
    expect(body.imageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(body.expiresIn).toBe(300);
  });

  test('returns 401 when auth fails', async () => {
    verifyToken.mockRejectedValueOnce(new Error('Token expired'));
    const event = makeEvent({ fileName: 'photo.jpg', contentType: 'image/jpeg' });
    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 400 when fileName is missing', async () => {
    const event = makeEvent({ contentType: 'image/jpeg' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toMatch(/fileName/);
  });

  test('returns 400 when contentType is missing', async () => {
    const event = makeEvent({ fileName: 'photo.jpg' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toMatch(/contentType/);
  });

  test('returns 400 when contentType is not an image', async () => {
    const event = makeEvent({ fileName: 'file.pdf', contentType: 'application/pdf' });
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toMatch(/image/);
  });

  test('returns 400 for invalid JSON body', async () => {
    const event = { ...makeEvent(), body: 'not-json' };
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
  });

  test('returns 500 when S3 presigner throws', async () => {
    getSignedUrl.mockRejectedValueOnce(new Error('S3 unavailable'));
    const event = makeEvent({ fileName: 'photo.jpg', contentType: 'image/jpeg' });
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
  });

  test('response has CORS headers', async () => {
    const event = makeEvent({ fileName: 'photo.jpg', contentType: 'image/jpeg' });
    const result = await handler(event);

    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('sanitises fileName with special characters', async () => {
    const event = makeEvent({ fileName: '../etc/passwd', contentType: 'image/png' });
    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    // The presigned URL generation should have been called (fileName was sanitised, not rejected)
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });
});
