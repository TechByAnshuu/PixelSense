# PixelSense — Architecture

## System Overview

PixelSense is a serverless, event-driven, multi-tenant image analysis platform. No servers are managed — every component scales to zero and pays per invocation.

## Request Flow

```
1. User signs in via Cognito → receives ID Token (JWT)

2. Frontend calls POST /uploads (API Gateway → Lambda: getUploadUrl)
   - Lambda verifies JWT, generates imageId, creates presigned S3 PUT URL
   - Returns { uploadUrl, imageId }

3. Frontend PUTs image directly to S3 (presigned URL)
   - Server never handles raw image bytes
   - S3 key: uploads/{userId}/{imageId}/{fileName}

4. S3 ObjectCreated event → SQS processing queue
   - Decouples upload spike from processing

5. SQS → Lambda: processImage
   - DetectLabels, DetectFaces, RecognizeCelebrities, DetectText (parallel)
   - Bedrock generates 2–4 sentence summary from Rekognition JSON
   - Writes COMPLETE record to DynamoDB
   - On failure: Lambda throws → SQS retry → DLQ after 3 attempts

6. Frontend polls GET /results/{imageId} every 2 seconds
   - Returns { status: 'PROCESSING' } until Lambda writes result
   - Returns full result once COMPLETE

7. CloudFront serves React SPA from private S3 bucket (OAC)
   - SPA error routing: 403/404 → index.html (client-side routing)
```

## Data Model (DynamoDB Single-Table)

```
PK              SK                  Attributes
─────────────── ─────────────────── ──────────────────────────────────────
USER#{userId}   IMAGE#{imageId}     status, labels, faces, celebrities,
                                    text, summary, createdAt, ttl
```

**Query patterns:**
- `PK = USER#{userId}` → full history (newest first via `ScanIndexForward: false`)
- `PK = USER#{userId}`, `SK = IMAGE#{imageId}` → single item

## IAM Roles (least-privilege per Lambda)

| Lambda | S3 | SQS | DynamoDB | Rekognition | Bedrock |
|--------|----|-----|----------|-------------|---------|
| getUploadUrl | PutObject (uploads/*) | — | — | — | — |
| processImage | GetObject (uploads/*) | Receive, Delete | PutItem | DetectLabels, DetectFaces, RecognizeCelebrities, DetectText | InvokeModel |
| getResult | — | — | Query, GetItem | — | — |

## Failure & Resilience

```
Upload →  S3 ObjectCreated
             ↓
         SQS processing queue
             ↓ (attempt 1)
         processImage Lambda
             ↓ on error
         SQS visibility timeout expires → retry
             ↓ (attempt 2)
         processImage Lambda
             ↓ on error
         retry
             ↓ (attempt 3, maxReceiveCount=3)
         → DLQ
         CloudWatch alarm fires on DLQ depth > 0
```

SDK v3 is configured with `maxAttempts: 3` for Rekognition and Bedrock — this handles transient throttling before the Lambda throws and SQS takes over.

## Security

- Uploads bucket: all public access blocked; only accessible via presigned PUT URLs or Lambda IAM role
- Frontend bucket: served exclusively via CloudFront OAC; no direct S3 access
- All API routes: Cognito JWT authorizer (API Gateway rejects invalid tokens before Lambda runs)
- Usage plan: 10 req/sec sustained, burst 20 — caps cost from Rekognition/Bedrock calls
- TTL: DynamoDB records auto-expire after 90 days

## Observability

```
CloudWatch Dashboard
  ├── Lambda invocations & errors (all 3 functions)
  ├── SQS processing queue depth
  ├── DLQ depth (alarm at > 0)
  ├── API Gateway 4xx/5xx
  └── Lambda p99 duration

CloudWatch Alarms → SNS → Email
  ├── getUploadUrl errors > 5 in 2 min
  ├── processImage errors > 3 in 2 min
  ├── DLQ messages > 0
  └── API 5xx > 10 in 2 min

AWS Budgets
  ├── Total monthly: alert at 50%, 80%, 100%
  └── AI services (Rekognition + Bedrock): alert at 80%, 100% (forecasted)
```
