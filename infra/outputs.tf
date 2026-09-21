output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool App Client ID (used in frontend Amplify config)"
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_user_pool_domain" {
  description = "Cognito hosted UI domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "s3_uploads_bucket" {
  description = "Name of the private image uploads S3 bucket"
  value       = aws_s3_bucket.uploads.bucket
}

output "s3_frontend_bucket" {
  description = "Name of the static frontend S3 bucket"
  value       = aws_s3_bucket.frontend_static.bucket
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.results.name
}

output "sqs_processing_queue_url" {
  description = "SQS processing queue URL"
  value       = aws_sqs_queue.processing.url
}

output "sqs_dlq_url" {
  description = "SQS dead letter queue URL"
  value       = aws_sqs_queue.dlq.url
}

output "api_gateway_invoke_url" {
  description = "API Gateway base invoke URL (append /uploads, /results, etc.)"
  value       = "${aws_api_gateway_stage.main.invoke_url}"
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name for the frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "get_upload_url_lambda_arn" {
  description = "ARN of the getUploadUrl Lambda function"
  value       = aws_lambda_function.get_upload_url.arn
}

output "process_image_lambda_arn" {
  description = "ARN of the processImage Lambda function"
  value       = aws_lambda_function.process_image.arn
}

output "get_result_lambda_arn" {
  description = "ARN of the getResult Lambda function"
  value       = aws_lambda_function.get_result.arn
}
