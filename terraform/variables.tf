variable "project_name" {
  description = "Name used to tag and name every resource."
  type        = string
  default     = "devops-website"
}

variable "environment" {
  description = "Environment name: dev or prod."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be \"dev\" or \"prod\"."
  }
}

variable "aws_region" {
  description = "AWS region to deploy into. ap-south-1 is Mumbai."
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "IP range of the project's private network (VPC)."
  type        = string
  default     = "10.20.0.0/16"
}

variable "instance_type" {
  description = "EC2 instance size for the web servers."
  type        = string
  default     = "t3.micro"
}

variable "web_count" {
  description = "How many web servers to run. Use 2 or more with the load balancer for zero-downtime deploys."
  type        = number
  default     = 1

  validation {
    condition     = var.web_count >= 1 && var.web_count <= 4
    error_message = "web_count must be between 1 and 4."
  }
}

variable "enable_lb" {
  description = "Create an Application Load Balancer in front of the web servers."
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN for HTTPS on the load balancer. Leave empty for HTTP only."
  type        = string
  default     = ""
}

variable "ssh_public_key" {
  description = "Public SSH key that Ansible uses to log in (contents of id_ed25519.pub). Passed in from a GitHub secret."
  type        = string
  sensitive   = true
}

variable "ssh_cidrs" {
  description = "IP ranges allowed to connect over SSH. GitHub-hosted runners use changing IPs, so the default is open; servers accept keys only and run fail2ban."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
