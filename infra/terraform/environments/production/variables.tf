variable "aws_region" {
  type        = string
  description = "AWS region for production."
  default     = "ap-southeast-1"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID."
  sensitive   = true
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in owner/name form."
}

variable "github_oidc_provider_arn" {
  type        = string
  description = "Pre-bootstrapped GitHub Actions OIDC provider ARN."
}

variable "terraform_state_bucket_name" {
  type        = string
  description = "Encrypted, versioned S3 bucket containing Terraform state."
}

variable "terraform_state_kms_key_arn" {
  type        = string
  description = "Customer-managed KMS key encrypting Terraform state."
}

variable "operations_alert_email" {
  type        = string
  description = "Confirmed production on-call email for SNS operations alarms."
}
