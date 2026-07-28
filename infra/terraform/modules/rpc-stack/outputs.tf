output "admin_rpc_repository_url" {
  value       = aws_ecr_repository.rpc["admin-rpc"].repository_url
  description = "ECR repository URL for admin-rpc."
}

output "trading_rpc_repository_url" {
  value       = aws_ecr_repository.rpc["trading-rpc"].repository_url
  description = "ECR repository URL for trading-rpc."
}

output "postgres_repository_url" {
  value       = aws_ecr_repository.rpc["postgres"].repository_url
  description = "ECR repository URL for the PostgreSQL backup image."
}

output "rpc_instance_id" {
  value       = aws_instance.rpc.id
  description = "Private EC2 instance targeted by SSM deployments."
}

output "runtime_secret_arn" {
  value       = aws_secretsmanager_secret.runtime.arn
  description = "Secrets Manager document seeded by deployment CI."
}

output "backup_recovery_secret_arn" {
  value       = aws_secretsmanager_secret.backup_recovery.arn
  description = "Separate Secrets Manager container for the raw monthly-backup age identity."
}

output "desired_image_tag_parameter_name" {
  value       = aws_ssm_parameter.desired_image_tag.name
  description = "SSM parameter read by replacement instances during bootstrap."
}

output "cloudflare_tunnel_id" {
  value       = cloudflare_zero_trust_tunnel_cloudflared.rpc.id
  description = "Remotely managed Cloudflare Tunnel ID."
}

output "trading_rpc_vpc_service_id" {
  value       = cloudflare_connectivity_directory_service.trading_rpc.service_id
  description = "Workers VPC service ID for the trading-rpc Connect listener."
}

output "admin_rpc_vpc_service_id" {
  value       = cloudflare_connectivity_directory_service.admin_rpc.service_id
  description = "Workers VPC service ID for the admin-rpc Connect listener."
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "Environment-scoped GitHub OIDC role used by application deployments."
}

output "operations_topic_arn" {
  value       = aws_sns_topic.operations.arn
  description = "SNS operations topic with a Terraform-managed email subscription that requires recipient confirmation."
}
