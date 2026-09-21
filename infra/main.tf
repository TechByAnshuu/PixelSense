terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Uncomment and configure for remote state:
  # backend "s3" {
  #   bucket = "your-tfstate-bucket"
  #   key    = "pixelsense/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "random" {}

# Random suffix to ensure globally unique bucket names
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix    = "${var.project_name}-${var.environment}"
  bucket_suffix  = random_id.suffix.hex
}
