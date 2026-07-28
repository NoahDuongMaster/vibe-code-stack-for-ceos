variable "project_name" {
  description = "Stable lowercase project identifier used in AWS and Cloudflare resource names."
  type        = string
  default     = "vibe-code-stack"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.project_name))
    error_message = "project_name must be 3-31 lowercase letters, digits, or hyphens and start with a letter."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "aws_region" {
  description = "AWS region for the complete RPC stack."
  type        = string
}

variable "vpc_cidr" {
  description = "Environment-specific VPC CIDR."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type used by the fixed private RPC/database host."
  type        = string
}

variable "root_volume_size_gib" {
  description = "Encrypted gp3 root disk size for each RPC host."
  type        = number
  default     = 30
}

variable "postgres_data_volume_size_gib" {
  description = "Encrypted EBS capacity for PostgreSQL data, WAL, backup state, and pgBackRest spool."
  type        = number
}

variable "postgres_backup_stage_volume_size_gib" {
  description = "Encrypted EBS staging capacity for monthly backup creation."
  type        = number
}

variable "postgres_restore_stage_volume_size_gib" {
  description = "Encrypted EBS capacity dedicated to isolated restore drills."
  type        = number
}

variable "database_pool_max" {
  description = "Maximum PostgreSQL connections per trading-rpc process."
  type        = number
  default     = 10
}

variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the remotely managed Tunnel and Workers VPC services."
  type        = string
  sensitive   = true
}

variable "cloudflared_image" {
  description = "Immutable cloudflared container reference."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name form."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use owner/name format."
  }
}

variable "github_oidc_provider_arn" {
  description = "Pre-bootstrapped AWS IAM OIDC provider ARN for token.actions.githubusercontent.com."
  type        = string
}

variable "terraform_state_bucket_name" {
  description = "Remote-state bucket read by the environment-specific application deploy role."
  type        = string
}

variable "terraform_state_kms_key_arn" {
  description = "Customer-managed KMS key encrypting remote Terraform state."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for RPC and tunnel containers."
  type        = number
}

variable "operations_alert_email" {
  description = "Email endpoint that must confirm the encrypted SNS operations subscription."
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.operations_alert_email))
    error_message = "operations_alert_email must be a valid email address."
  }
}

variable "ec2_ami_ssm_parameter" {
  description = "Public SSM parameter containing the approved Amazon Linux 2023 AMI ID."
  type        = string
  default     = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

variable "docker_compose_version" {
  description = "Pinned Docker Compose plugin version installed during EC2 bootstrap."
  type        = string
  default     = "v5.3.1"
}

variable "docker_compose_linux_x86_64_sha256" {
  description = "SHA-256 of the pinned Docker Compose linux-x86_64 binary."
  type        = string
  default     = "f9ebc6ebdb19d769b793c245a736caaeb198c62587f13b25c660c13b4987f959"
}
