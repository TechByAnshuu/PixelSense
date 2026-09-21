# ============================================================
# SQS — Processing Queue + Dead Letter Queue
# ============================================================

# ── Dead Letter Queue (DLQ) ────────────────────────────────

resource "aws_sqs_queue" "dlq" {
  name                       = "${local.name_prefix}-dlq"
  message_retention_seconds  = 1209600 # 14 days — maximum for inspection/replay
  visibility_timeout_seconds = var.sqs_visibility_timeout_sec

  tags = {
    Name = "${local.name_prefix}-dlq"
  }
}

# ── Processing Queue ───────────────────────────────────────

resource "aws_sqs_queue" "processing" {
  name                       = "${local.name_prefix}-processing"
  visibility_timeout_seconds = var.sqs_visibility_timeout_sec
  message_retention_seconds  = 86400 # 24 hours

  # Redrive: after N failed deliveries → DLQ
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.sqs_max_receive_count
  })

  tags = {
    Name = "${local.name_prefix}-processing"
  }
}

# ── Allow S3 to publish to the processing queue ────────────

resource "aws_sqs_queue_policy" "allow_s3_send" {
  queue_url = aws_sqs_queue.processing.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3ObjectCreatedEvents"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.processing.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = aws_s3_bucket.uploads.arn
          }
        }
      }
    ]
  })
}

# ── SQS → processImage Lambda trigger ─────────────────────

resource "aws_lambda_event_source_mapping" "sqs_to_process_image" {
  event_source_arn = aws_sqs_queue.processing.arn
  function_name    = aws_lambda_function.process_image.arn
  batch_size       = 1 # process one message at a time for isolation
  enabled          = true
}
