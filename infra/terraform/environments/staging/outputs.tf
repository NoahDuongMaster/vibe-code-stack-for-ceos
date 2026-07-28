output "admin_rpc_repository_url" {
  value = module.rpc_stack.admin_rpc_repository_url
}

output "trading_rpc_repository_url" {
  value = module.rpc_stack.trading_rpc_repository_url
}

output "postgres_repository_url" {
  value = module.rpc_stack.postgres_repository_url
}

output "rpc_instance_id" {
  value = module.rpc_stack.rpc_instance_id
}

output "runtime_secret_arn" {
  value = module.rpc_stack.runtime_secret_arn
}

output "backup_recovery_secret_arn" {
  value = module.rpc_stack.backup_recovery_secret_arn
}

output "desired_image_tag_parameter_name" {
  value = module.rpc_stack.desired_image_tag_parameter_name
}

output "cloudflare_tunnel_id" {
  value = module.rpc_stack.cloudflare_tunnel_id
}

output "trading_rpc_vpc_service_id" {
  value = module.rpc_stack.trading_rpc_vpc_service_id
}

output "admin_rpc_vpc_service_id" {
  value = module.rpc_stack.admin_rpc_vpc_service_id
}

output "github_deploy_role_arn" {
  value = module.rpc_stack.github_deploy_role_arn
}

output "operations_topic_arn" {
  value = module.rpc_stack.operations_topic_arn
}
