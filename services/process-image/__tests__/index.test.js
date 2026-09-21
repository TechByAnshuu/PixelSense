/**
 * process-image/__tests__/index.test.js
 *
 * Unit tests for the processImage Lambda handler.
 * Mocks: Rekognition client, Bedrock client, DynamoDB client.
 */

// Mock modules before requiring handler
jest.mock('../rekognitionClient', () => ({
  analyzeImage: jest.fn(),
}));

jest.mock('../bedrockClient', () => ({
  generateSummary: jest.fn(),
}));

jest.mock('../shared/dynamoClient', () => ({
  docClient: {
    send: jest.fn(),
  },
}), { virtual: true });

process.env.DYNAMODB_TABLE     = 'test-results-table';
process.env.AWS_ACCOUNT_REGION = 'us-east-1';

const { handler }         = require('../index');
const { analyzeImage }    = require('../rekognitionClient');
const { generateSummary } = require('../bedrockClient');
const { docClient }       = require('../shared/dynamoClient');

// Sample Rekognition findings
const MOCK_FINDINGS = {
  labels:      [{ name: 'Mountain', confidence: 98 }],
  faces:       [{ confidence: 95, gender: 'Male', ageRange: { Low: 25, High: 35 } }],
  celebrities: [],
  text:        [{ detectedText: 'Summit 2.4 km', confidence: 92 }],
};

const MOCK_SUMMARY = 'A mountain trail with a hiker. A signpost reads Summit 2.4 km.';

// Build a minimal SQS event wrapping an S3 ObjectCreated notification
function makeSqsEvent(bucket, key) {
  return {
    Records: [{
      body: JSON.stringify({
        Records: [{
          s3: {
            bucket: { name: bucket },
            object: { key: encodeURIComponent(key).replace(/%2F/g, '/') },
          },
        }],
      }),
    }],
  };
}

describe('processImage Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyzeImage.mockResolvedValue(MOCK_FINDINGS);
    generateSummary.mockResolvedValue(MOCK_SUMMARY);
    docClient.send.mockResolvedValue({});
  });

  test('processes an S3 event end-to-end successfully', async () => {
    const event = makeSqsEvent('my-bucket', 'uploads/user-123/img-456/photo.jpg');
    await handler(event);

    expect(analyzeImage).toHaveBeenCalledWith('my-bucket', 'uploads/user-123/img-456/photo.jpg');
    expect(generateSummary).toHaveBeenCalledWith(MOCK_FINDINGS);
    expect(docClient.send).toHaveBeenCalledTimes(1);

    const putCall = docClient.send.mock.calls[0][0];
    expect(putCall.input.Item.PK).toBe('USER#user-123');
    expect(putCall.input.Item.SK).toBe('IMAGE#img-456');
    expect(putCall.input.Item.status).toBe('COMPLETE');
    expect(putCall.input.Item.summary).toBe(MOCK_SUMMARY);
  });

  test('writes all Rekognition findings to DynamoDB', async () => {
    const event = makeSqsEvent('bucket', 'uploads/u/i/file.png');
    await handler(event);

    const item = docClient.send.mock.calls[0][0].input.Item;
    expect(item.labels).toEqual(MOCK_FINDINGS.labels);
    expect(item.faces).toEqual(MOCK_FINDINGS.faces);
    expect(item.celebrities).toEqual(MOCK_FINDINGS.celebrities);
    expect(item.text).toEqual(MOCK_FINDINGS.text);
  });

  test('throws and propagates error when analyzeImage fails (triggers SQS retry)', async () => {
    analyzeImage.mockRejectedValueOnce(new Error('Rekognition throttled'));
    const event = makeSqsEvent('bucket', 'uploads/u/i/file.png');

    await expect(handler(event)).rejects.toThrow('Rekognition throttled');
    expect(docClient.send).not.toHaveBeenCalled();
  });

  test('throws and propagates error when generateSummary fails', async () => {
    generateSummary.mockRejectedValueOnce(new Error('Bedrock timeout'));
    const event = makeSqsEvent('bucket', 'uploads/u/i/file.png');

    await expect(handler(event)).rejects.toThrow('Bedrock timeout');
    expect(docClient.send).not.toHaveBeenCalled();
  });

  test('throws when S3 key format is invalid', async () => {
    const event = {
      Records: [{
        body: JSON.stringify({
          Records: [{ s3: { bucket: { name: 'b' }, object: { key: 'invalid/key' } } }],
        }),
      }],
    };

    await expect(handler(event)).rejects.toThrow(/Unexpected S3 key format/);
  });

  test('skips SQS record with no S3 event (test message)', async () => {
    const event = { Records: [{ body: JSON.stringify({ source: 'aws:s3', test: true }) }] };
    await handler(event);

    expect(analyzeImage).not.toHaveBeenCalled();
    expect(docClient.send).not.toHaveBeenCalled();
  });

  test('DynamoDB item includes createdAt ISO timestamp', async () => {
    const event = makeSqsEvent('bucket', 'uploads/u/i/file.png');
    await handler(event);

    const item = docClient.send.mock.calls[0][0].input.Item;
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('DynamoDB item includes ttl as a future unix timestamp', async () => {
    const before = Math.floor(Date.now() / 1000);
    const event  = makeSqsEvent('bucket', 'uploads/u/i/file.png');
    await handler(event);
    const after = Math.floor(Date.now() / 1000);

    const item = docClient.send.mock.calls[0][0].input.Item;
    expect(item.ttl).toBeGreaterThan(before);
    expect(item.ttl).toBeGreaterThan(after + 80 * 24 * 60 * 60); // > 80 days from now
  });
});
