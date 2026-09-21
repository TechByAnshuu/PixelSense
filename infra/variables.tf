variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project identifier used as a prefix for all resource names"
  type        = string
  default     = "pixelsense"
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod)"
  type        = string
  default     = "dev"
}

variable "budget_alert_email" {
  description = "Email address for AWS Budgets and CloudWatch alarm notifications"
  type        = string
  default     = "you@example.com"
}

variable "monthly_budget_usd" {
  description = "Monthly AWS spend budget in USD"
  type        = number
  default     = 20
}

variable "lambda_memory_mb" {
  description = "Memory allocated to each Lambda function (MB)"
  type        = number
  default     = 256
}

variable "lambda_timeout_sec" {
  description = "Lambda execution timeout (seconds)"
  type        = number
  default     = 30
}

variable "sqs_visibility_timeout_sec" {
  description = "SQS visibility timeout for the processing queue (must be >= lambda_timeout_sec)"
  type        = number
  default     = 60
}

variable "sqs_max_receive_count" {
  description = "Number of SQS delivery attempts before message moves to DLQ"
  type        = number
  default     = 3
}

variable "presigned_url_expiry_sec" {
  description = "Presigned S3 PUT URL expiry in seconds (default 5 minutes)"
  type        = number
  default     = 300
}

variable "api_throttle_rate" {
  description = "API Gateway usage plan — sustained request rate (req/sec)"
  type        = number
  default     = 10
}

variable "api_throttle_burst" {
  description = "API Gateway usage plan — burst limit"
  type        = number
  default     = 20
}

variable "bedrock_model_id" {
  description = "Amazon Bedrock model ID for summary generation"
  type        = string
  default     = "amazon.titan-text-express-v1"
}
