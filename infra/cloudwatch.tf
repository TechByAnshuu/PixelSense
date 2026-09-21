# ============================================================
# CloudWatch — Dashboards, Alarms, SNS
# ============================================================

# SNS topic for alarm notifications
resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

# ── Alarms ─────────────────────────────────────────────────

# 1. Lambda error rate — getUploadUrl
resource "aws_cloudwatch_metric_alarm" "get_upload_url_errors" {
  alarm_name          = "${local.name_prefix}-get-upload-url-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "getUploadUrl Lambda error count > 5 over 2 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  dimensions = {
    FunctionName = aws_lambda_function.get_upload_url.function_name
  }
}

# 2. Lambda error rate — processImage
resource "aws_cloudwatch_metric_alarm" "process_image_errors" {
  alarm_name          = "${local.name_prefix}-process-image-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "processImage Lambda error count > 3 over 2 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  dimensions = {
    FunctionName = aws_lambda_function.process_image.function_name
  }
}

# 3. DLQ — messages visible (should always be 0)
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${local.name_prefix}-dlq-messages-visible"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in DLQ — image processing failures require investigation"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }
}

# 4. API Gateway 5xx errors
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name_prefix}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API Gateway 5xx error count > 10 over 2 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  dimensions = {
    ApiName  = aws_api_gateway_rest_api.main.name
    Stage    = aws_api_gateway_stage.main.stage_name
  }
}

# ── Dashboard ──────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0; y = 0; width = 12; height = 6
        properties = {
          title  = "Lambda Invocations & Errors"
          period = 60
          stat   = "Sum"
          view   = "timeSeries"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.get_upload_url.function_name],
            ["AWS/Lambda", "Errors",      "FunctionName", aws_lambda_function.get_upload_url.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.process_image.function_name],
            ["AWS/Lambda", "Errors",      "FunctionName", aws_lambda_function.process_image.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.get_result.function_name],
            ["AWS/Lambda", "Errors",      "FunctionName", aws_lambda_function.get_result.function_name],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12; y = 0; width = 12; height = 6
        properties = {
          title  = "SQS Queue Depth"
          period = 60
          stat   = "Average"
          view   = "timeSeries"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.processing.name, { label = "Processing Queue" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.dlq.name,        { label = "DLQ (must be 0)" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0; y = 6; width = 12; height = 6
        properties = {
          title  = "API Gateway 4xx / 5xx"
          period = 60
          stat   = "Sum"
          view   = "timeSeries"
          metrics = [
            ["AWS/ApiGateway", "4XXError", "ApiName", aws_api_gateway_rest_api.main.name, "Stage", var.environment],
            ["AWS/ApiGateway", "5XXError", "ApiName", aws_api_gateway_rest_api.main.name, "Stage", var.environment],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12; y = 6; width = 12; height = 6
        properties = {
          title  = "Lambda Duration (p99)"
          period = 60
          stat   = "p99"
          view   = "timeSeries"
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.get_upload_url.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.process_image.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.get_result.function_name],
          ]
        }
      }
    ]
  })
}
