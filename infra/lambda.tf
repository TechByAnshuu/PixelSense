locals {
  lambda_runtime = "nodejs20.x"
  lambda_handler = "index.handler"
}

# ============================================================
# IAM — Shared base policy for Lambda logging
# ============================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "lambda_logging" {
  name        = "${local.name_prefix}-lambda-logging"
  description = "Allow Lambda to write structured JSON logs to CloudWatch"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

# ============================================================
# Lambda: getUploadUrl
# ============================================================

resource "aws_iam_role" "lambda_get_upload_url" {
  name               = "${local.name_prefix}-get-upload-url-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "get_upload_url_logging" {
  role       = aws_iam_role.lambda_get_upload_url.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

# Least-privilege: only PutObject on the uploads bucket
resource "aws_iam_role_policy" "get_upload_url_s3" {
  name = "${local.name_prefix}-get-upload-url-s3"
  role = aws_iam_role.lambda_get_upload_url.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject"]
      Resource = "${aws_s3_bucket.uploads.arn}/uploads/*"
    }]
  })
}

data "archive_file" "get_upload_url" {
  type        = "zip"
  source_dir  = "${path.module}/../services/get-upload-url"
  output_path = "${path.module}/.builds/get-upload-url.zip"
  excludes    = ["node_modules", "__tests__"]
}

resource "aws_lambda_function" "get_upload_url" {
  function_name    = "${local.name_prefix}-get-upload-url"
  role             = aws_iam_role.lambda_get_upload_url.arn
  runtime          = local.lambda_runtime
  handler          = local.lambda_handler
  filename         = data.archive_file.get_upload_url.output_path
  source_code_hash = data.archive_file.get_upload_url.output_base64sha256
  memory_size      = var.lambda_memory_mb
  timeout          = var.lambda_timeout_sec

  environment {
    variables = {
      UPLOADS_BUCKET          = aws_s3_bucket.uploads.bucket
      PRESIGNED_URL_EXPIRY    = tostring(var.presigned_url_expiry_sec)
      COGNITO_USER_POOL_ID    = aws_cognito_user_pool.main.id
      AWS_ACCOUNT_REGION      = var.aws_region
    }
  }

  tracing_config { mode = "Active" }

  depends_on = [aws_iam_role_policy_attachment.get_upload_url_logging]
}

resource "aws_cloudwatch_log_group" "get_upload_url" {
  name              = "/aws/lambda/${aws_lambda_function.get_upload_url.function_name}"
  retention_in_days = 14
}

# ============================================================
# Lambda: processImage
# ============================================================

resource "aws_iam_role" "lambda_process_image" {
  name               = "${local.name_prefix}-process-image-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "process_image_logging" {
  role       = aws_iam_role.lambda_process_image.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_iam_role_policy" "process_image_permissions" {
  name = "${local.name_prefix}-process-image-perms"
  role = aws_iam_role.lambda_process_image.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "S3GetObject"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      },
      {
        Sid      = "SQSReceiveDelete"
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.processing.arn
      },
      {
        Sid      = "DynamoDBWrite"
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.results.arn
      },
      {
        Sid      = "Rekognition"
        Effect   = "Allow"
        Action   = [
          "rekognition:DetectLabels",
          "rekognition:DetectFaces",
          "rekognition:RecognizeCelebrities",
          "rekognition:DetectText"
        ]
        Resource = "*"
      },
      {
        Sid      = "Bedrock"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}"
      },
      {
        Sid      = "XRay"
        Effect   = "Allow"
        Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "process_image" {
  type        = "zip"
  source_dir  = "${path.module}/../services/process-image"
  output_path = "${path.module}/.builds/process-image.zip"
  excludes    = ["node_modules", "__tests__"]
}

resource "aws_lambda_function" "process_image" {
  function_name    = "${local.name_prefix}-process-image"
  role             = aws_iam_role.lambda_process_image.arn
  runtime          = local.lambda_runtime
  handler          = local.lambda_handler
  filename         = data.archive_file.process_image.output_path
  source_code_hash = data.archive_file.process_image.output_base64sha256
  memory_size      = 512
  timeout          = 60

  environment {
    variables = {
      DYNAMODB_TABLE   = aws_dynamodb_table.results.name
      BEDROCK_MODEL_ID = var.bedrock_model_id
      AWS_ACCOUNT_REGION = var.aws_region
    }
  }

  tracing_config { mode = "Active" }

  depends_on = [aws_iam_role_policy_attachment.process_image_logging]
}

resource "aws_cloudwatch_log_group" "process_image" {
  name              = "/aws/lambda/${aws_lambda_function.process_image.function_name}"
  retention_in_days = 14
}

# ============================================================
# Lambda: getResult
# ============================================================

resource "aws_iam_role" "lambda_get_result" {
  name               = "${local.name_prefix}-get-result-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "get_result_logging" {
  role       = aws_iam_role.lambda_get_result.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_iam_role_policy" "get_result_dynamo" {
  name = "${local.name_prefix}-get-result-dynamo"
  role = aws_iam_role.lambda_get_result.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "DynamoDBQuery"
      Effect = "Allow"
      Action = ["dynamodb:Query", "dynamodb:GetItem"]
      Resource = [
        aws_dynamodb_table.results.arn,
        "${aws_dynamodb_table.results.arn}/index/*"
      ]
    }]
  })
}

data "archive_file" "get_result" {
  type        = "zip"
  source_dir  = "${path.module}/../services/get-result"
  output_path = "${path.module}/.builds/get-result.zip"
  excludes    = ["node_modules", "__tests__"]
}

resource "aws_lambda_function" "get_result" {
  function_name    = "${local.name_prefix}-get-result"
  role             = aws_iam_role.lambda_get_result.arn
  runtime          = local.lambda_runtime
  handler          = local.lambda_handler
  filename         = data.archive_file.get_result.output_path
  source_code_hash = data.archive_file.get_result.output_base64sha256
  memory_size      = var.lambda_memory_mb
  timeout          = var.lambda_timeout_sec

  environment {
    variables = {
      DYNAMODB_TABLE       = aws_dynamodb_table.results.name
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      AWS_ACCOUNT_REGION   = var.aws_region
    }
  }

  tracing_config { mode = "Active" }

  depends_on = [aws_iam_role_policy_attachment.get_result_logging]
}

resource "aws_cloudwatch_log_group" "get_result" {
  name              = "/aws/lambda/${aws_lambda_function.get_result.function_name}"
  retention_in_days = 14
}
