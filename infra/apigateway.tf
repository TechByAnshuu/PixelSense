# ============================================================
# API Gateway — REST API with Cognito Authorizer
# ============================================================

resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "PixelSense REST API — image upload and results"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# ── Cognito JWT Authorizer ─────────────────────────────────

resource "aws_api_gateway_authorizer" "cognito" {
  name                   = "cognito-jwt"
  rest_api_id            = aws_api_gateway_rest_api.main.id
  type                   = "COGNITO_USER_POOLS"
  identity_source        = "method.request.header.Authorization"
  provider_arns          = [aws_cognito_user_pool.main.arn]
}

# ── /uploads resource (POST) ──────────────────────────────

resource "aws_api_gateway_resource" "uploads" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "uploads"
}

resource "aws_api_gateway_method" "post_uploads" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.uploads.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "post_uploads" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.uploads.id
  http_method             = aws_api_gateway_method.post_uploads.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_upload_url.invoke_arn
}

resource "aws_lambda_permission" "apigw_get_upload_url" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_upload_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# CORS OPTIONS for /uploads
resource "aws_api_gateway_method" "options_uploads" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.uploads.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_uploads" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.uploads.id
  http_method = aws_api_gateway_method.options_uploads.http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "options_uploads_200" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.uploads.id
  http_method = aws_api_gateway_method.options_uploads.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_uploads" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.uploads.id
  http_method = aws_api_gateway_method.options_uploads.http_method
  status_code = aws_api_gateway_method_response.options_uploads_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ── /results resource (GET — history) ─────────────────────

resource "aws_api_gateway_resource" "results" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "results"
}

resource "aws_api_gateway_method" "get_results" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.results.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "get_results" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.results.id
  http_method             = aws_api_gateway_method.get_results.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_result.invoke_arn
}

# ── /results/{imageId} resource (GET — single) ────────────

resource "aws_api_gateway_resource" "result_by_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.results.id
  path_part   = "{imageId}"
}

resource "aws_api_gateway_method" "get_result_by_id" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.result_by_id.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
  request_parameters = {
    "method.request.path.imageId" = true
  }
}

resource "aws_api_gateway_integration" "get_result_by_id" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.result_by_id.id
  http_method             = aws_api_gateway_method.get_result_by_id.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_result.invoke_arn
}

resource "aws_lambda_permission" "apigw_get_result" {
  statement_id  = "AllowAPIGatewayInvokeGetResult"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_result.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# ── Deployment + Stage ─────────────────────────────────────

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.uploads.id,
      aws_api_gateway_method.post_uploads.id,
      aws_api_gateway_integration.post_uploads.id,
      aws_api_gateway_resource.results.id,
      aws_api_gateway_method.get_results.id,
      aws_api_gateway_resource.result_by_id.id,
      aws_api_gateway_method.get_result_by_id.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.post_uploads,
    aws_api_gateway_integration.get_results,
    aws_api_gateway_integration.get_result_by_id,
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      sourceIp       = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      userId         = "$context.authorizer.claims.sub"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 14
}

# ── Usage Plan — throttle per API key ─────────────────────

resource "aws_api_gateway_usage_plan" "main" {
  name = "${local.name_prefix}-usage-plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }

  throttle_settings {
    rate_limit  = var.api_throttle_rate
    burst_limit = var.api_throttle_burst
  }
}
