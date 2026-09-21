# PixelSense — API Contract

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/<stage>`

All endpoints require `Authorization: Bearer <cognito-id-token>` header.

---

## POST /uploads

Request a presigned S3 URL to upload an image directly from the browser.

### Request

```http
POST /uploads
Authorization: Bearer <id-token>
Content-Type: application/json

{
  "fileName":    "photo.jpg",
  "contentType": "image/jpeg"
}
```

### Response — 201 Created

```json
{
  "uploadUrl":  "https://s3.amazonaws.com/pixelsense-dev-uploads-xxxx/uploads/{userId}/{imageId}/photo.jpg?X-Amz-...",
  "imageId":    "550e8400-e29b-41d4-a716-446655440000",
  "expiresIn":  300
}
```

The frontend then `PUT`s the file directly to `uploadUrl` with `Content-Type: image/jpeg`.
No auth header should be sent to S3 — the presigned URL already carries credentials.

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `fileName` or `contentType` missing / not an `image/*` type |
| 401 | Missing, expired, or invalid Cognito JWT |
| 500 | Presigned URL generation failed |

---

## GET /results/{imageId}

Get the analysis result for a single image.

### Request

```http
GET /results/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <id-token>
```

### Response — 200 OK (result ready)

```json
{
  "userId":      "cognito-sub-uuid",
  "imageId":     "550e8400-e29b-41d4-a716-446655440000",
  "status":      "COMPLETE",
  "labels": [
    { "name": "Mountain", "confidence": 98, "categories": ["Nature"] },
    { "name": "Person",   "confidence": 91, "categories": ["People"] }
  ],
  "faces": [
    {
      "confidence": 99,
      "gender":     "Male",
      "ageRange":   { "Low": 25, "High": 35 },
      "emotions":   [{ "type": "CALM", "confidence": 87 }],
      "smile":      false
    }
  ],
  "celebrities": [
    { "name": "Elon Musk", "confidence": 84, "urls": ["https://en.wikipedia.org/wiki/Elon_Musk"] }
  ],
  "text": [
    { "detectedText": "Summit 2.4 km", "confidence": 96 }
  ],
  "summary":   "A sun-lit mountain trail with two hikers approaching a turquoise lake. A wooden signpost reads Summit — 2.4 km.",
  "createdAt": "2026-09-21T18:00:00.000Z"
}
```

### Response — 200 OK (still processing)

```json
{
  "imageId": "550e8400-e29b-41d4-a716-446655440000",
  "status":  "PROCESSING"
}
```

Poll this endpoint every 2 seconds until `status !== 'PROCESSING'`.

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing / invalid Cognito JWT |
| 500 | DynamoDB read failure |

---

## GET /results

List all analysis results for the authenticated user (history), newest first.

### Request

```http
GET /results
Authorization: Bearer <id-token>
```

### Response — 200 OK

```json
{
  "items": [
    {
      "userId":    "cognito-sub-uuid",
      "imageId":   "550e8400-e29b-41d4-a716-446655440000",
      "status":    "COMPLETE",
      "labels":    [{ "name": "Mountain", "confidence": 98 }],
      "summary":   "A mountain landscape…",
      "createdAt": "2026-09-21T18:00:00.000Z"
    }
  ],
  "count": 1
}
```

> Results are capped at 50 per page. Pagination via `LastEvaluatedKey` can be added if needed.

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing / invalid Cognito JWT |
| 500 | DynamoDB query failure |

---

## Status Values

| Value | Meaning |
|-------|---------|
| `PROCESSING` | Image uploaded; pipeline running |
| `COMPLETE`   | All AI analysis finished; results ready |
| `FAILED`     | Processing failed after SQS retries; check DLQ |
