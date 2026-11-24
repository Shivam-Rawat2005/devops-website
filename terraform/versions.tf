terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  # Remote state in S3. The bucket, key and region are passed at `terraform init`
  # time (see docs/DEPLOYMENT.md), so dev and prod keep separate state files.
  # use_lockfile stores a lock next to the state, so two runs cannot change it at once.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
