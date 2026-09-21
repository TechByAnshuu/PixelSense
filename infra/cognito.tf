# ============================================================
# Amazon Cognito — User Pool & App Client
# ============================================================

resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-user-pool"

  # Users sign in with email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # Email verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_message        = "Your PixelSense verification code is {####}"
    email_subject        = "PixelSense — Verify your email"
  }

  # Standard attributes
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  # Keep logs for 7 days (free tier)
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }
}

# App Client — used by the React frontend (Amplify / cognito-identity-js)
resource "aws_cognito_user_pool_client" "web" {
  name                = "${local.name_prefix}-web-client"
  user_pool_id        = aws_cognito_user_pool.main.id

  # No client secret — SPA cannot keep secrets
  generate_secret = false

  # Allow all OAuth flows needed for Amplify Auth
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = ["http://localhost:5173", "https://${aws_cloudfront_distribution.frontend.domain_name}"]
  logout_urls   = ["http://localhost:5173", "https://${aws_cloudfront_distribution.frontend.domain_name}"]

  supported_identity_providers = ["COGNITO"]

  # Token validity
  access_token_validity  = 1   # hours
  id_token_validity      = 1   # hours
  refresh_token_validity = 30  # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent user existence errors leaking (security best practice)
  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]
}

# Hosted UI domain (required for OAuth flows)
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${local.name_prefix}-${local.bucket_suffix}"
  user_pool_id = aws_cognito_user_pool.main.id
}
