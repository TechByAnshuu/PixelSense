# ============================================================
# S3 Buckets
# ============================================================

# ── 1. Uploads bucket (private — presigned URLs only) ──────

resource "aws_s3_bucket" "uploads" {
  bucket        = "${local.name_prefix}-uploads-${local.bucket_suffix}"
  force_destroy = true # allow destroy when non-empty (dev convenience)
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Block ALL public access — uploads are only reachable via presigned URLs
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: deny any non-presigned direct access
resource "aws_s3_bucket_policy" "uploads_deny_public" {
  bucket = aws_s3_bucket.uploads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonPresignedAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = ["s3:GetObject", "s3:PutObject"]
        Resource  = "${aws_s3_bucket.uploads.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:authType" = "REST-QUERY-STRING"
          }
          ArnNotLike = {
            "aws:PrincipalArn" = [
              aws_iam_role.lambda_get_upload_url.arn,
              aws_iam_role.lambda_process_image.arn,
            ]
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

# CORS — allows the browser to PUT directly using the presigned URL
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["*"] # restrict to your domain in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 → SQS event notification (ObjectCreated fires after upload)
resource "aws_s3_bucket_notification" "uploads_to_sqs" {
  bucket = aws_s3_bucket.uploads.id

  queue {
    queue_arn     = aws_sqs_queue.processing.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "uploads/"
  }

  depends_on = [aws_sqs_queue_policy.allow_s3_send]
}

# ── 2. Frontend static bucket ──────────────────────────────

resource "aws_s3_bucket" "frontend_static" {
  bucket        = "${local.name_prefix}-frontend-${local.bucket_suffix}"
  force_destroy = true
}

# Block public access — served ONLY via CloudFront OAC
resource "aws_s3_bucket_public_access_block" "frontend_static" {
  bucket = aws_s3_bucket.frontend_static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: allow CloudFront OAC to read
resource "aws_s3_bucket_policy" "frontend_oac" {
  bucket = aws_s3_bucket.frontend_static.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_static.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend_static]
}
