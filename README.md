# PixelSense — Cloud AI Image Analysis Platform

> A serverless, event-driven, multi-tenant image analysis platform powered by AWS Rekognition, Amazon Bedrock, and React.

---

## Architecture

```
Browser (React SPA)
  → POST /uploads (API Gateway + Lambda: getUploadUrl)
  → PUT image to S3 (presigned URL, no server touches bytes)
  → S3 ObjectCreated → SQS (processing queue)
  → Lambda: processImage (Rekognition × 4 + Bedrock summary)
  → DynamoDB (USER#{userId} / IMAGE#{imageId})
  → GET /results/{imageId} polls until COMPLETE
  → CloudFront serves SPA from S3 static bucket
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Terraform 1.5+
- AWS CLI configured (`aws configure`)
- AWS account with Bedrock model access enabled

### 1. Deploy Infrastructure

```bash
cd infra

# Create the build output directory Terraform needs for Lambda zips
mkdir .builds

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

> After apply, copy the outputs — you'll need them for the frontend `.env`.

### 2. Configure the Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `.env` with values from `terraform output`:
```
VITE_COGNITO_USER_POOL_ID=<cognito_user_pool_id>
VITE_COGNITO_CLIENT_ID=<cognito_user_pool_client_id>
VITE_API_BASE_URL=<api_gateway_invoke_url>
```

### 3. Install Lambda Dependencies

```bash
cd services/get-upload-url && npm install
cd ../process-image && npm install
cd ../get-result && npm install
```

### 4. Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173

### 5. Run Tests

```bash
cd services/get-upload-url && npm test
cd ../process-image && npm test
cd ../get-result && npm test
```

### 6. Deploy Frontend to S3 + CloudFront

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://$(cd ../infra && terraform output -raw s3_frontend_bucket)/ --delete
```

---

## Project Structure

```
PixelSense/
├── index.html                     # Marketing landing page
├── infra/                         # Terraform (all AWS resources)
│   ├── main.tf                    # Provider, locals
│   ├── variables.tf               # All input variables
│   ├── outputs.tf                 # Exported values
│   ├── cognito.tf                 # User Pool + App Client
│   ├── s3.tf                      # Uploads + frontend buckets
│   ├── dynamodb.tf                # Single-table results
│   ├── sqs.tf                     # Processing queue + DLQ
│   ├── lambda.tf                  # All 3 Lambda functions + IAM
│   ├── apigateway.tf              # REST API + Cognito authorizer
│   ├── cloudfront.tf              # CDN distribution
│   ├── cloudwatch.tf              # Dashboard + alarms
│   └── budgets.tf                 # Spend alerts
├── services/
│   ├── shared/
│   │   ├── authMiddleware.js      # Cognito JWT verification
│   │   ├── dynamoClient.js        # DynamoDB Document Client
│   │   └── responses.js           # API Gateway response builder
│   ├── get-upload-url/            # POST /uploads Lambda
│   ├── process-image/             # SQS-triggered Lambda
│   └── get-result/                # GET /results Lambda
├── frontend/                      # Vite + React SPA
│   └── src/
│       ├── auth/                  # Login, Signup, CognitoConfig
│       ├── upload/                # UploadForm + useUploadUrl hook
│       ├── results/               # ResultView + HistoryList + usePollResult
│       └── api/                   # Axios client with JWT interceptor
└── docs/
    ├── api-contract.md
    └── architecture.md
```

---

## Environment Variables

### Lambda (set via Terraform — do not hardcode)

| Variable | Used by | Description |
|----------|---------|-------------|
| `UPLOADS_BUCKET` | get-upload-url | S3 bucket name for uploads |
| `PRESIGNED_URL_EXPIRY` | get-upload-url | URL expiry in seconds (300) |
| `COGNITO_USER_POOL_ID` | get-upload-url, get-result | Cognito pool for JWT verification |
| `DYNAMODB_TABLE` | process-image, get-result | DynamoDB table name |
| `BEDROCK_MODEL_ID` | process-image | e.g. `amazon.titan-text-express-v1` |
| `AWS_ACCOUNT_REGION` | all | Deployment region |

### Frontend (Vite `.env`)

| Variable | Description |
|----------|-------------|
| `VITE_COGNITO_REGION` | AWS region |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_API_BASE_URL` | API Gateway invoke URL |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Presigned S3 URLs | Server never handles raw image bytes; eliminates bandwidth cost and simplifies scaling |
| SQS between S3 and Lambda | Decouples upload spikes from processing capacity; enables retry/DLQ pattern |
| DLQ with CloudWatch alarm | Failures are isolated and alerted without data loss |
| Single-table DynamoDB | PK=USER#{userId}, SK=IMAGE#{imageId} supports both GetItem and full-history Query |
| Least-privilege IAM | Each Lambda has its own role scoped to only the resources it actually touches |
| PAY_PER_REQUEST DynamoDB | Zero cost at idle; scales automatically |
| CloudFront OAC | Modern replacement for OAI; serves SPA from private S3 bucket |

---

## Cost Estimate (light usage)

| Service | Free tier / est. |
|---------|-----------------|
| Lambda | 1M invocations/month free |
| API Gateway | 1M calls/month free |
| S3 | 5 GB free |
| DynamoDB | 25 GB free |
| Rekognition | 5,000 images/month free (first year) |
| Bedrock | Pay per token (~$0.0008/1K tokens for Titan) |
| CloudFront | 1 TB / 10M requests free |

Set `monthly_budget_usd = 10` in Terraform variables and you'll be alerted well before exceeding it.
