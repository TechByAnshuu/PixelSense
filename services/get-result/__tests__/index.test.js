/**
 * get-result/__tests__/index.test.js
 *
 * Unit tests for the getResult Lambda handler.
 * Mocks: DynamoDB client, authMiddleware.
 */

jest.mock('../shared/authMiddleware', () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: 'user-abc', email: 'test@example.com' }),
}), { virtual: true });

jest.mock('../shared/dynamoClient', () => ({
  docClient: { send: jest.fn() },
}), { virtual: true });

process.env.DYNAMODB_TABLE     = 'test-table';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST';
process.env.AWS_ACCOUNT_REGION = 'us-east-1';

const { handler }     = require('../index');
const { verifyToken } = require('../shared/authMiddleware');
const { docClient }   = require('../shared/dynamoClient');

const makeEvent = (imageId = null) => ({
  path: imageId ? `/results/${imageId}` : '/results',
  headers: { Authorization: 'Bearer fake.jwt.token' },
  pathParameters: imageId ? { imageId } : null,
  body: null,
});

const MOCK_ITEM = {
  PK: 'USER#user-abc', SK: 'IMAGE#img-001',
  userId: 'user-abc', imageId: 'img-001',
  status: 'COMPLETE',
  labels: [{ name: 'Mountain', confidence: 98 }],
  faces: [], celebrities: [], text: [],
  summary: 'A mountain scene.',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('getResult Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyToken.mockResolvedValue({ userId: 'user-abc', email: 'test@example.com' });
  });

  // ── Single result ────────────────────────────────────────

  test('returns 200 with full item when imageId found', async () => {
    docClient.send.mockResolvedValueOnce({ Item: MOCK_ITEM });
    const result = await handler(makeEvent('img-001'));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.imageId).toBe('img-001');
    expect(body.status).toBe('COMPLETE');
    expect(body.summary).toBe('A mountain scene.');
  });

  test('returns { status: PROCESSING } when imageId not found in DynamoDB', async () => {
    docClient.send.mockResolvedValueOnce({ Item: undefined });
    const result = await handler(makeEvent('img-not-found'));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('PROCESSING');
    expect(body.imageId).toBe('img-not-found');
  });

  // ── History ──────────────────────────────────────────────

  test('returns 200 with items array when no imageId given', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [MOCK_ITEM] });
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(1);
    expect(body.count).toBe(1);
  });

  test('returns empty array when user has no history', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [] });
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.items).toEqual([]);
    expect(body.count).toBe(0);
  });

  // ── Auth failures ────────────────────────────────────────

  test('returns 401 when auth fails', async () => {
    verifyToken.mockRejectedValueOnce(new Error('Token expired'));
    const result = await handler(makeEvent('img-001'));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Unauthorized');
  });

  // ── DynamoDB errors ──────────────────────────────────────

  test('returns 500 when DynamoDB GetItem throws', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const result = await handler(makeEvent('img-001'));

    expect(result.statusCode).toBe(500);
  });

  test('returns 500 when DynamoDB Query throws', async () => {
    docClient.send.mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(500);
  });

  // ── Response shape ────────────────────────────────────────

  test('response has CORS headers', async () => {
    docClient.send.mockResolvedValueOnce({ Items: [] });
    const result = await handler(makeEvent());

    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('body is a valid JSON string', async () => {
    docClient.send.mockResolvedValueOnce({ Item: MOCK_ITEM });
    const result = await handler(makeEvent('img-001'));

    expect(() => JSON.parse(result.body)).not.toThrow();
  });
});
