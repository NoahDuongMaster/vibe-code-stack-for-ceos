provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "vibe-code-stack"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

provider "cloudflare" {}

module "rpc_stack" {
  source = "../../modules/rpc-stack"

  environment                            = "production"
  aws_region                             = var.aws_region
  vpc_cidr                               = "10.80.0.0/16"
  instance_type                          = "t3.small"
  root_volume_size_gib                   = 30
  postgres_data_volume_size_gib          = 30
  postgres_backup_stage_volume_size_gib  = 20
  postgres_restore_stage_volume_size_gib = 30
  database_pool_max                      = 10
  cloudflare_account_id                  = var.cloudflare_account_id
  cloudflared_image                      = "cloudflare/cloudflared:2026.7.3@sha256:e39ee8da81ad5e05d77f38d2f51c60ca51bf2a8450ac3abab50c17fdb91d91bf"
  github_repository                      = var.github_repository
  github_oidc_provider_arn               = var.github_oidc_provider_arn
  terraform_state_bucket_name            = var.terraform_state_bucket_name
  terraform_state_kms_key_arn            = var.terraform_state_kms_key_arn
  log_retention_days                     = 30
  operations_alert_email                 = var.operations_alert_email
}

check "production_region" {
  assert {
    condition     = var.aws_region == "ap-southeast-1"
    error_message = "Production must retain the explicit Singapore region."
  }
}
