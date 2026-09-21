# ============================================================
# DynamoDB — Single-table design
# ============================================================

resource "aws_dynamodb_table" "results" {
  name         = "${local.name_prefix}-results"
  billing_mode = "PAY_PER_REQUEST"

  # Composite primary key
  hash_key  = "PK"  # USER#{userId}
  range_key = "SK"  # IMAGE#{imageId}

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # Optional TTL — auto-expire old records
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery (recommended for production)
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${local.name_prefix}-results"
  }
}
