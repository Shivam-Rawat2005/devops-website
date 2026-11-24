# One-time setup, run from your own computer with your AWS admin credentials:
#   cd terraform/bootstrap
#   terraform init
#   terraform apply -var="github_repo=YOUR-USERNAME/devops-website" -var="state_bucket_name=YOUR-UNIQUE-BUCKET-NAME"
#
# It creates:
#   1. An S3 bucket that stores Terraform state for dev and prod.
#   2. An OIDC trust between GitHub and AWS, and an IAM role that GitHub Actions can
#      assume, so no long-lived AWS access keys are ever stored in GitHub.
# This folder keeps its own small state file locally (terraform.tfstate); keep it safe.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

variable "aws_region" {
  description = "AWS region, the same one the project deploys into."
  type        = string
  default     = "ap-south-1"
}

variable "github_repo" {
  description = "GitHub repository allowed to deploy, as owner/name."
  type        = string
}

variable "state_bucket_name" {
  description = "Globally unique name for the Terraform state bucket."
  type        = string
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "devops-website"
      ManagedBy = "terraform-bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

# ---------- State bucket ----------

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------- GitHub Actions login (OIDC) ----------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # AWS verifies GitHub's certificate itself; these values are kept for older tooling.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4d2df264fcd",
  ]
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only workflows from this one repository may assume the role.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [
        "repo:*devops-website*:*",
        "repo:Shivam-Rawat2005*devops-website*:*"
      ]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "devops-website-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
}

# What the pipeline may do: manage EC2/VPC and the load balancer, and read/write the state bucket.
resource "aws_iam_role_policy_attachment" "ec2" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
}

resource "aws_iam_role_policy_attachment" "elb" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess"
}

data "aws_iam_policy_document" "state_access" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/*"]
  }
}

resource "aws_iam_role_policy" "state_access" {
  name   = "terraform-state"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.state_access.json
}

# ---------- Values to copy into GitHub ----------

output "aws_role_arn" {
  description = "Save as the GitHub secret AWS_ROLE_ARN."
  value       = aws_iam_role.github_deploy.arn
}

output "state_bucket" {
  description = "Save as the GitHub variable TF_STATE_BUCKET."
  value       = aws_s3_bucket.state.bucket
}

output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}
